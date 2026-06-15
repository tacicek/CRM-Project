import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotifyBesichtigungRequest {
  offerTitle: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  besichtigungDate: string;
  besichtigungTime: string | null;
  customerNote: string | null;
  companyEmail: string;
  companyName: string;
  companyId: string;
  offerTotal: number;
  offerId: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[notify-besichtigung] ${step}`, details ? JSON.stringify(details) : "");
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: NotifyBesichtigungRequest = await req.json();
    
    logStep("Processing besichtigung notification", {
      offerTitle: request.offerTitle,
      customerName: request.customerName,
      besichtigungDate: request.besichtigungDate,
      companyEmail: request.companyEmail,
      companyId: request.companyId,
    });

    // Get company details including Resend settings
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, company_name, resend_enabled, resend_api_key, resend_from_email, resend_from_name")
      .eq("id", request.companyId)
      .single();

    if (companyError) {
      logStep("Error fetching company", { error: companyError });
    }

    // Determine which Resend API key and from address to use
    let resendApiKey = Deno.env.get("RESEND_API_KEY");
    let fromAddress = getDefaultFrom();
    let isCompanyEmail = false;

    // Use company's own Resend settings if configured
    if (company?.resend_enabled && company?.resend_api_key && company?.resend_from_email) {
      resendApiKey = company.resend_api_key;
      const fromName = company.resend_from_name || company.company_name;
      fromAddress = `${fromName} <${company.resend_from_email}>`;
      isCompanyEmail = true;
      logStep("Using company's own Resend API", { fromAddress });
    } else {
      logStep("Using default Resend API");
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

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString("de-CH", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("de-CH", {
        style: "currency",
        currency: "CHF",
      }).format(amount);
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              👀 Besichtigungsanfrage
            </h1>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <p style="margin-top: 0;">Guten Tag,</p>
            
            <p>Der Kunde <strong>${request.customerName}</strong> möchte vor der Auftragserteilung eine <strong>Besichtigung</strong> durchführen.</p>
            
            <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 16px;">📅 Gewünschter Termin</h3>
              <p style="margin: 0; font-size: 18px; font-weight: 600; color: #1e3a8a;">
                ${formatDate(request.besichtigungDate)}${request.besichtigungTime ? ` um ${request.besichtigungTime} Uhr` : ""}
              </p>
            </div>
            
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Offerte:</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${request.offerTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Offertenbetrag:</td>
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
            
            ${request.customerNote ? `
              <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">📝 Nachricht des Kunden:</p>
                <p style="margin: 0; color: #78350f;">${request.customerNote}</p>
              </div>
            ` : ""}
            
            <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #15803d;">
                <strong>💡 Empfehlung:</strong> Kontaktieren Sie den Kunden zeitnah, um den Besichtigungstermin zu bestätigen oder einen alternativen Termin vorzuschlagen.
              </p>
            </div>
            
            <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
              Mit freundlichen Grüssen<br>
              <strong>${isCompanyEmail ? request.companyName : "Ihr ${getAppName()} Team"}</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
            <p>Diese E-Mail wurde automatisch${isCompanyEmail ? ` von ${request.companyName}` : " von ${getAppName()}"} gesendet.</p>
          </div>
        </body>
      </html>
    `;

    const emailSubject = `👀 Besichtigungsanfrage für "${request.offerTitle}" von ${request.customerName}`;
    
    // Send email to company
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [request.companyEmail],
      subject: emailSubject,
      html: emailHtml,
    });

    if (error) {
      logStep("Error sending company email", { error });
      
      await logEmail({
        recipientEmail: request.companyEmail,
        recipientName: request.companyName,
        subject: emailSubject,
        emailType: "besichtigung_request",
        status: "failed",
        errorMessage: JSON.stringify(error),
        companyId: request.companyId,
        metadata: { 
          offerTitle: request.offerTitle, 
          besichtigungDate: request.besichtigungDate,
          besichtigungTime: request.besichtigungTime,
          offerId: request.offerId,
          isCompanyEmail,
        },
      });
      
      throw error;
    }

    logStep("Company email sent successfully", { emailId: data?.id, isCompanyEmail });

    await logEmail({
      recipientEmail: request.companyEmail,
      recipientName: request.companyName,
      subject: emailSubject,
      emailType: "besichtigung_request",
      status: "sent",
      companyId: request.companyId,
      metadata: { 
        offerTitle: request.offerTitle, 
        besichtigungDate: request.besichtigungDate,
        besichtigungTime: request.besichtigungTime,
        offerId: request.offerId,
        isCompanyEmail,
      },
    });

    // Create in-app notification for the company
    if (request.companyId) {
      const formatDateShort = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("de-CH", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      };

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          company_id: request.companyId,
          type: "besichtigung_request",
          title: "👀 Besichtigungsanfrage erhalten",
          body: `${request.customerName} wünscht eine Besichtigung am ${formatDateShort(request.besichtigungDate)}${request.besichtigungTime ? ` um ${request.besichtigungTime} Uhr` : ""} für "${request.offerTitle}".`,
          metadata: {
            offer_id: request.offerId,
            offer_title: request.offerTitle,
            customer_name: request.customerName,
            customer_email: request.customerEmail,
            customer_phone: request.customerPhone,
            besichtigung_date: request.besichtigungDate,
            besichtigung_time: request.besichtigungTime,
            customer_note: request.customerNote,
          },
        });

      if (notificationError) {
        logStep("Error creating in-app notification", { error: notificationError });
      } else {
        logStep("In-app notification created successfully");
      }
    }

    // Send confirmation email to customer
    const customerEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
          <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              ✅ Besichtigungsanfrage erhalten
            </h1>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <p style="margin-top: 0;">Guten Tag ${request.customerName},</p>
            
            <p>vielen Dank für Ihre Besichtigungsanfrage. Wir haben diese erfolgreich erhalten und weitergeleitet.</p>
            
            <div style="background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px;">📅 Ihr gewünschter Termin</h3>
              <p style="margin: 0; font-size: 18px; font-weight: 600; color: #14532d;">
                ${formatDate(request.besichtigungDate)}${request.besichtigungTime ? ` um ${request.besichtigungTime} Uhr` : ""}
              </p>
            </div>
            
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Offerte:</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${request.offerTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Anbieter:</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${request.companyName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Offertenbetrag:</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formatCurrency(request.offerTotal)}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #1e40af;">
                <strong>📞 Nächste Schritte:</strong><br>
                <strong>${request.companyName}</strong> wird sich in Kürze bei Ihnen melden, um den Besichtigungstermin zu bestätigen oder einen alternativen Termin vorzuschlagen.
              </p>
            </div>
            
            <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
              Mit freundlichen Grüssen<br>
              <strong>${isCompanyEmail ? request.companyName : "Ihr ${getAppName()} Team"}</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
            <p>Diese E-Mail wurde automatisch${isCompanyEmail ? ` von ${request.companyName}` : " von ${getAppName()}"} gesendet.</p>
          </div>
        </body>
      </html>
    `;

    const customerEmailSubject = `✅ Ihre Besichtigungsanfrage bei ${request.companyName} wurde erhalten`;
    
    const { data: customerData, error: customerError } = await resend.emails.send({
      from: fromAddress,
      to: [request.customerEmail],
      subject: customerEmailSubject,
      html: customerEmailHtml,
    });

    if (customerError) {
      logStep("Error sending customer confirmation email", { error: customerError });
      
      await logEmail({
        recipientEmail: request.customerEmail,
        recipientName: request.customerName,
        subject: customerEmailSubject,
        emailType: "besichtigung_confirmation",
        status: "failed",
        errorMessage: JSON.stringify(customerError),
        companyId: request.companyId,
        metadata: { 
          offerTitle: request.offerTitle, 
          besichtigungDate: request.besichtigungDate,
          offerId: request.offerId,
          isCompanyEmail,
        },
      });
      // Don't throw here - company email was sent successfully
    } else {
      logStep("Customer confirmation email sent successfully", { emailId: customerData?.id, isCompanyEmail });

      await logEmail({
        recipientEmail: request.customerEmail,
        recipientName: request.customerName,
        subject: customerEmailSubject,
        emailType: "besichtigung_confirmation",
        status: "sent",
        companyId: request.companyId,
        metadata: { 
          offerTitle: request.offerTitle, 
          besichtigungDate: request.besichtigungDate,
          offerId: request.offerId,
          isCompanyEmail,
        },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        companyEmailId: data?.id,
        customerEmailId: customerData?.id,
        customerEmailSent: !customerError,
        isCompanyEmail,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error in notify-besichtigung", { error: errorMessage });
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
