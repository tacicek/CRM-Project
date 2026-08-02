import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";
import { corsHeaders } from "../_shared/cors.ts";
// Das LOKALISIERTE Layout: `wrapEmailDocument(inner, locale)` setzt `lang`
// wirklich. Der frueher hier importierte Nachbar ohne `i18n/` nimmt nur ein
// Argument und schreibt `lang="de"` fest — franzoesische und englische
// Bestaetigungen trugen deshalb die falsche Sprachauszeichnung.
import { wrapEmailDocument, EMAIL_HEADER_BAND, EMAIL_BODY_PADDING } from "../_shared/i18n/emailLayout.ts";
import {
  createTranslator,
  formatDateLong,
  toLocale,
  translateAppointmentType,
  type Locale,
} from "../_shared/i18n/index.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";
import {
  handleAppointmentConfirmation,
  type AppointmentRow as GuardAppointmentRow,
  type CompanyRow as GuardCompanyRow,
  type ConfirmationDeps,
  type EmailLogEntry,
  type RenderContext,
} from "../_shared/appointmentConfirmationGuard.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[send-appointment-confirmation] ${step}${d}`);
};

// Die Zeilenformen stehen jetzt im Guard — dort werden sie geprueft, hier nur
// gerendert. `CompanyRow` traegt bewusst KEIN `resend_api_key` mehr: der
// Schluessel kommt aus `company_secrets` und geht nie durch den Renderer.
type AppointmentRow = GuardAppointmentRow;
type CompanyRow = GuardCompanyRow;

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

/**
 * Diese Datei ist nur noch die Anbindung: sie stellt die echten Mitspieler
 * bereit und rendert. Was geprueft wird und in welcher Reihenfolge etwas
 * passieren darf, steht in ../_shared/appointmentConfirmationGuard.ts — dort
 * laesst es sich ausfuehren, hier nicht (Deno-Globals, `https://`-Importe).
 */

// deno-lint-ignore no-explicit-any -- der Supabase-Client ist edge-seitig nur
// strukturell verfuegbar; das generierte Modell existiert hier nicht.
type Client = any;

/**
 * Eigener, stiller Protokoll-Schreiber.
 *
 * `_shared/logEmail.ts` schreibt bei jedem Eintrag die EMPFAENGERADRESSE auf
 * die Konsole. Die Adresse gehoert in die Tabelle, nicht ins Log. `logEmail.ts`
 * bleibt unangetastet — es hat andere Aufrufer.
 */
