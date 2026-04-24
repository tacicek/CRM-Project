import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";
import { getDashboardAppBaseUrl } from "../_shared/dashboardAppUrl.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TokenNotificationRequest {
  companyId: string;
  type: "manual_add" | "purchase" | "spend";
  previousBalance: number;
  newBalance: number;
  amount: number;
  description?: string;
  leadInfo?: {
    slug?: string;
    serviceType: string;
    fromPlz?: string;
    fromCity: string;
    toPlz?: string;
    toCity?: string;
    preferredDate?: string;
    fromRooms?: number;
    fromLivingSpaceM2?: number;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    description?: string;
  };
}

const getSubjectAndTitle = (type: string, amount: number) => {
  switch (type) {
    case "manual_add":
      return {
        subject: `Token-Gutschrift: +${amount} Token hinzugefügt`,
        title: "Token-Gutschrift erhalten",
        icon: "🎁",
      };
    case "purchase":
      return {
        subject: `Token-Kauf bestätigt: +${amount} Token`,
        title: "Token-Kauf erfolgreich",
        icon: "💳",
      };
    case "spend":
      return {
        subject: `Token verwendet: -${amount} Token für Lead`,
        title: "Token für Lead verwendet",
        icon: "📋",
      };
    default:
      return {
        subject: "Token-Benachrichtigung",
        title: "Token-Aktualisierung",
        icon: "🔔",
      };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, type, previousBalance, newBalance, amount, description, leadInfo }: TokenNotificationRequest = await req.json();

    console.log("[send-token-notification] Processing:", { companyId, type, amount });

    // Get company details
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("company_name, email, notification_email")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      console.error("[send-token-notification] Company not found:", companyError);
      throw new Error("Firma nicht gefunden");
    }

    const recipientEmail = company.notification_email || company.email;
    const firmaAnfragenUrl = `${getDashboardAppBaseUrl()}/firma/anfragen`;
    const { subject, title, icon } = getSubjectAndTitle(type, amount);

    // Build email content based on type
    let detailsHtml = "";
    
    if (type === "manual_add") {
      detailsHtml = `
        <p style="margin: 0 0 10px 0;">Ihrem Konto wurden Token gutgeschrieben:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Vorheriger Stand:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${previousBalance} Token</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Gutschrift:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #22c55e;">+${amount} Token</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; font-weight: bold;">Neuer Stand:</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 18px; color: #6366f1;">${newBalance} Token</td>
          </tr>
        </table>
        ${description ? `<p style="margin: 10px 0; color: #666;">Grund: ${description}</p>` : ""}
      `;
    } else if (type === "purchase") {
      detailsHtml = `
        <p style="margin: 0 0 10px 0;">Vielen Dank für Ihren Token-Kauf!</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Vorheriger Stand:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${previousBalance} Token</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Gekaufte Token:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #22c55e;">+${amount} Token</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; font-weight: bold;">Neuer Stand:</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 18px; color: #6366f1;">${newBalance} Token</td>
          </tr>
        </table>
        <p style="margin: 10px 0; color: #666;">Die Token stehen Ihnen ab sofort zur Verfügung.</p>
      `;
    } else if (type === "spend") {
      const preferredDateStr = leadInfo?.preferredDate
        ? new Date(leadInfo.preferredDate).toLocaleDateString("de-CH")
        : null;

      const locationStr = leadInfo?.toCity
        ? `${leadInfo.fromPlz ?? ""} ${leadInfo.fromCity} → ${leadInfo.toPlz ?? ""} ${leadInfo.toCity}`
        : `${leadInfo?.fromPlz ?? ""} ${leadInfo?.fromCity ?? ""}`;

      detailsHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px;">Sie haben einen Lead erfolgreich angenommen und die Kundendaten sind nun für Sie freigeschaltet.</p>

        ${leadInfo ? `
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 14px 0; color: #15803d; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">📋 Anfrage-Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${leadInfo.slug ? `<tr><td style="padding: 6px 0; color: #555; font-size: 13px; width: 45%;">Anfrage-Nr.:</td><td style="padding: 6px 0; font-weight: 600; font-size: 13px;">${leadInfo.slug}</td></tr>` : ""}
            <tr><td style="padding: 6px 0; color: #555; font-size: 13px;">Service:</td><td style="padding: 6px 0; font-weight: 600; font-size: 13px;">${leadInfo.serviceType}</td></tr>
            <tr><td style="padding: 6px 0; color: #555; font-size: 13px;">Standort:</td><td style="padding: 6px 0; font-weight: 600; font-size: 13px;">${locationStr.trim()}</td></tr>
            ${preferredDateStr ? `<tr><td style="padding: 6px 0; color: #555; font-size: 13px;">Wunschtermin:</td><td style="padding: 6px 0; font-weight: 600; font-size: 13px;">${preferredDateStr}</td></tr>` : ""}
            ${leadInfo.fromRooms ? `<tr><td style="padding: 6px 0; color: #555; font-size: 13px;">Zimmer:</td><td style="padding: 6px 0; font-weight: 600; font-size: 13px;">${leadInfo.fromRooms}</td></tr>` : ""}
            ${leadInfo.fromLivingSpaceM2 ? `<tr><td style="padding: 6px 0; color: #555; font-size: 13px;">Wohnfläche:</td><td style="padding: 6px 0; font-weight: 600; font-size: 13px;">${leadInfo.fromLivingSpaceM2} m²</td></tr>` : ""}
            ${leadInfo.description ? `<tr><td style="padding: 6px 0; color: #555; font-size: 13px; vertical-align: top;">Bemerkungen:</td><td style="padding: 6px 0; font-size: 13px;">${leadInfo.description}</td></tr>` : ""}
          </table>
        </div>

        <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 14px 0; color: #1d4ed8; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">👤 Kundendaten</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #555; font-size: 13px; width: 45%;">Name:</td><td style="padding: 6px 0; font-weight: 700; font-size: 14px;">${leadInfo.customerName}</td></tr>
            ${leadInfo.customerPhone ? `<tr><td style="padding: 6px 0; color: #555; font-size: 13px;">Telefon:</td><td style="padding: 6px 0; font-weight: 600; font-size: 14px;"><a href="tel:${leadInfo.customerPhone}" style="color: #1d4ed8; text-decoration: none;">${leadInfo.customerPhone}</a></td></tr>` : ""}
            ${leadInfo.customerEmail ? `<tr><td style="padding: 6px 0; color: #555; font-size: 13px;">E-Mail:</td><td style="padding: 6px 0; font-weight: 600; font-size: 14px;"><a href="mailto:${leadInfo.customerEmail}" style="color: #1d4ed8; text-decoration: none;">${leadInfo.customerEmail}</a></td></tr>` : ""}
          </table>
        </div>
        ` : ""}

        <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">Token-Abrechnung</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 13px;">Vorheriger Stand:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 13px;">${previousBalance} Token</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 13px;">Verwendet:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 700; font-size: 13px; color: #ef4444;">-${amount} Token</td>
            </tr>
            <tr style="border-top: 1px solid #e5e7eb;">
              <td style="padding: 8px 0 0 0; font-weight: 700; font-size: 14px;">Neuer Stand:</td>
              <td style="padding: 8px 0 0 0; text-align: right; font-weight: 700; font-size: 18px; color: #6366f1;">${newBalance} Token</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="background-color: #1d4ed8; border-radius: 8px;">
                <a href="${firmaAnfragenUrl}" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 13px 28px; font-weight: 700; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                  ➜ Zum Dashboard – Offerte erstellen
                </a>
              </td>
            </tr>
          </table>
        </div>
      `;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${icon} ${title}</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 20px 0;">Guten Tag <strong>${company.company_name}</strong>,</p>
          
          ${detailsHtml}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              Bei Fragen stehen wir Ihnen gerne zur Verfügung.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Diese E-Mail wurde automatisch generiert.</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} Offerio</p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Offerio <noreply@offerio.ch>",
        to: [recipientEmail],
        subject: subject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("[send-token-notification] Resend error:", errorText);
      
      await logEmail({
        recipientEmail,
        recipientName: company.company_name,
        subject,
        emailType: `token_${type}`,
        status: "failed",
        errorMessage: errorText,
        companyId,
        metadata: { type, amount, previousBalance, newBalance },
      });
      
      throw new Error("E-Mail konnte nicht gesendet werden");
    }

    const emailResult = await emailResponse.json();
    console.log("[send-token-notification] Email sent:", emailResult);

    await logEmail({
      recipientEmail,
      recipientName: company.company_name,
      subject,
      emailType: `token_${type}`,
      status: "sent",
      companyId,
      metadata: { type, amount, previousBalance, newBalance },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[send-token-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
