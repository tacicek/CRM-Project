import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Zod Schema für Input-Validierung
const NotifyOfferResponseSchema = z.object({
  offerTitle: z.string().min(1, "Titel erforderlich").max(200),
  customerName: z.string().min(1, "Name erforderlich").max(200),
  customerEmail: z.string().email("Ungültige E-Mail-Adresse").max(255),
  customerPhone: z.string().max(50).nullable().optional(),
  responseType: z.enum(["accepted", "rejected", "question"], { errorMap: () => ({ message: "Antworttyp muss 'accepted', 'rejected' oder 'question' sein" }) }),
  responseNote: z.string().max(2000).nullable(),
  companyEmail: z.string().email("Ungültige E-Mail-Adresse").max(255),
  companyName: z.string().min(1, "Firmenname erforderlich").max(200),
  companyId: z.string().uuid("Ungültige Firmen-ID").optional(),
  offerTotal: z.number().min(0, "Betrag muss positiv sein"),
});

type NotifyOfferResponseRequest = z.infer<typeof NotifyOfferResponseSchema>;

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[notify-offer-response] ${step}`, details ? JSON.stringify(details) : "");
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    
    // Validiere Input mit Zod
    const parseResult = NotifyOfferResponseSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("[notify-offer-response] Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const request = parseResult.data;
    
    logStep("Processing offer response notification", {
      offerTitle: request.offerTitle,
      customerName: request.customerName,
      responseType: request.responseType,
      companyEmail: request.companyEmail,
      companyId: request.companyId,
    });

    // Get company details including Resend settings
    let company = null;
    if (request.companyId) {
      const { data, error } = await supabase
        .from("companies")
        .select("id, company_name, resend_enabled, resend_api_key, resend_from_email, resend_from_name")
        .eq("id", request.companyId)
        .single();
      
      if (error) {
        logStep("Error fetching company", { error });
      } else {
        company = data;
      }
    }

    // Determine which Resend API key and from address to use
    let resendApiKey = Deno.env.get("RESEND_API_KEY");
    let fromAddress = "Offerio <noreply@offerio.ch>";
    let isCompanyEmail = false;

    // Use company's own Resend settings if configured
    if (company?.resend_enabled && company?.resend_api_key && company?.resend_from_email) {
      resendApiKey = company.resend_api_key;
      const fromName = company.resend_from_name || company.company_name;
      fromAddress = `${fromName} <${company.resend_from_email}>`;
      isCompanyEmail = true;
      logStep("Using company's own Resend API", { fromAddress });
    } else {
      logStep("Using default Offerio Resend API");
    }
    
    if (!resendApiKey) {
      logStep("No Resend API key configured, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "Email notification skipped - API key not configured" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const resend = new Resend(resendApiKey);

    const isAccepted = request.responseType === "accepted";
    const isQuestion = request.responseType === "question";
    
    let statusText = isAccepted ? "angenommen" : "abgelehnt";
    let statusColor = isAccepted ? "#16a34a" : "#dc2626";
    let statusEmoji = isAccepted ? "✅" : "❌";
    
    if (isQuestion) {
      statusText = "Frage";
      statusColor = "#3b82f6";
      statusEmoji = "❓";
    }

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("de-CH", {
        style: "currency",
        currency: "CHF",
      }).format(amount);
    };

    let emailHtml: string;
    let emailSubject: string;

    if (isQuestion) {
      // Question email template
      emailSubject = `❓ Kundenfrage zu Offerte "${request.offerTitle}"`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">
                ❓ Neue Kundenfrage
              </h1>
            </div>
            
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin-top: 0;">Guten Tag,</p>
              
              <p>Der Kunde <strong>${request.customerName}</strong> hat eine Frage zu Ihrer Offerte.</p>
              
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Offerte:</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right;">${request.offerTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Betrag:</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formatCurrency(request.offerTotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Kunde:</td>
                    <td style="padding: 8px 0; text-align: right;">${request.customerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">E-Mail:</td>
                    <td style="padding: 8px 0; text-align: right;">
                      <a href="mailto:${request.customerEmail}" style="color: #3b82f6;">${request.customerEmail}</a>
                    </td>
                  </tr>
                  ${request.customerPhone ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Telefon:</td>
                    <td style="padding: 8px 0; text-align: right;">
                      <a href="tel:${request.customerPhone}" style="color: #3b82f6;">${request.customerPhone}</a>
                    </td>
                  </tr>
                  ` : ""}
                </table>
              </div>
              
              <div style="background: #dbeafe; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">Frage des Kunden:</p>
                <p style="margin: 0; color: #1e3a8a; white-space: pre-wrap;">${request.responseNote || "Keine Nachricht"}</p>
              </div>
              
              <p style="color: #3b82f6; font-weight: 500;">
                📞 Bitte kontaktieren Sie den Kunden zeitnah, um die Frage zu beantworten.
              </p>
              
              <div style="text-align: center; margin-top: 20px;">
                <a href="mailto:${request.customerEmail}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  ✉️ Kunde antworten
                </a>
              </div>
              
              <p style="margin-bottom: 0; margin-top: 30px; color: #64748b; font-size: 14px;">
                Mit freundlichen Grüssen<br>
                <strong>${isCompanyEmail ? request.companyName : "Ihr Offerio Team"}</strong>
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
              <p>Diese E-Mail wurde automatisch${isCompanyEmail ? ` von ${request.companyName}` : " von Offerio"} gesendet.</p>
            </div>
          </body>
        </html>
      `;
    } else {
      // Accept/Reject email template
      emailSubject = `${statusEmoji} Offerte "${request.offerTitle}" wurde ${statusText}`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">
                ${statusEmoji} Offerte ${statusText}
              </h1>
            </div>
            
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin-top: 0;">Guten Tag,</p>
              
              <p>Der Kunde <strong>${request.customerName}</strong> hat Ihre Offerte <strong>${statusText}</strong>.</p>
              
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Offerte:</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right;">${request.offerTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Betrag:</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formatCurrency(request.offerTotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Kunde:</td>
                    <td style="padding: 8px 0; text-align: right;">${request.customerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">E-Mail:</td>
                    <td style="padding: 8px 0; text-align: right;">
                      <a href="mailto:${request.customerEmail}" style="color: #667eea;">${request.customerEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Status:</td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px;">
                        ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>
              
              ${request.responseNote ? `
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">Nachricht des Kunden:</p>
                  <p style="margin: 0; color: #78350f;">${request.responseNote}</p>
                </div>
              ` : ""}
              
              ${isAccepted ? `
                <p style="color: #16a34a; font-weight: 500;">
                  🎉 Herzlichen Glückwunsch! Kontaktieren Sie den Kunden, um die nächsten Schritte zu besprechen.
                </p>
              ` : `
                <p style="color: #64748b;">
                  Der Kunde hat sich für einen anderen Anbieter entschieden. Bleiben Sie dran für zukünftige Anfragen!
                </p>
              `}
              
              <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
                Mit freundlichen Grüssen<br>
                <strong>${isCompanyEmail ? request.companyName : "Ihr Offerio Team"}</strong>
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
              <p>Diese E-Mail wurde automatisch${isCompanyEmail ? ` von ${request.companyName}` : " von Offerio"} gesendet.</p>
            </div>
          </body>
        </html>
      `;
    }
    
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [request.companyEmail],
      subject: emailSubject,
      html: emailHtml,
    });

    if (error) {
      logStep("Error sending email", { error });
      
      await logEmail({
        recipientEmail: request.companyEmail,
        recipientName: request.companyName,
        subject: emailSubject,
        emailType: "offer_response",
        status: "failed",
        errorMessage: JSON.stringify(error),
        companyId: request.companyId,
        metadata: { responseType: request.responseType, offerTitle: request.offerTitle, offerTotal: request.offerTotal, isCompanyEmail },
      });
      
      throw error;
    }

    logStep("Email sent successfully", { emailId: data?.id, isCompanyEmail });

    await logEmail({
      recipientEmail: request.companyEmail,
      recipientName: request.companyName,
      subject: emailSubject,
      emailType: "offer_response",
      status: "sent",
      companyId: request.companyId,
      metadata: { responseType: request.responseType, offerTitle: request.offerTitle, offerTotal: request.offerTotal, isCompanyEmail },
    });

    return new Response(
      JSON.stringify({ success: true, emailId: data?.id, isCompanyEmail }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error in notify-offer-response", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
