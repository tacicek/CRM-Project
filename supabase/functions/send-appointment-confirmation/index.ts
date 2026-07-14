import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { logEmail } from "../_shared/logEmail.ts";
import { wrapEmailDocument, EMAIL_HEADER_BAND, EMAIL_BODY_PADDING } from "../_shared/emailLayout.ts";
import {
  createTranslator,
  formatDateLong,
  toLocale,
  translateAppointmentType,
  type Locale,
} from "../_shared/i18n/index.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[send-appointment-confirmation] ${step}${d}`);
};

const SKIP_TYPES = new Set(["blocked", "meeting"]);

interface AppointmentRow {
  id: string;
  company_id: string;
  lead_id: string | null;
  appointment_type: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  title: string;
  description: string | null;
  location_address: string | null;
  location_plz: string | null;
  location_city: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  /** Document language — inherited from the offer/lead chain (appointments.language). */
  language: string | null;
}

interface CompanyRow {
  id: string;
  company_name: string;
  email: string;
  phone: string | null;
  resend_enabled: boolean | null;
  resend_api_key: string | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
}

/**
 * This mail has exactly ONE recipient — the customer — so the document locale governs
 * throughout. `isCompanyEmail` only selects the sending identity (company Resend vs. system),
 * never the language.
 */
