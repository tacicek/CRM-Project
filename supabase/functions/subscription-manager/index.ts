/**
 * Subscription Manager Edge Function
 * - Sends expiry reminder emails
 * - Deactivates expired subscriptions
 * - Should be called by a cron job daily
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompanyReminder {
  company_id: string;
  company_name: string;
  email: string;
  notification_email: string | null;
  expires_at: string;
  days_until_expiry: number;
  reminder_type: string;
  last_reminder_type: string | null;
}

interface DeactivatedCompany {
  company_id: string;
  company_name: string;
  email: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Detect caller: cron job sends service_role JWT, frontend sends user JWT
    const authHeader = req.headers.get("Authorization");
    let supabase;

    // Decode JWT payload to check the "role" claim (no signature verification needed here)
    const isServiceRoleCall = (() => {
      if (!authHeader) return false;
      try {
        const token = authHeader.replace("Bearer ", "");
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload?.role === "service_role";
      } catch {
        return false;
      }
    })();

    if (isServiceRoleCall || !authHeader) {
      // Called from cron job with service_role key — bypass user auth
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    } else {
      // Called from frontend — verify the user is an admin
      const token = authHeader.replace("Bearer ", "");
      const tempClient = createClient(supabaseUrl, supabaseServiceKey);

      const { data: { user }, error: userError } = await tempClient.auth.getUser(token);

      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }

      const { data: roleData, error: roleError } = await tempClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleError || !roleData || !["admin", "super_admin", "moderator"].includes(roleData.role)) {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: Admin access required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const results = {
      reminders_sent: 0,
      reminders_failed: 0,
      subscriptions_deactivated: 0,
      errors: [] as string[],
    };

    // 1. Get companies needing reminders
    const { data: companiesNeedingReminders, error: reminderError } = await supabase
      .rpc("get_companies_needing_reminders");

    if (reminderError) {
      console.error("Error getting companies needing reminders:", reminderError);
      results.errors.push(`Reminder query error: ${reminderError.message}`);
    }

    // 2. Process reminders
    if (companiesNeedingReminders && resend) {
      for (const company of companiesNeedingReminders as CompanyReminder[]) {
        // Skip if we already sent this reminder type
        if (company.last_reminder_type === company.reminder_type) {
          continue;
        }

        // Skip if no reminder needed
        if (!company.reminder_type) {
          continue;
        }

        try {
          const emailTo = company.notification_email || company.email;
          const subject = getEmailSubject(company.reminder_type, company.days_until_expiry);
          const html = getEmailHtml(company);

          // Send email
          const emailResult = await resend.emails.send({
            from: "Offerio <info@offerio.ch>",
            to: emailTo,
            subject,
            html,
          });

          // Log reminder
          await supabase.from("subscription_reminders").insert({
            company_id: company.company_id,
            reminder_type: company.reminder_type,
            email_sent_to: emailTo,
            success: true,
          });

          // Update company's last reminder
          await supabase
            .from("companies")
            .update({
              last_reminder_sent_at: new Date().toISOString(),
              last_reminder_type: company.reminder_type,
            })
            .eq("id", company.company_id);

          results.reminders_sent++;
          console.log(`Reminder sent to ${emailTo} for ${company.company_name}`);
        } catch (emailError) {
          console.error(`Failed to send reminder to ${company.company_name}:`, emailError);
          
          // Log failed reminder
          await supabase.from("subscription_reminders").insert({
            company_id: company.company_id,
            reminder_type: company.reminder_type,
            email_sent_to: company.notification_email || company.email,
            success: false,
            error_message: String(emailError),
          });

          results.reminders_failed++;
        }
      }
    }

    // 3. Deactivate expired subscriptions
    const { data: deactivatedCompanies, error: deactivateError } = await supabase
      .rpc("deactivate_expired_subscriptions");

    if (deactivateError) {
      console.error("Error deactivating subscriptions:", deactivateError);
      results.errors.push(`Deactivation error: ${deactivateError.message}`);
    }

    if (deactivatedCompanies) {
      results.subscriptions_deactivated = deactivatedCompanies.length;

      // Send deactivation emails
      if (resend) {
        for (const company of deactivatedCompanies as DeactivatedCompany[]) {
          try {
            await resend.emails.send({
              from: "Offerio <info@offerio.ch>",
              to: company.email,
              subject: "⚠️ Ihr Offerio CRM-Abo ist abgelaufen",
              html: getDeactivationEmailHtml(company),
            });

            // Log deactivation reminder
            await supabase.from("subscription_reminders").insert({
              company_id: company.company_id,
              reminder_type: "deactivated",
              email_sent_to: company.email,
              success: true,
            });

            console.log(`Deactivation email sent to ${company.email}`);
          } catch (emailError) {
            console.error(`Failed to send deactivation email to ${company.company_name}:`, emailError);
          }
        }
      }
    }

    // 4. Send admin summary if there were any actions
    if (results.reminders_sent > 0 || results.subscriptions_deactivated > 0) {
      if (resend) {
        try {
          await resend.emails.send({
            from: "Offerio System <info@offerio.ch>",
            to: "info@offerio.ch",
            subject: `📊 CRM-Abo Manager: ${results.reminders_sent} Erinnerungen, ${results.subscriptions_deactivated} deaktiviert`,
            html: getAdminSummaryHtml(results, companiesNeedingReminders || [], deactivatedCompanies || []),
          });
        } catch (emailError) {
          console.error("Failed to send admin summary:", emailError);
        }
      }
    }

    console.log("Subscription manager completed:", results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Subscription manager error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function getEmailSubject(reminderType: string, daysUntilExpiry: number): string {
  switch (reminderType) {
    case "expiry_30_days":
      return "📅 Ihr Offerio CRM-Abo läuft in 30 Tagen ab";
    case "expiry_14_days":
      return "📅 Ihr Offerio CRM-Abo läuft in 14 Tagen ab";
    case "expiry_7_days":
      return "⏰ Ihr Offerio CRM-Abo läuft in 7 Tagen ab";
    case "expiry_3_days":
      return "⚠️ Ihr Offerio CRM-Abo läuft in 3 Tagen ab";
    case "expiry_1_day":
      return "🚨 Ihr Offerio CRM-Abo läuft MORGEN ab!";
    case "expired":
      return "❌ Ihr Offerio CRM-Abo ist HEUTE abgelaufen";
    default:
      return `Ihr Offerio CRM-Abo läuft in ${daysUntilExpiry} Tagen ab`;
  }
}

function getEmailHtml(company: CompanyReminder): string {
  const expiryDate = new Date(company.expires_at).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const urgencyColor = company.days_until_expiry <= 3 ? "#ef4444" : 
                       company.days_until_expiry <= 7 ? "#f59e0b" : "#8b5cf6";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
    <div style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="https://offerio.ch/logo.png" alt="Offerio" style="height: 40px; margin-bottom: 20px;">
      <h1 style="color: white; margin: 0; font-size: 24px;">CRM-Abo Erinnerung</h1>
    </div>
    
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="font-size: 16px;">Hallo <strong>${company.company_name}</strong>,</p>
      
      <div style="background: ${urgencyColor}10; border-left: 4px solid ${urgencyColor}; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-size: 18px;">
          ${company.days_until_expiry <= 0 
            ? "Ihr CRM-Abo ist <strong>heute abgelaufen</strong>." 
            : `Ihr CRM-Abo läuft in <strong>${company.days_until_expiry} Tag${company.days_until_expiry === 1 ? "" : "en"}</strong> ab.`}
        </p>
        <p style="margin: 10px 0 0 0; color: #6b7280;">
          Ablaufdatum: <strong>${expiryDate}</strong>
        </p>
      </div>

      <h3 style="color: #374151;">Was passiert nach Ablauf?</h3>
      <ul style="color: #4b5563; padding-left: 20px;">
        <li>Kein Zugriff auf Kalender & Termine</li>
        <li>Kein Zugriff auf Offerten-System</li>
        <li>Kein Zugriff auf Team-Verwaltung</li>
        <li>Keine Besichtigungen-Verwaltung</li>
        <li>Keine Umzugsboxen-Tracking</li>
      </ul>
      
      <p style="color: #4b5563;">Sie behalten weiterhin Zugriff auf:</p>
      <ul style="color: #4b5563; padding-left: 20px;">
        <li>Dashboard & Statistiken</li>
        <li>Token-Kauf für Anfragen</li>
        <li>Einstellungen</li>
        <li>Datenarchiv</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="mailto:info@offerio.ch?subject=CRM-Abo%20Verlängerung%20-%20${encodeURIComponent(company.company_name)}" 
           style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Jetzt verlängern
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
        Bei Fragen kontaktieren Sie uns gerne:<br>
        📧 info@offerio.ch | 📞 +41 79 336 34 02
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function getDeactivationEmailHtml(company: DeactivatedCompany): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="https://offerio.ch/logo.png" alt="Offerio" style="height: 40px; margin-bottom: 20px;">
      <h1 style="color: white; margin: 0; font-size: 24px;">CRM-Abo deaktiviert</h1>
    </div>
    
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="font-size: 16px;">Hallo <strong>${company.company_name}</strong>,</p>
      
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-size: 16px; color: #dc2626;">
          Ihr CRM-Abo wurde automatisch deaktiviert, da die Zahlungsfrist abgelaufen ist.
        </p>
      </div>

      <h3 style="color: #374151;">Ihre Daten sind sicher</h3>
      <p style="color: #4b5563;">
        Alle Ihre CRM-Daten (Offerten, Termine, etc.) bleiben für 90 Tage gespeichert. 
        Sie können jederzeit reaktivieren und sofort auf alle Daten zugreifen.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="mailto:info@offerio.ch?subject=CRM-Abo%20Reaktivierung%20-%20${encodeURIComponent(company.company_name)}" 
           style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Jetzt reaktivieren
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
        Bei Fragen kontaktieren Sie uns gerne:<br>
        📧 info@offerio.ch | 📞 +41 79 336 34 02
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function getAdminSummaryHtml(
  results: { reminders_sent: number; reminders_failed: number; subscriptions_deactivated: number; errors: string[] },
  companiesReminded: CompanyReminder[],
  companiesDeactivated: DeactivatedCompany[]
): string {
  const now = new Date().toLocaleString("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="width:100%;max-width:100%;box-sizing:border-box;margin:0;">
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 20px; border-radius: 12px 12px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 20px;">📊 CRM-Abo Manager Report</h1>
      <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">${now}</p>
    </div>
    
    <div style="background: white; padding: 20px; border-radius: 0 0 12px 12px;">
      <div style="display: flex; gap: 15px; margin-bottom: 20px;">
        <div style="flex: 1; background: #f0fdf4; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${results.reminders_sent}</div>
          <div style="font-size: 12px; color: #15803d;">Erinnerungen gesendet</div>
        </div>
        <div style="flex: 1; background: #fef2f2; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${results.subscriptions_deactivated}</div>
          <div style="font-size: 12px; color: #b91c1c;">Deaktiviert</div>
        </div>
      </div>
      
      ${companiesReminded.filter(c => c.reminder_type).length > 0 ? `
      <h3 style="color: #374151; margin-top: 20px;">Erinnerungen gesendet an:</h3>
      <ul style="color: #4b5563; padding-left: 20px;">
        ${companiesReminded.filter(c => c.reminder_type).map(c => 
          `<li>${c.company_name} - ${c.reminder_type} (${c.days_until_expiry} Tage)</li>`
        ).join("")}
      </ul>
      ` : ""}
      
      ${companiesDeactivated.length > 0 ? `
      <h3 style="color: #dc2626; margin-top: 20px;">Abos deaktiviert:</h3>
      <ul style="color: #4b5563; padding-left: 20px;">
        ${companiesDeactivated.map(c => 
          `<li>${c.company_name} (${c.email})</li>`
        ).join("")}
      </ul>
      ` : ""}
      
      ${results.errors.length > 0 ? `
      <h3 style="color: #f59e0b; margin-top: 20px;">Fehler:</h3>
      <ul style="color: #92400e; padding-left: 20px;">
        ${results.errors.map(e => `<li>${e}</li>`).join("")}
      </ul>
      ` : ""}
    </div>
  </div>
</body>
</html>
  `;
}