const logEmailQuiet = (supabase: Client) => async (entry: EmailLogEntry): Promise<void> => {
  const { error } = await supabase.from("email_logs").insert({
    recipient_email: entry.recipientEmail,
    recipient_name: entry.recipientName ?? null,
    subject: entry.subject,
    email_type: entry.emailType,
    status: entry.status,
    error_message: entry.errorMessage ?? null,
    metadata: entry.metadata ?? {},
    company_id: entry.companyId ?? null,
    lead_id: entry.leadId ?? null,
    language: entry.language ?? null,
  });
  if (error) logStep("Could not write the email log");
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Letzte Verteidigung — und sie beginnt VOR dem Aufbau, nicht danach.
  //
  // Der Guard faengt alles ab, was aus den Abhaengigkeiten kommt. Er kann aber
  // nichts abfangen, was passiert, bevor er ueberhaupt aufgerufen wird. Genau
  // dort lag der Fehler: das Auslesen einer fehlenden Umgebungsvariable liefert
  // `undefined`, und der Supabase-Client wirft daraufhin beim Anlegen
  // `supabaseUrl is required`. Diese Ausnahme trug ihre Meldung bis in die
  // Antwort der Laufzeit — an einem oeffentlich erreichbaren Endpunkt.
  // (Die Aufrufe stehen hier nicht woertlich: ein Test misst ihre Position.)
  //
  // Deshalb liegt jetzt der ganze Aufbau innerhalb des Netzes: Umgebung lesen,
  // Client anlegen, Abhaengigkeiten zusammenstellen, Guard rufen, Antwort
  // bauen. Nur die CORS-Antwort auf OPTIONS steht davor — sie braucht nichts
  // davon.
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const deps: ConfirmationDeps = {
      authenticate: async (token) => {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user) return null;
        return { userId: data.user.id };
      },
      loadAppointment: async (appointmentId) => {
        const { data, error } = await supabase
          .from("appointments")
          .select(
            "id, company_id, lead_id, appointment_type, appointment_date, start_time, end_time, all_day, title, description, location_address, location_plz, location_city, customer_first_name, customer_last_name, customer_email, customer_phone, language",
          )
          .eq("id", appointmentId)
          .maybeSingle();
        // Dreiwertig: ein Abfragefehler ist keine geloeschte Zeile.
        if (error) return { ok: false };
        return { ok: true, value: (data as AppointmentRow | null) ?? null };
      },
      isCompanyMember: async (userId, companyId) => {
        // Dreiwertig: der gemeinsame Helfer bildet einen DB-Fehler auf `false`
        // ab und wuerde eine Stoerung als Rechteproblem tarnen.
        const { data, error } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (error) return { ok: false };
        return { ok: true, isMember: data !== null };
      },
      loadCompany: async (companyId) => {
        const { data, error } = await supabase
          .from("companies")
          .select("id, company_name, email, phone, resend_enabled, resend_from_email, resend_from_name")
          .eq("id", companyId)
          .maybeSingle();
        if (error) return { ok: false };
        return { ok: true, value: (data as CompanyRow | null) ?? null };
      },
      /**
       * Hier bewusst NICHT `loadCompanySecrets`: der gemeinsame Helfer bildet
       * einen Abfragefehler auf lauter `null` ab, also auf „kein Schluessel
       * hinterlegt". Fuer diesen Endpunkt waere das falsch — er wuerde still auf
       * den allgemeinen Zugang ausweichen und die Mail unter der falschen
       * Absenderidentitaet verschicken, weil die Datenbank gerade klemmte.
       */
      loadSecrets: async (companyId) => {
        const { data, error } = await supabase
          .from("company_secrets")
          .select("resend_api_key")
          .eq("company_id", companyId)
          .maybeSingle();
        if (error) return { ok: false };
        return {
          ok: true,
          value: { resend_api_key: (data?.resend_api_key as string | null) ?? null },
        };
      },
      renderEmail: (ctx: RenderContext) => {
        const t = createTranslator(ctx.locale);
        const typeLabel = translateAppointmentType(
          ctx.appointment.appointment_type,
          t,
          ctx.appointment.title,
        );
        return {
          subject: t("email.appointmentConfirmation.subject", {
            type: typeLabel,
            date: formatDateLong(ctx.appointment.appointment_date, ctx.locale),
          }),
          html: buildEmailHtml(ctx.appointment, ctx.company, ctx.isCompanyEmail, ctx.locale),
        };
      },
      sendEmail: async ({ to, subject, html, apiKey, from }) => {
        const resend = new Resend(apiKey);
        const { data, error } = await resend.emails.send({ from, to: [to], subject, html });
        return { id: data?.id, error };
      },
      logEmail: logEmailQuiet(supabase),
      toLocale,
      defaultResendApiKey: () => Deno.env.get("RESEND_API_KEY"),
      defaultFrom: () => getDefaultFrom(),
      log: logStep,
    };

    // Weder ein Sammel-Leser fuer Text noch einer fuer JSON: beide ziehen den
    // GANZEN Koerper in den Speicher, bevor irgendjemand ihn ablehnen kann.

    const ergebnis = await handleAppointmentConfirmation(deps, {
      method: req.method,
      authorization: req.headers.get("Authorization"),
      contentLength: req.headers.get("content-length"),
      body: req.body,
    });

    if (ergebnis.body === null) {
      return new Response(null, { status: ergebnis.status, headers: { ...corsHeaders, ...ergebnis.headers } });
    }
    return new Response(JSON.stringify(ergebnis.body), {
      status: ergebnis.status,
      headers: { ...corsHeaders, "Content-Type": "application/json", ...ergebnis.headers },
    });
  } catch {
    // Fester Merker, kein Fehlerinhalt.
    logStep("Unhandled failure");
    return new Response(JSON.stringify({ error: "service_unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