function buildEmailHtml(
  apt: AppointmentRow,
  company: CompanyRow,
  isCompanyEmail: boolean,
  locale: Locale,
): string {
  const t = createTranslator(locale);
  const customerName = [apt.customer_first_name, apt.customer_last_name]
    .filter(Boolean)
    .join(" ") || t("common.customer");
  const typeLabel = translateAppointmentType(apt.appointment_type, t, apt.title);
  // BUGFIX: this was a double-quoted "Ihr ${getAppName()} Team", so customers literally
  // received the characters `${getAppName()}`. The catalog key interpolates properly.
  const senderName = isCompanyEmail
    ? company.company_name
    : t("common.teamSignature", { appName: getAppName() });

  const locationParts = [apt.location_address, [apt.location_plz, apt.location_city].filter(Boolean).join(" ")]
    .filter(Boolean);
  const locationHtml = locationParts.length > 0
    ? `<tr>
        <td style="padding:10px 16px;color:#71717a;vertical-align:top;">${t("common.location")}:</td>
        <td style="padding:10px 16px;font-weight:600;text-align:right;">${escapeHtml(locationParts.join(", "))}</td>
      </tr>`
    : "";

  const timeDisplay = apt.all_day
    ? t("common.allDay")
    : t("common.timeRange", { start: apt.start_time.slice(0, 5), end: apt.end_time.slice(0, 5) });

  const inner = `
    <div style="${EMAIL_HEADER_BAND}">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">
        ${t("email.appointmentConfirmation.headerTitle", { type: typeLabel })}
      </h1>
    </div>
    <div style="${EMAIL_BODY_PADDING}">
      <p style="margin:0 0 16px;">${t("common.greeting", { name: escapeHtml(customerName) })}</p>
      <p style="margin:0 0 20px;">
        ${t("email.appointmentConfirmation.intro", { companyName: `<strong>${escapeHtml(company.company_name)}</strong>` })}
      </p>

      <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
        <tr>
          <td style="padding:10px 16px;color:#71717a;">${t("common.appointment")}:</td>
          <td style="padding:10px 16px;font-weight:600;text-align:right;">${typeLabel}</td>
        </tr>
        <tr style="border-top:1px solid #f4f4f5;">
          <td style="padding:10px 16px;color:#71717a;">${t("common.date")}:</td>
          <td style="padding:10px 16px;font-weight:600;text-align:right;">${formatDateLong(apt.appointment_date, locale)}</td>
        </tr>
        <tr style="border-top:1px solid #f4f4f5;">
          <td style="padding:10px 16px;color:#71717a;">${t("common.time")}:</td>
          <td style="padding:10px 16px;font-weight:600;text-align:right;">${timeDisplay}</td>
        </tr>
        ${locationHtml ? `<tr style="border-top:1px solid #f4f4f5;">${locationHtml.replace(/<\/?tr>/g, "")}</tr>` : ""}
        <tr style="border-top:1px solid #f4f4f5;">
          <td style="padding:10px 16px;color:#71717a;">${t("common.company")}:</td>
          <td style="padding:10px 16px;font-weight:600;text-align:right;">${escapeHtml(company.company_name)}</td>
        </tr>
        ${company.phone ? `
        <tr style="border-top:1px solid #f4f4f5;">
          <td style="padding:10px 16px;color:#71717a;">${t("common.phone")}:</td>
          <td style="padding:10px 16px;text-align:right;">
            <a href="tel:${encodeURIComponent(company.phone)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(company.phone)}</a>
          </td>
        </tr>` : ""}
        <tr style="border-top:1px solid #f4f4f5;">
          <td style="padding:10px 16px;color:#71717a;">${t("common.email")}:</td>
          <td style="padding:10px 16px;text-align:right;">
            <a href="mailto:${encodeURIComponent(company.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(company.email)}</a>
          </td>
        </tr>
      </table>

      ${apt.description ? `
      <div style="margin:20px 0;padding:12px 16px;background:#f4f4f5;border-left:4px solid #a1a1aa;border-radius:4px;">
        <p style="margin:0;color:#3f3f46;font-size:14px;">${escapeHtml(apt.description)}</p>
      </div>` : ""}

      <p style="margin:20px 0 0;color:#52525b;font-size:14px;">
        ${company.phone
          ? t("email.appointmentConfirmation.cancelNoteWithPhone", {
              companyName: `<strong>${escapeHtml(company.company_name)}</strong>`,
              phone: `<a href="tel:${encodeURIComponent(company.phone)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(company.phone)}</a>`,
            })
          : t("email.appointmentConfirmation.cancelNote", {
              companyName: `<strong>${escapeHtml(company.company_name)}</strong>`,
            })}
      </p>

      <p style="margin:24px 0 0;color:#71717a;font-size:14px;">
        ${t("common.regards")}<br>
        <strong>${escapeHtml(senderName)}</strong>
      </p>
    </div>
    <div style="padding:16px;text-align:center;color:#a1a1aa;font-size:12px;">
      ${t("common.autoSentBy", { sender: escapeHtml(isCompanyEmail ? company.company_name : getAppName()) })}
    </div>`;

  return wrapEmailDocument(inner, locale);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentId } = await req.json();
    if (!appointmentId) {
      return new Response(JSON.stringify({ error: "appointmentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logStep("Started", { appointmentId });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch appointment
    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select(
        "id, company_id, lead_id, appointment_type, appointment_date, start_time, end_time, all_day, title, description, location_address, location_plz, location_city, customer_first_name, customer_last_name, customer_email, customer_phone, language",
      )
      .eq("id", appointmentId)
      .single();

    if (aptErr || !apt) {
      logStep("Appointment not found", { appointmentId, error: aptErr?.message });
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip non-customer types
    if (SKIP_TYPES.has(apt.appointment_type)) {
      logStep("Skipped — type is blocked/meeting", { type: apt.appointment_type });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if no email
    if (!apt.customer_email) {
      logStep("Skipped — no customer email");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company (with Resend settings)
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id, company_name, email, phone, resend_enabled, resend_api_key, resend_from_email, resend_from_name")
      .eq("id", apt.company_id)
      .single();

    if (companyErr || !company) {
      logStep("Company not found", { companyId: apt.company_id });
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine Resend key & from address
    const globalResendApiKey = Deno.env.get("RESEND_API_KEY");
    let resendApiKey = globalResendApiKey;
    let fromAddress = getDefaultFrom();
    let isCompanyEmail = false;

    if (company.resend_enabled && company.resend_api_key && company.resend_from_email) {
      resendApiKey = company.resend_api_key;
      const fromName = company.resend_from_name || company.company_name;
      fromAddress = `${fromName} <${company.resend_from_email}>`;
      isCompanyEmail = true;
      logStep("Using company Resend API", { fromAddress });
    }

    if (!resendApiKey) {
      logStep("No Resend API key — skipping email");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_api_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email — the customer is the only recipient, so the appointment's own language wins.
    const customerLocale = toLocale(apt.language);
    const tCustomer = createTranslator(customerLocale);

    const typeLabel = translateAppointmentType(apt.appointment_type, tCustomer, apt.title);
    const customerName =
      [apt.customer_first_name, apt.customer_last_name].filter(Boolean).join(" ") ||
      tCustomer("common.customer");
    // This subject carries no emoji today — none is added.
    const subject = tCustomer("email.appointmentConfirmation.subject", {
      type: typeLabel,
      date: formatDateLong(apt.appointment_date, customerLocale),
    });
    const html = buildEmailHtml(apt as AppointmentRow, company as CompanyRow, isCompanyEmail, customerLocale);

    // Send (company key first, fallback to global key if available)
    const sendWith = async (apiKey: string, from: string) => {
      const resend = new Resend(apiKey);
      return await resend.emails.send({
        from,
        to: [apt.customer_email],
        subject,
        html,
      });
    };

    logStep("Sending email", { to: apt.customer_email, from: fromAddress, subject });
    let { data: emailData, error: emailErr } = await sendWith(resendApiKey, fromAddress);
    logStep("Send result", { emailData: JSON.stringify(emailData), emailErr: JSON.stringify(emailErr) });

    if (emailErr && isCompanyEmail && globalResendApiKey && globalResendApiKey !== resendApiKey) {
      logStep("Company email failed, retrying with global Resend key", {
        companyId: company.id,
        firstError: emailErr,
      });
      isCompanyEmail = false;
      fromAddress = getDefaultFrom();
      ({ data: emailData, error: emailErr } = await sendWith(globalResendApiKey, fromAddress));
      logStep("Global key retry result", { emailData: JSON.stringify(emailData), emailErr: JSON.stringify(emailErr) });
    }

    const logParams = {
      recipientEmail: apt.customer_email,
      recipientName: customerName,
      subject,
      emailType: "appointment_confirmation",
      companyId: company.id,
      leadId: apt.lead_id || undefined,
      language: customerLocale,
      metadata: { appointmentId: apt.id, appointmentType: apt.appointment_type, isCompanyEmail },
    };

    if (emailErr) {
      logStep("Email send failed", { error: emailErr });
      await logEmail({ ...logParams, status: "failed", errorMessage: JSON.stringify(emailErr) });
      return new Response(JSON.stringify({ error: "Email send failed", details: emailErr }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Email sent", { emailId: emailData?.id, to: apt.customer_email });
    await logEmail({ ...logParams, status: "sent" });

    return new Response(JSON.stringify({ success: true, emailId: emailData?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logStep("Unhandled error", { error: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
