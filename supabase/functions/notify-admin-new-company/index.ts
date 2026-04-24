import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewCompanyRequest {
  company_id: string;
  company_name: string;
  email: string;
  plz?: string;
  city?: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[NOTIFY-ADMIN-NEW-COMPANY] ${step}`, details ? JSON.stringify(details) : "");
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { company_id, company_name, email, plz, city }: NewCompanyRequest = await req.json();
    logStep("Processing new company notification", { company_id, company_name, email });

    // Get admin emails (super_admin, admin, moderator)
    const { data: admins, error: adminError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["super_admin", "admin", "moderator"]);

    if (adminError) {
      logStep("Error fetching admins", { error: adminError });
      throw adminError;
    }

    if (!admins || admins.length === 0) {
      logStep("No admins found");
      return new Response(
        JSON.stringify({ success: false, message: "No admins found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin emails from auth.users
    const adminIds = admins.map(a => a.user_id);
    const { data: adminUsers, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      logStep("Error fetching admin users", { error: usersError });
      throw usersError;
    }

    const adminEmails = adminUsers.users
      .filter(u => adminIds.includes(u.id))
      .map(u => u.email)
      .filter(Boolean) as string[];

    logStep("Admin emails found", { count: adminEmails.length });

    if (!resendApiKey) {
      logStep("No Resend API key - skipping email");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const adminDashboardUrl = "https://dash.offerio.ch/admin/companies";

    // Send email to each admin
    for (const adminEmail of adminEmails) {
      try {
        await resend.emails.send({
          from: "Offerio <noreply@offerio.ch>",
          to: [adminEmail],
          subject: `🏢 Neue Firma registriert: ${company_name}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🏢 Neue Firma registriert!</h1>
              </div>
              
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
                <p style="font-size: 16px; margin-top: 0;">
                  Eine neue Firma hat sich bei Offerio registriert:
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Firmenname:</td>
                      <td style="padding: 8px 0; font-weight: 600;">${company_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">E-Mail:</td>
                      <td style="padding: 8px 0;">${email}</td>
                    </tr>
                    ${plz && city ? `
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Standort:</td>
                      <td style="padding: 8px 0;">${plz} ${city}</td>
                    </tr>
                    ` : ""}
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Status:</td>
                      <td style="padding: 8px 0;">
                        <span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
                          ⏳ Wartet auf Verifizierung
                        </span>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                  <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>⚠️ Aktion erforderlich:</strong><br>
                    Bitte verifizieren Sie die Firma im Admin-Dashboard, damit sie Anfragen erhalten kann.
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 24px;">
                  <a href="${adminDashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                    Firma verifizieren →
                  </a>
                </div>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p style="margin: 0;">
                  © ${new Date().getFullYear()} Offerio – Admin-Benachrichtigung
                </p>
              </div>
            </body>
            </html>
          `,
        });
        logStep(`Email sent to admin: ${adminEmail}`);
      } catch (emailError) {
        logStep(`Failed to send email to ${adminEmail}`, { error: String(emailError) });
      }
    }

    // Also send welcome email to the new company
    try {
      await resend.emails.send({
        from: "Offerio <noreply@offerio.ch>",
        to: [email],
        subject: `Willkommen bei Offerio, ${company_name}! 🎉`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Willkommen bei Offerio! 🎉</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">
                Hallo ${company_name},
              </p>
              
              <p>
                Vielen Dank für Ihre Registrierung bei Offerio! Wir freuen uns, Sie als Partner begrüssen zu dürfen.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #6366f1;">Was passiert als nächstes?</h3>
                <ol style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px;">
                    <strong>E-Mail bestätigen:</strong> Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen gesendet haben.
                  </li>
                  <li style="margin-bottom: 12px;">
                    <strong>Verifizierung:</strong> Unser Team wird Ihr Firmenprofil prüfen und freischalten.
                  </li>
                  <li style="margin-bottom: 12px;">
                    <strong>Anfragen erhalten:</strong> Nach der Freischaltung erhalten Sie qualifizierte Kundenanfragen!
                  </li>
                </ol>
              </div>
              
              <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
                <p style="margin: 0; color: #065f46; font-size: 14px;">
                  <strong>🎁 Startguthaben:</strong><br>
                  Sie haben 50 Tokens als Startguthaben erhalten!
                </p>
              </div>
              
              <p>
                Bei Fragen stehen wir Ihnen gerne zur Verfügung.
              </p>
              
              <p style="margin-bottom: 0;">
                Mit freundlichen Grüssen,<br>
                <strong>Ihr Offerio Team</strong>
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">
                © ${new Date().getFullYear()} Offerio<br>
                <a href="https://offerio.ch" style="color: #6366f1;">www.offerio.ch</a>
              </p>
            </div>
          </body>
          </html>
        `,
      });
      logStep("Welcome email sent to company");
    } catch (emailError) {
      logStep("Failed to send welcome email", { error: String(emailError) });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Admin notified and welcome email sent",
        admins_notified: adminEmails.length
      }),
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
};

serve(handler);

