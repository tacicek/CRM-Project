import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";
import {
  createTranslator,
  DEFAULT_LOCALE,
  formatDateLong,
  toLocale,
  type Locale,
} from "../_shared/i18n/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RescheduleRequest {
  appointmentId: string;
  appointmentTitle: string;
  originalDate: string;
  originalTime: string;
  proposedDate: string;
  proposedTime: string;
  customerName: string;
  customerEmail: string;
  customerMessage?: string;
  companyEmail: string;
  companyName: string;
  companyId: string;
  /**
   * Optional caller-supplied locale. appointments.language is authoritative and wins; this is
   * only a fallback for a caller that knows the language before the row carries one.
   */
  language?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[notify-appointment-reschedule] Function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!resendApiKey) {
      console.error("[notify-appointment-reschedule] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RescheduleRequest = await req.json();
    console.log("[notify-appointment-reschedule] Request body:", body);

    const {
      appointmentId,
      appointmentTitle,
      originalDate,
      originalTime,
      proposedDate,
      proposedTime,
      customerName,
      customerEmail,
      customerMessage,
      companyEmail,
      companyName,
    } = body;

    // ── Locales ────────────────────────────────────────────────────────────────
    // Two recipients, two languages. appointments.language drives the customer copy (read from
    // the DB — this endpoint is public and the body is not trusted for identity);
    // companies.default_language drives the firma copy.
    const { data: aptRow } = await supabase
      .from("appointments")
      .select("company_id, language")
      .eq("id", appointmentId)
      .maybeSingle();

    const customerLocale: Locale = aptRow?.language
      ? toLocale(aptRow.language)
      : toLocale(body.language);

    const companyIdForLocale = body.companyId || aptRow?.company_id;
    let companyLocale: Locale = DEFAULT_LOCALE;
    if (companyIdForLocale) {
      const { data: companyLangRow } = await supabase
        .from("companies")
        .select("default_language")
        .eq("id", companyIdForLocale)
        .maybeSingle();
      companyLocale = toLocale(companyLangRow?.default_language);
    }

    const tCustomer = createTranslator(customerLocale);
    const tCompany = createTranslator(companyLocale);

    const formatTime = (timeStr: string) => timeStr.substring(0, 5);

    // Generate action URLs
    const siteUrl = getSiteUrl();
    const responseToken = crypto.randomUUID();
    const confirmUrl = `${siteUrl}/termin/${appointmentId}/antwort?action=confirm&date=${proposedDate}&time=${proposedTime}&token=${responseToken}`;
    const rejectUrl = `${siteUrl}/termin/${appointmentId}/antwort?action=reject&date=${proposedDate}&time=${proposedTime}&token=${responseToken}`;

    // Persist the token so handle-reschedule-response can validate the firma's click.
    // 30-day window: a reschedule request older than that must be re-initiated.
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: tokenError } = await supabase
      .from("appointments")
      .update({
        reschedule_token: responseToken,
        reschedule_token_expires_at: tokenExpiresAt,
      })
      .eq("id", appointmentId);

    if (tokenError) {
      console.error("[notify-appointment-reschedule] Failed to persist reschedule token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Terminverschiebung konnte nicht vorbereitet werden" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email to company with action buttons
    const companyEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
          .header { background: linear-gradient(135deg, #F59E0B, #D97706); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B; }
          .old-date { background: #FEE2E2; padding: 15px; border-radius: 8px; margin: 10px 0; }
          .new-date { background: #D1FAE5; padding: 15px; border-radius: 8px; margin: 10px 0; }
          .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
          .value { font-size: 16px; font-weight: 600; }
          .message-box { background: #FEF3C7; padding: 15px; border-radius: 8px; margin-top: 15px; }
          .customer-info { background: #EFF6FF; padding: 15px; border-radius: 8px; margin-top: 15px; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          .action-section { background: white; border: 2px solid #E5E7EB; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; }
          .action-btns { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-top: 15px; }
          .confirm-btn { display: inline-block; background: #10B981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
          .reject-btn { display: inline-block; background: #EF4444; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">📅 Terminverschiebung angefragt</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Ein Kunde möchte den Termin verschieben</p>
          </div>
          <div class="content">
            <p>Guten Tag,</p>
            <p>ein Kunde hat angefragt, den folgenden Termin zu verschieben:</p>
            
            <div class="info-box">
              <h2 style="margin: 0 0 15px; color: #1f2937;">${appointmentTitle}</h2>
              
              <div class="old-date">
                <div class="label">❌ Ursprünglicher Termin</div>
                <div class="value">${formatDateLong(originalDate, companyLocale)}</div>
                <div class="value" style="color: #DC2626;">${tCompany("common.timeValue", { time: formatTime(originalTime) })}</div>
              </div>

              <div class="new-date">
                <div class="label">✅ Vorgeschlagener neuer Termin</div>
                <div class="value">${formatDateLong(proposedDate, companyLocale)}</div>
                <div class="value" style="color: #059669;">${tCompany("common.timeValue", { time: proposedTime })}</div>
              </div>
            </div>

            <div class="customer-info">
              <div class="label">👤 ${tCompany("common.customer")}</div>
              <div class="value">${escapeHtml(customerName)}</div>
              <div style="color: #6b7280; font-size: 14px; margin-top: 5px;">${escapeHtml(customerEmail)}</div>
            </div>

            ${customerMessage ? `
            <div class="message-box">
              <div class="label">💬 Nachricht des Kunden</div>
              <p style="margin: 10px 0 0;">${escapeHtml(customerMessage)}</p>
            </div>
            ` : ""}
            
            <div class="action-section">
              <h3 style="margin: 0 0 5px; color: #1f2937;">Termin direkt beantworten</h3>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Klicken Sie auf einen Button, um zu antworten</p>
              <div class="action-btns">
                <a href="${confirmUrl}" class="confirm-btn">✅ Termin bestätigen</a>
                <a href="${rejectUrl}" class="reject-btn">❌ Ablehnen</a>
              </div>
            </div>
            
            <div class="footer">
              <p style="color: #6b7280;">
                Diese E-Mail wurde automatisch gesendet.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const { error: companyEmailError } = await resend.emails.send({
      from: getCalendarFrom(),
      to: [companyEmail],
      subject: `📅 Terminverschiebung angefragt: ${appointmentTitle}`,
      html: companyEmailHtml,
    });
    if (companyEmailError) console.error("[notify-appointment-reschedule] company email failed:", companyEmailError);
    else console.log(`[notify-appointment-reschedule] Sent notification to company: ${companyEmail}`);

    // Send confirmation email to customer — CUSTOMER language
    const customerEmailHtml = `
      <!DOCTYPE html>
      <html lang="${customerLocale}">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
          .header { background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3B82F6; }
          .proposed-date { background: #D1FAE5; padding: 15px; border-radius: 8px; margin: 10px 0; text-align: center; }
          .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
          .value { font-size: 16px; font-weight: 600; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">✅ ${tCustomer("email.rescheduleRequestSent.headerTitle")}</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">${tCustomer("email.rescheduleRequestSent.headerSubtitle")}</p>
          </div>
          <div class="content">
            <p>${tCustomer("common.greeting", { name: escapeHtml(customerName) })}</p>
            <p>${tCustomer("email.rescheduleRequestSent.intro", { companyName: escapeHtml(companyName) })}</p>

            <div class="info-box">
              <h2 style="margin: 0 0 15px; color: #1f2937;">${escapeHtml(appointmentTitle)}</h2>

              <div class="proposed-date">
                <div class="label">${tCustomer("email.rescheduleRequestSent.proposedLabel")}</div>
                <div class="value" style="font-size: 18px;">${formatDateLong(proposedDate, customerLocale)}</div>
                <div class="value" style="color: #059669;">${tCustomer("common.timeValue", { time: proposedTime })}</div>
              </div>
            </div>

            <p>
              ${tCustomer("email.rescheduleRequestSent.outro", { companyName: escapeHtml(companyName) })}
            </p>

            <div class="footer">
              <p style="color: #6b7280;">
                ${tCustomer("email.rescheduleRequestSent.footer", { companyName: escapeHtml(companyName) })}
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Emoji prefix preserved (the catalog values are emoji-free by design).
    const { error: customerEmailError } = await resend.emails.send({
      from: getCalendarFrom(),
      to: [customerEmail],
      subject: `✅ ${tCustomer("email.rescheduleRequestSent.subject", { title: appointmentTitle })}`,
      html: customerEmailHtml,
    });
    if (customerEmailError) console.error("[notify-appointment-reschedule] customer email failed:", customerEmailError);
    else console.log(`[notify-appointment-reschedule] Sent confirmation to customer: ${customerEmail}`);

    // Create notification for dashboard
    const { companyId } = body;
    if (companyId) {
      await supabase.from("notifications").insert({
        company_id: companyId,
        type: "appointment_reschedule",
        title: "Terminverschiebung angefragt",
        body: `${customerName} möchte den Termin "${appointmentTitle}" auf ${formatDateLong(proposedDate, companyLocale)} um ${proposedTime} Uhr verschieben.`,
        metadata: {
          appointment_id: appointmentId,
          customer_name: customerName,
          customer_email: customerEmail,
          proposed_date: proposedDate,
          proposed_time: proposedTime,
          original_date: originalDate,
          original_time: originalTime,
          confirm_url: confirmUrl,
          reject_url: rejectUrl,
        },
      });
      console.log(`[notify-appointment-reschedule] Created notification for company: ${companyId}`);
    }

    // Log the email
    await supabase.from("email_logs").insert({
      email_type: "appointment_reschedule_request",
      recipient_email: companyEmail,
      recipient_name: companyName,
      subject: `Terminverschiebung angefragt: ${appointmentTitle}`,
      status: companyEmailError ? "failed" : "sent",
      language: companyLocale,
      metadata: {
        appointment_id: appointmentId,
        customer_name: customerName,
        customer_email: customerEmail,
        proposed_date: proposedDate,
        proposed_time: proposedTime,
      },
    });

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[notify-appointment-reschedule] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
