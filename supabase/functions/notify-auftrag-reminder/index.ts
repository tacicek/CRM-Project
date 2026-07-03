/**
 * Auftrag Reminder Edge Function
 * Sends PDF work order to team leaders for upcoming jobs
 * Should be called daily by a cron job
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuftragReminder {
  auftrag_id: string;
  company_id: string;
  company_name: string;
  company_email: string;
  auftrag_nummer: string;
  title: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  from_address: string;
  to_address: string;
  scheduled_date: string;
  scheduled_time: string;
  estimated_duration_minutes: number;
  description: string;
  special_instructions: string;
  team_leader_id: string;
  team_leader_name: string;
  team_leader_email: string;
  assigned_team_members: string[];
}

interface CustomerReminder {
  auftrag_id: string;
  company_id: string;
  company_name: string;
  auftrag_nummer: string;
  title: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  from_address: string;
  to_address: string;
  scheduled_date: string;
  scheduled_time: string;
  estimated_duration_minutes: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("INTERNAL_CRON_SECRET");
  if (!cronSecret) {
    console.error("INTERNAL_CRON_SECRET not configured — refusing to run (fail closed)");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const providedSecret = req.headers.get("x-internal-secret");
  if (providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const globalResendKey = resendApiKey;

    const results = {
      reminders_sent: 0,
      reminders_failed: 0,
      customer_reminders_sent: 0,
      customer_reminders_failed: 0,
      errors: [] as string[],
    };

    // Get auftraege needing reminders
    const { data: auftraege, error: queryError } = await supabase
      .rpc("get_auftraege_needing_reminders");

    if (queryError) {
      console.error("Error getting auftraege:", queryError);
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!auftraege || auftraege.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No reminders to send", ...results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get team members for each auftrag
    for (const auftrag of auftraege as AuftragReminder[]) {
      try {
        // Fetch company Resend settings for per-company key support
        const { data: companySettings } = await supabase
          .from("companies")
          .select("resend_enabled, resend_api_key, resend_from_email, resend_from_name")
          .eq("id", auftrag.company_id)
          .maybeSingle();

        const activeResendKey = (companySettings?.resend_enabled && companySettings?.resend_api_key)
          ? companySettings.resend_api_key
          : globalResendKey;

        if (!activeResendKey) {
          console.error(`No Resend key for company ${auftrag.company_id}, skipping Auftrag ${auftrag.auftrag_nummer}`);
          results.reminders_failed++;
          results.errors.push(`${auftrag.auftrag_nummer}: No Resend key configured`);
          continue;
        }

        const resend = new Resend(activeResendKey);
        const fromAddress = (companySettings?.resend_enabled && companySettings?.resend_from_email)
          ? `${companySettings.resend_from_name || auftrag.company_name} <${companySettings.resend_from_email}>`
          : `${auftrag.company_name} <${getAdminEmail()}>`;

        // Get assigned team members details
        let teamMembersList = "";
        if (auftrag.assigned_team_members && auftrag.assigned_team_members.length > 0) {
          const { data: members } = await supabase
            .from("team_members")
            .select("first_name, last_name, phone, email")
            .in("id", auftrag.assigned_team_members);

          if (members) {
            teamMembersList = members
              .map(m => `${m.first_name} ${m.last_name}${m.phone ? ` (${m.phone})` : ""}`)
              .join(", ");
          }
        }

        // Format date
        const scheduledDate = new Date(auftrag.scheduled_date);
        const formattedDate = scheduledDate.toLocaleDateString("de-CH", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

        // Generate PDF HTML content
        const pdfHtml = generateAuftragPdfHtml(auftrag, teamMembersList, formattedDate);

        // Encode attachment as base64 (Deno-compatible, no Buffer)
        const pdfBytes = new TextEncoder().encode(pdfHtml);
        const pdfBase64 = btoa(Array.from(pdfBytes).map(b => String.fromCharCode(b)).join(""));

        // Send email to team leader
        const emailResult = await resend.emails.send({
          from: fromAddress,
          to: auftrag.team_leader_email,
          subject: `📋 Auftrag ${auftrag.auftrag_nummer} - ${formattedDate}`,
          html: generateEmailHtml(auftrag, teamMembersList, formattedDate),
          attachments: [
            {
              filename: `Auftrag_${auftrag.auftrag_nummer}.html`,
              content: pdfBase64,
              content_type: "text/html",
            },
          ],
        });

        // Update auftrag as reminded
        await supabase
          .from("auftraege")
          .update({
            team_reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", auftrag.auftrag_id);

        results.reminders_sent++;
        console.log(`Reminder sent to ${auftrag.team_leader_email} for Auftrag ${auftrag.auftrag_nummer}`);

        // Also send copy to company email if different
        if (auftrag.company_email && auftrag.company_email !== auftrag.team_leader_email) {
          try {
            await resend.emails.send({
              from: fromAddress,
              to: auftrag.company_email,
              subject: `📋 Auftrag ${auftrag.auftrag_nummer} - Team benachrichtigt`,
              html: `
                <p>Der Team-Leiter <strong>${auftrag.team_leader_name}</strong> wurde per E-Mail über den morgigen Auftrag informiert.</p>
                <p><strong>Auftrag:</strong> ${auftrag.auftrag_nummer} - ${auftrag.title}</p>
                <p><strong>Datum:</strong> ${formattedDate}</p>
                <p><strong>Kunde:</strong> ${auftrag.customer_name}</p>
              `,
            });
          } catch (companyEmailError) {
            console.log("Could not send company copy:", companyEmailError);
          }
        }

      } catch (emailError) {
        console.error(`Failed to send reminder for Auftrag ${auftrag.auftrag_nummer}:`, emailError);
        results.reminders_failed++;
        results.errors.push(`${auftrag.auftrag_nummer}: ${String(emailError)}`);
      }
    }

    // ── Kundenerinnerungen (unabhängig vom Team-Leiter) ─────────────────────
    const { data: customerReminders, error: customerQueryError } = await supabase
      .rpc("get_auftraege_needing_customer_reminders");

    if (customerQueryError) {
      console.error("Error getting customer reminders:", customerQueryError);
    } else if (customerReminders && customerReminders.length > 0) {
      for (const auftrag of customerReminders as CustomerReminder[]) {
        try {
          if (!auftrag.customer_email) continue;

          const { data: companySettings } = await supabase
            .from("companies")
            .select("resend_enabled, resend_api_key, resend_from_email, resend_from_name")
            .eq("id", auftrag.company_id)
            .maybeSingle();

          const activeResendKey = (companySettings?.resend_enabled && companySettings?.resend_api_key)
            ? companySettings.resend_api_key
            : globalResendKey;

          if (!activeResendKey) {
            results.customer_reminders_failed++;
            results.errors.push(`${auftrag.auftrag_nummer} (Kunde): No Resend key configured`);
            continue;
          }

          const resend = new Resend(activeResendKey);
          const fromAddress = (companySettings?.resend_enabled && companySettings?.resend_from_email)
            ? `${companySettings.resend_from_name || auftrag.company_name} <${companySettings.resend_from_email}>`
            : `${auftrag.company_name} <${getAdminEmail()}>`;

          const scheduledDate = new Date(auftrag.scheduled_date);
          const formattedDate = scheduledDate.toLocaleDateString("de-CH", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          });

          await resend.emails.send({
            from: fromAddress,
            to: auftrag.customer_email,
            subject: `Erinnerung: Ihr Termin am ${formattedDate} – ${auftrag.company_name}`,
            html: generateCustomerEmailHtml(auftrag, formattedDate),
          });

          await supabase
            .from("auftraege")
            .update({
              customer_reminder_sent: true,
              customer_reminder_sent_at: new Date().toISOString(),
            })
            .eq("id", auftrag.auftrag_id);

          results.customer_reminders_sent++;
        } catch (customerError) {
          console.error(`Failed customer reminder for ${auftrag.auftrag_nummer}:`, customerError);
          results.customer_reminders_failed++;
          results.errors.push(`${auftrag.auftrag_nummer} (Kunde): ${String(customerError)}`);
        }
      }
    }

    // Send admin summary (uses global server key)
    if ((results.reminders_sent > 0 || results.customer_reminders_sent > 0) && globalResendKey) {
      try {
        const adminResend = new Resend(globalResendKey);
        await adminResend.emails.send({
          from: getDefaultFrom(),
          to: getAdminEmail(),
          subject: `📊 Auftrag-Erinnerungen: ${results.reminders_sent} gesendet`,
          html: `
            <h2>Auftrag-Erinnerungen Zusammenfassung</h2>
            <p><strong>Team gesendet:</strong> ${results.reminders_sent}</p>
            <p><strong>Team fehlgeschlagen:</strong> ${results.reminders_failed}</p>
            <p><strong>Kunden gesendet:</strong> ${results.customer_reminders_sent}</p>
            <p><strong>Kunden fehlgeschlagen:</strong> ${results.customer_reminders_failed}</p>
            ${results.errors.length > 0 ? `<p><strong>Fehler:</strong><br>${results.errors.join("<br>")}</p>` : ""}
          `,
        });
      } catch (e) {
        console.error("Failed to send admin summary:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auftrag reminder error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function generateEmailHtml(
  auftrag: AuftragReminder,
  teamMembersList: string,
  formattedDate: string
): string {
  const timeStr = auftrag.scheduled_time 
    ? auftrag.scheduled_time.substring(0, 5) + " Uhr" 
    : "Zeit noch nicht festgelegt";
  
  const durationHours = Math.floor((auftrag.estimated_duration_minutes || 120) / 60);
  const durationMins = (auftrag.estimated_duration_minutes || 120) % 60;
  const durationStr = `${durationHours}h ${durationMins > 0 ? durationMins + "min" : ""}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
    <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">📋 Auftrag für Morgen</h1>
      <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 14px;">${auftrag.company_name}</p>
    </div>
    
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="font-size: 16px;">Hallo <strong>${auftrag.team_leader_name}</strong>,</p>
      
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1e40af;">
          ${auftrag.title}
        </p>
        <p style="margin: 8px 0 0 0; color: #1e40af;">
          Auftrag-Nr: <strong>${auftrag.auftrag_nummer}</strong>
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 12px; background: #f9fafb; border-radius: 8px 0 0 0;">
            <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">📅 Datum</strong><br>
            <span style="font-size: 16px;">${formattedDate}</span>
          </td>
          <td style="padding: 12px; background: #f9fafb; border-radius: 0 8px 0 0;">
            <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">⏰ Zeit</strong><br>
            <span style="font-size: 16px;">${timeStr}</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 12px; background: #f9fafb; border-radius: 0 0 8px 8px;">
            <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">⏱️ Geschätzte Dauer</strong><br>
            <span style="font-size: 16px;">${durationStr}</span>
          </td>
        </tr>
      </table>

      <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">👤 Kunde</h3>
      <p style="margin: 0;">
        <strong>${auftrag.customer_name}</strong><br>
        ${auftrag.customer_phone ? `📞 <a href="tel:${auftrag.customer_phone}">${auftrag.customer_phone}</a><br>` : ""}
        ${auftrag.customer_email ? `📧 <a href="mailto:${auftrag.customer_email}">${auftrag.customer_email}</a>` : ""}
      </p>

      <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px;">📍 Adressen</h3>
      ${auftrag.from_address ? `
      <p style="margin: 0 0 10px 0;">
        <strong style="color: #059669;">Von:</strong><br>
        ${auftrag.from_address.replace(/\n/g, "<br>")}
      </p>
      ` : ""}
      ${auftrag.to_address ? `
      <p style="margin: 0;">
        <strong style="color: #dc2626;">Nach:</strong><br>
        ${auftrag.to_address.replace(/\n/g, "<br>")}
      </p>
      ` : ""}

      ${teamMembersList ? `
      <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px;">👥 Team</h3>
      <p style="margin: 0;">${teamMembersList}</p>
      ` : ""}

      ${auftrag.description ? `
      <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px;">📝 Beschreibung</h3>
      <p style="margin: 0; white-space: pre-wrap;">${auftrag.description}</p>
      ` : ""}

      ${auftrag.special_instructions ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <strong style="color: #92400e;">⚠️ Spezielle Anweisungen:</strong>
        <p style="margin: 8px 0 0 0; color: #78350f;">${auftrag.special_instructions}</p>
      </div>
      ` : ""}

      <div style="text-align: center; margin: 30px 0;">
        ${auftrag.from_address ? `
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(auftrag.from_address)}" 
           style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 5px;">
          📍 Route öffnen
        </a>
        ` : ""}
        ${auftrag.customer_phone ? `
        <a href="tel:${auftrag.customer_phone}" 
           style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 5px;">
          📞 Kunde anrufen
        </a>
        ` : ""}
      </div>
      
      <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center;">
        Viel Erfolg morgen! 💪
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function generateCustomerEmailHtml(
  auftrag: CustomerReminder,
  formattedDate: string
): string {
  const timeStr = auftrag.scheduled_time
    ? auftrag.scheduled_time.substring(0, 5) + " Uhr"
    : "Wird noch bekannt gegeben";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:16px 14px;">
    <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 28px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">Ihr Termin steht bevor</h1>
      <p style="color: #d1fae5; margin: 8px 0 0 0; font-size: 14px;">${auftrag.company_name}</p>
    </div>

    <div style="background: white; padding: 28px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="font-size: 16px;">Guten Tag <strong>${auftrag.customer_name}</strong>,</p>
      <p>wir möchten Sie an Ihren bevorstehenden Termin erinnern:</p>

      <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #047857;">${auftrag.title}</p>
        <p style="margin: 8px 0 0 0; color: #047857;">📅 ${formattedDate}</p>
        <p style="margin: 4px 0 0 0; color: #047857;">⏰ ${timeStr}</p>
      </div>

      ${auftrag.from_address ? `
      <p style="margin: 0 0 10px 0;">
        <strong style="color: #059669;">Adresse:</strong><br>
        ${auftrag.from_address.replace(/\n/g, "<br>")}
      </p>
      ` : ""}
      ${auftrag.to_address ? `
      <p style="margin: 0 0 10px 0;">
        <strong style="color: #dc2626;">Zieladresse:</strong><br>
        ${auftrag.to_address.replace(/\n/g, "<br>")}
      </p>
      ` : ""}

      <p style="margin-top: 20px;">
        Bitte stellen Sie sicher, dass alles für den Termin vorbereitet ist.
        Bei Fragen oder Änderungen kontaktieren Sie uns bitte rechtzeitig.
      </p>

      <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 28px;">
        Freundliche Grüsse<br>
        <strong>${auftrag.company_name}</strong>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function generateAuftragPdfHtml(
  auftrag: AuftragReminder,
  teamMembersList: string,
  formattedDate: string
): string {
  const timeStr = auftrag.scheduled_time 
    ? auftrag.scheduled_time.substring(0, 5) + " Uhr" 
    : "Zeit noch nicht festgelegt";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Auftrag ${auftrag.auftrag_nummer}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { margin: 0; color: #1e40af; }
    .header .subtitle { color: #6b7280; margin-top: 5px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; color: #3b82f6; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .info-box { background: #f9fafb; padding: 15px; border-radius: 8px; }
    .info-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .info-value { font-size: 16px; font-weight: bold; margin-top: 5px; }
    .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Auftrag ${auftrag.auftrag_nummer}</h1>
    <p class="subtitle">${auftrag.company_name}</p>
  </div>

  <div class="section">
    <div class="section-title">Auftragsdetails</div>
    <h2 style="margin: 0 0 10px 0;">${auftrag.title}</h2>
    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">📅 Datum</div>
        <div class="info-value">${formattedDate}</div>
      </div>
      <div class="info-box">
        <div class="info-label">⏰ Zeit</div>
        <div class="info-value">${timeStr}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">👤 Kundendaten</div>
    <p><strong>${auftrag.customer_name}</strong></p>
    ${auftrag.customer_phone ? `<p>📞 ${auftrag.customer_phone}</p>` : ""}
    ${auftrag.customer_email ? `<p>📧 ${auftrag.customer_email}</p>` : ""}
  </div>

  <div class="section">
    <div class="section-title">📍 Adressen</div>
    <div class="info-grid">
      ${auftrag.from_address ? `
      <div class="info-box">
        <div class="info-label" style="color: #059669;">Von</div>
        <div class="info-value">${auftrag.from_address.replace(/\n/g, "<br>")}</div>
      </div>
      ` : ""}
      ${auftrag.to_address ? `
      <div class="info-box">
        <div class="info-label" style="color: #dc2626;">Nach</div>
        <div class="info-value">${auftrag.to_address.replace(/\n/g, "<br>")}</div>
      </div>
      ` : ""}
    </div>
  </div>

  ${teamMembersList ? `
  <div class="section">
    <div class="section-title">👥 Team</div>
    <p><strong>Team-Leiter:</strong> ${auftrag.team_leader_name}</p>
    <p><strong>Mitarbeiter:</strong> ${teamMembersList}</p>
  </div>
  ` : ""}

  ${auftrag.description ? `
  <div class="section">
    <div class="section-title">📝 Beschreibung</div>
    <p>${auftrag.description}</p>
  </div>
  ` : ""}

  ${auftrag.special_instructions ? `
  <div class="warning-box">
    <strong>⚠️ Spezielle Anweisungen:</strong>
    <p style="margin: 10px 0 0 0;">${auftrag.special_instructions}</p>
  </div>
  ` : ""}

  <div class="footer">
    <p>Erstellt am ${new Date().toLocaleDateString("de-CH")} via ${getAppName()}.ch</p>
  </div>
</body>
</html>
  `;
}

