import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { maskEmail } from "../_shared/logger.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getCalendarFrom, getAppName } from "../_shared/envConfig.ts";
import {
  createTranslator,
  formatDateLong,
  toLocale,
} from "../_shared/i18n/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Escape user-supplied text before interpolating it into email HTML. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Input validation. Recipient/company identity is NOT trusted from the body — it is
// derived from the appointment row after the reschedule token has been validated.
const RescheduleResponseSchema = z.object({
  appointmentId: z.string().uuid("Ungültige Termin-ID"),
  action: z.enum(["confirm", "reject"], { errorMap: () => ({ message: "Aktion muss 'confirm' oder 'reject' sein" }) }),
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat (YYYY-MM-DD)"),
  proposedTime: z.string().regex(/^\d{2}:\d{2}$/, "Ungültiges Zeitformat (HH:MM)"),
  message: z.string().max(2000, "Nachricht zu lang (max. 2000 Zeichen)").optional(),
  token: z.string().uuid("Ungültiges Token"),
});

const handler = async (req: Request): Promise<Response> => {
  console.log("[handle-reschedule-response] Function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!resendApiKey) {
      console.error("[handle-reschedule-response] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    
    // Validiere Input mit Zod
    const parseResult = RescheduleResponseSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("[handle-reschedule-response] Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = parseResult.data;

    const { appointmentId, action, proposedDate, proposedTime, message, token } = body;

    // Load the appointment via service role. Identity fields (recipient, names, title)
    // come from this row — never from the request body.
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(
        "id, company_id, status, title, customer_email, customer_first_name, customer_last_name, reschedule_token, reschedule_token_expires_at, language"
      )
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error("[handle-reschedule-response] Appointment not found:", appointmentError);
      return new Response(
        JSON.stringify({ error: "Termin nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the single-use reschedule token: must exist, match, and not be expired.
    const tokenValid =
      !!appointment.reschedule_token &&
      appointment.reschedule_token === token &&
      (!appointment.reschedule_token_expires_at ||
        new Date(appointment.reschedule_token_expires_at).getTime() > Date.now());

    if (!tokenValid) {
      console.warn("[handle-reschedule-response] Invalid/expired token for appointment:", appointmentId);
      return new Response(
        JSON.stringify({ error: "Ungültiger oder abgelaufener Link" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Derive recipient identity from the DB row.
    const customerEmail = appointment.customer_email;
    if (!customerEmail) {
      console.error("[handle-reschedule-response] No customer email on appointment:", appointmentId);
      return new Response(
        JSON.stringify({ error: "Keine Kunden-E-Mail hinterlegt" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Both mails below go to the CUSTOMER, so the appointment's own language governs. It is read
    // from the DB row — the request body on this public endpoint is not trusted for identity.
    const customerLocale = toLocale(appointment.language);
    const t = createTranslator(customerLocale);

    const customerName =
      `${appointment.customer_first_name ?? ""} ${appointment.customer_last_name ?? ""}`.trim() ||
      t("common.customer");
    const appointmentTitle = appointment.title;

    const { data: company } = await supabase
      .from("companies")
      .select("company_name")
      .eq("id", appointment.company_id)
      .maybeSingle();
    const companyName = company?.company_name ?? getAppName();

    // Escaped variants for interpolation into the email HTML.
    const cName = escapeHtml(customerName);
    const coName = escapeHtml(companyName);
    const aTitle = escapeHtml(appointmentTitle);
    const msg = message ? escapeHtml(message) : "";

    const formatDateDisplay = (dateStr: string) => formatDateLong(dateStr, customerLocale);

    // Track the send outcome so email_logs reflects reality (resend returns { error }, no throw).
    let emailSendError: unknown = null;

    if (action === "confirm") {
      // Update the appointment with new date and time
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          appointment_date: proposedDate,
          start_time: proposedTime + ":00",
          status: "confirmed",
          confirmed_by_firma: true,
          confirmed_at: new Date().toISOString(),
          // Single-use: invalidate the token so the link can't be replayed.
          reschedule_token: null,
          reschedule_token_expires_at: null,
        })
        .eq("id", appointmentId);

      if (updateError) {
        console.error("[handle-reschedule-response] Error updating appointment:", updateError);
        throw updateError;
      }

      // Send confirmation email to customer
      const confirmEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
            .header { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981; }
            .date-box { background: #D1FAE5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
            .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
            .value { font-size: 18px; font-weight: 600; color: #059669; }
            .message-box { background: #F3F4F6; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 3px solid #6B7280; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">✅ ${t("email.rescheduleConfirmed.headerTitle")}</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">${t("email.rescheduleConfirmed.headerSubtitle")}</p>
            </div>
            <div class="content">
              <p>${t("common.greeting", { name: cName })}</p>
              <p>${t("email.rescheduleConfirmed.intro", { companyName: coName })}</p>

              <div class="info-box">
                <h2 style="margin: 0 0 15px; color: #1f2937;">${aTitle}</h2>

                <div class="date-box">
                  <div class="label">${t("email.rescheduleConfirmed.newAppointmentLabel")}</div>
                  <div class="value">${formatDateDisplay(proposedDate)}</div>
                  <div class="value">${t("common.timeValue", { time: proposedTime })}</div>
                </div>
              </div>

              ${msg ? `
              <div class="message-box">
                <div class="label">💬 ${t("common.messageFrom", { name: coName })}</div>
                <p style="margin: 10px 0 0;">${msg}</p>
              </div>
              ` : ""}

              <p style="margin-top: 25px;">
                ${t("email.rescheduleConfirmed.outro", { companyName: coName })}
              </p>

              <div class="footer">
                <p style="color: #6b7280;">
                  ${t("common.autoSentBy", { sender: getAppName() })}
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Emoji prefix preserved (the catalog values are emoji-free by design).
      const { error: confirmSendError } = await resend.emails.send({
        from: getCalendarFrom(),
        to: [customerEmail],
        subject: `✅ ${t("email.rescheduleConfirmed.subject", { title: appointmentTitle })}`,
        html: confirmEmailHtml,
      });
      emailSendError = confirmSendError;
      if (confirmSendError) console.error("[handle-reschedule-response] confirm email failed:", confirmSendError);
      else console.log(`[handle-reschedule-response] Sent confirmation to customer: ${maskEmail(customerEmail)}`);

    } else {
      // Reject - just update status and notify customer
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "pending",
          // Single-use: invalidate the token so the link can't be replayed.
          reschedule_token: null,
          reschedule_token_expires_at: null,
        })
        .eq("id", appointmentId);

      if (updateError) {
        console.error("[handle-reschedule-response] Error updating appointment:", updateError);
      }

      // Send rejection email to customer
      const rejectEmailHtml = `
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
            .message-box { background: #FEF3C7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 3px solid #F59E0B; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">📅 ${t("email.rescheduleRejected.headerTitle")}</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">${t("email.rescheduleRejected.headerSubtitle")}</p>
            </div>
            <div class="content">
              <p>${t("common.greeting", { name: cName })}</p>
              <p>${t("email.rescheduleRejected.intro", {
                companyName: coName,
                date: formatDateDisplay(proposedDate),
                time: proposedTime,
              })}</p>

              ${msg ? `
              <div class="message-box">
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">💬 ${t("common.messageFrom", { name: coName })}</div>
                <p style="margin: 10px 0 0;">${msg}</p>
              </div>
              ` : ""}

              <div class="info-box">
                <h3 style="margin: 0 0 10px; color: #1f2937;">${t("email.rescheduleRejected.optionsTitle")}</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>${t("email.rescheduleRejected.option1", { companyName: coName })}</li>
                  <li>${t("email.rescheduleRejected.option2")}</li>
                </ul>
              </div>

              <div class="footer">
                <p style="color: #6b7280;">
                  ${t("common.autoSentBy", { sender: getAppName() })}
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Emoji prefix preserved (the catalog values are emoji-free by design).
      const { error: rejectSendError } = await resend.emails.send({
        from: getCalendarFrom(),
        to: [customerEmail],
        subject: `📅 ${t("email.rescheduleRejected.subject", { title: appointmentTitle })}`,
        html: rejectEmailHtml,
      });
      emailSendError = rejectSendError;
      if (rejectSendError) console.error("[handle-reschedule-response] reject email failed:", rejectSendError);
      else console.log(`[handle-reschedule-response] Sent rejection to customer: ${maskEmail(customerEmail)}`);
    }

    // Log the email — in the language it actually went out in.
    await supabase.from("email_logs").insert({
      email_type: action === "confirm" ? "reschedule_confirmed" : "reschedule_rejected",
      recipient_email: customerEmail,
      recipient_name: customerName,
      subject: action === "confirm"
        ? t("email.rescheduleConfirmed.subject", { title: appointmentTitle })
        : t("email.rescheduleRejected.subject", { title: appointmentTitle }),
      status: emailSendError ? "failed" : "sent",
      language: customerLocale,
      metadata: {
        appointment_id: appointmentId,
        action,
        proposed_date: proposedDate,
        proposed_time: proposedTime,
      },
    });

    return new Response(
      JSON.stringify({ success: true, action }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[handle-reschedule-response] Error:", error);
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
