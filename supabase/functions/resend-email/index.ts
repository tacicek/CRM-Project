import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendEmailRequest {
  emailLogId: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[resend-email] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { emailLogId }: ResendEmailRequest = await req.json();
    logStep("Processing resend request", { emailLogId });

    // Fetch the original email log
    const { data: emailLog, error: fetchError } = await supabase
      .from("email_logs")
      .select("*")
      .eq("id", emailLogId)
      .single();

    if (fetchError || !emailLog) {
      logStep("Email log not found", { error: fetchError });
      throw new Error("E-Mail-Log nicht gefunden");
    }

    logStep("Found email log", { 
      type: emailLog.email_type, 
      recipient: emailLog.recipient_email,
      originalStatus: emailLog.status 
    });

    // Generate email content based on type
    let emailHtml = "";
    let subject = emailLog.subject;

    // Generic retry email template
    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📧 Erneut gesendet</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 20px 0;">Guten Tag${emailLog.recipient_name ? ` <strong>${emailLog.recipient_name}</strong>` : ""},</p>
          
          <p>Diese E-Mail wurde erneut an Sie gesendet, da die ursprüngliche Zustellung fehlgeschlagen ist.</p>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #666;"><strong>Ursprünglicher Betreff:</strong></p>
            <p style="margin: 10px 0 0 0;">${emailLog.subject}</p>
          </div>
          
          <p style="color: #666;">Bitte melden Sie sich in Ihrem Konto an, um weitere Details zu sehen, oder kontaktieren Sie uns bei Fragen.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              Bei Fragen stehen wir Ihnen gerne zur Verfügung.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Diese E-Mail wurde automatisch generiert.</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ${getAppName()}</p>
        </div>
      </body>
      </html>
    `;

    // Send the email
    const emailResponse = await resend.emails.send({
      from: getDefaultFrom(),
      to: [emailLog.recipient_email],
      subject: `[Erneut gesendet] ${subject}`,
      html: emailHtml,
    });

    if (emailResponse.error) {
      logStep("Email send failed", { error: emailResponse.error });
      
      // Update the log with new error
      await supabase
        .from("email_logs")
        .update({
          error_message: `Retry failed: ${JSON.stringify(emailResponse.error)}`,
        })
        .eq("id", emailLogId);

      throw new Error("E-Mail konnte nicht gesendet werden");
    }

    logStep("Email resent successfully", { to: emailLog.recipient_email });

    // Create a new log entry for the resent email
    await supabase.from("email_logs").insert({
      recipient_email: emailLog.recipient_email,
      recipient_name: emailLog.recipient_name,
      subject: `[Erneut gesendet] ${subject}`,
      email_type: `${emailLog.email_type}_resend`,
      status: "sent",
      company_id: emailLog.company_id,
      lead_id: emailLog.lead_id,
      metadata: { 
        ...emailLog.metadata, 
        original_email_id: emailLogId,
        resent_at: new Date().toISOString() 
      },
    });

    // Update original log to mark it as resolved
    await supabase
      .from("email_logs")
      .update({
        metadata: { 
          ...emailLog.metadata, 
          resent_at: new Date().toISOString(),
          resent: true 
        },
      })
      .eq("id", emailLogId);

    return new Response(
      JSON.stringify({ success: true, message: "E-Mail erfolgreich erneut gesendet" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
