import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyCancelledRequest {
  appointmentId: string;
  appointmentTitle: string;
  appointmentDate: string;
  appointmentTime: string;
  customerName: string;
  customerEmail: string | null;
  cancellationReason: string | null;
  companyEmail: string;
  companyName: string;
  companyId: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[notify-appointment-cancelled] ${step}`, details ? JSON.stringify(details) : "");
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: NotifyCancelledRequest = await req.json();
    
    logStep("Processing cancellation notification", {
      appointmentId: request.appointmentId,
      customerName: request.customerName,
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
    let fromAddress = getCalendarFrom();
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
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
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

    const formatTime = (timeStr: string) => {
      return timeStr.substring(0, 5);
    };

    // Email to company
    const companyEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
          <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              ❌ Termin abgesagt
            </h1>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <p style="margin-top: 0;">Guten Tag,</p>
            
            <p>Der Kunde <strong>${request.customerName || "Unbekannt"}</strong> hat den folgenden Termin abgesagt:</p>
            
            <div style="background: #FEE2E2; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 15px 0; color: #991B1B; font-size: 16px;">${request.appointmentTitle}</h3>
              <p style="margin: 0; font-size: 16px; color: #7F1D1D;">
                📅 ${formatDate(request.appointmentDate)}<br>
                🕐 ${formatTime(request.appointmentTime)} Uhr
              </p>
            </div>
            
            ${request.cancellationReason ? `
              <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400E;">📝 Absagegrund:</p>
                <p style="margin: 0; color: #78350F;">${request.cancellationReason}</p>
              </div>
            ` : ""}
            
            ${request.customerEmail ? `
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Kundenkontakt:</p>
                <p style="margin: 0;">
                  <a href="mailto:${request.customerEmail}" style="color: #3b82f6;">${request.customerEmail}</a>
                </p>
              </div>
            ` : ""}
            
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

    const companyEmailSubject = `❌ Termin abgesagt: "${request.appointmentTitle}" von ${request.customerName || "Kunde"}`;
    
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [request.companyEmail],
      subject: companyEmailSubject,
      html: companyEmailHtml,
    });

    if (error) {
      logStep("Error sending company email", { error });
      
      await logEmail({
        recipientEmail: request.companyEmail,
        recipientName: request.companyName,
        subject: companyEmailSubject,
        emailType: "appointment_cancelled",
        status: "failed",
        errorMessage: JSON.stringify(error),
        companyId: request.companyId,
        metadata: { 
          appointmentId: request.appointmentId,
          appointmentTitle: request.appointmentTitle,
          isCompanyEmail,
        },
      });
      
      throw error;
    }

    logStep("Company email sent successfully", { emailId: data?.id, isCompanyEmail });

    await logEmail({
      recipientEmail: request.companyEmail,
      recipientName: request.companyName,
      subject: companyEmailSubject,
      emailType: "appointment_cancelled",
      status: "sent",
      companyId: request.companyId,
      metadata: { 
        appointmentId: request.appointmentId,
        appointmentTitle: request.appointmentTitle,
        isCompanyEmail,
      },
    });

    // Send confirmation to customer if email available
    if (request.customerEmail) {
      const customerEmailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
            <div style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); padding: 30px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">
                ✅ Absage bestätigt
              </h1>
            </div>
            
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin-top: 0;">Guten Tag ${request.customerName},</p>
              
              <p>Ihre Terminabsage wurde erfolgreich verarbeitet und <strong>${request.companyName}</strong> wurde benachrichtigt.</p>
              
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 16px;">Abgesagter Termin:</h3>
                <p style="margin: 0; color: #6B7280;">
                  <strong>${request.appointmentTitle}</strong><br>
                  📅 ${formatDate(request.appointmentDate)}<br>
                  🕐 ${formatTime(request.appointmentTime)} Uhr
                </p>
              </div>
              
              <p>Falls Sie einen neuen Termin vereinbaren möchten, kontaktieren Sie bitte <strong>${request.companyName}</strong> direkt.</p>
              
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

      try {
        await resend.emails.send({
          from: fromAddress,
          to: [request.customerEmail],
          subject: `✅ Terminabsage bestätigt - ${request.appointmentTitle}`,
          html: customerEmailHtml,
        });
        
        logStep("Customer confirmation email sent", { isCompanyEmail });
      } catch (customerEmailError) {
        logStep("Failed to send customer confirmation email", { error: customerEmailError });
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailId: data?.id, isCompanyEmail }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error in notify-appointment-cancelled", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
