import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getAppName, getDashAppUrl } from "../_shared/envConfig.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEmailDocument, EMAIL_HEADER_BAND, EMAIL_BODY_PADDING } from "../_shared/i18n/emailLayout.ts";
import {
  createTranslator,
  formatDateLong,
  toLocale,
  translateServiceType,
} from "../_shared/i18n/index.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";
import {
  EMAIL_TYPE,
  handleAcceptanceConfirmation,
  type AcceptanceConfirmationDeps,
  type AcceptanceRenderContext,
  type CompanyRow,
  type EmailLogEntry,
  type OfferRow,
} from "../_shared/offerAcceptanceConfirmationGuard.ts";
import type { AcceptanceItemRow } from "../_shared/acceptanceTermine.ts";

/**
 * Auftragsbestaetigung an den Kunden, nachdem eine Offerte angenommen wurde —
 * ueber die Offertenseite oder manuell durch die Firma.
 *
 * Diese Datei ist nur die Anbindung: sie stellt die echten Mitspieler bereit
 * und rendert. Wer ausloesen darf und in welcher Reihenfolge etwas passiert,
 * steht in ../_shared/offerAcceptanceConfirmationGuard.ts.
 *
 * Die Mail nennt KEINE Betraege. Die Preisdarstellung (fix, Spanne, «nach
 * Aufwand», Kostendach) steht bereits in `send-offer` als Abschrift von
 * `src/lib/offerPricing.ts`; eine dritte Abschrift waere die, die als erste
 * falsch rechnet. Der Link fuehrt zur angenommenen Offerte mit allen Preisen.
 */

const logStep = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[send-offer-acceptance-confirmation] ${step}${d}`);
};

const buildEmail = (ctx: AcceptanceRenderContext): { subject: string; html: string } => {
  const { offer, company, termine, isCompanyEmail, locale } = ctx;
  const t = createTranslator(locale);
  const offerNumber = String(offer.offer_number ?? "");
  const customerName =
    [offer.customer_first_name, offer.customer_last_name].filter(Boolean).join(" ") || t("common.customer");
  const senderName = isCompanyEmail ? company.company_name : t("common.teamSignature", { appName: getAppName() });
  const offerViewUrl = `${getDashAppUrl()}/offerte/${encodeURIComponent(offer.access_token ?? "")}`;

  const intro = offer.accepted_via === "manual"
    ? t("email.acceptanceConfirmation.introManual", { offerNumber: escapeHtml(offerNumber) })
    : t("email.acceptanceConfirmation.introOnline", { offerNumber: escapeHtml(offerNumber) });

  const terminZeilen = termine
    .map((termin, i) => {
      const label = termin.serviceType ? translateServiceType(termin.serviceType, t) : "";
      const zeit = termin.startTime ? ` · ${t("email.acceptanceConfirmation.startFrom", { time: termin.startTime })}` : "";
      return `<tr${i > 0 ? ' style="border-top:1px solid #f4f4f5;"' : ""}>
          <td style="padding:10px 16px;color:#71717a;">${escapeHtml(label || t("common.date"))}</td>
          <td style="padding:10px 16px;font-weight:600;text-align:right;">${formatDateLong(termin.date, locale)}${escapeHtml(zeit)}</td>
        </tr>`;
    })
    .join("");

  const termineHtml = termine.length > 0
    ? `<p style="margin:20px 0 8px;font-weight:600;">${t("email.acceptanceConfirmation.termineHeading")}</p>
      <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
        ${terminZeilen}
      </table>`
    : "";

  const kontakt = company.phone
    ? t("email.acceptanceConfirmation.contactNote", {
        companyName: `<strong>${escapeHtml(company.company_name)}</strong>`,
        phone: `<a href="tel:${encodeURIComponent(company.phone)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(company.phone)}</a>`,
      })
    : t("email.acceptanceConfirmation.contactNoteNoPhone", {
        companyName: `<strong>${escapeHtml(company.company_name)}</strong>`,
      });

  const inner = `
    <div style="${EMAIL_HEADER_BAND}">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">
        ${t("email.acceptanceConfirmation.headerTitle")}
      </h1>
    </div>
    <div style="${EMAIL_BODY_PADDING}">
      <p style="margin:0 0 16px;">${t("common.greeting", { name: escapeHtml(customerName) })}</p>
      <p style="margin:0 0 20px;">${intro}</p>

      <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
        <tr>
          <td style="padding:10px 16px;color:#71717a;">${t("common.offer")}:</td>
          <td style="padding:10px 16px;font-weight:600;text-align:right;">${escapeHtml(offerNumber)}${offer.title ? ` – ${escapeHtml(offer.title)}` : ""}</td>
        </tr>
        <tr style="border-top:1px solid #f4f4f5;">
          <td style="padding:10px 16px;color:#71717a;">${t("common.company")}:</td>
          <td style="padding:10px 16px;font-weight:600;text-align:right;">${escapeHtml(company.company_name)}</td>
        </tr>
        <tr style="border-top:1px solid #f4f4f5;">
          <td style="padding:10px 16px;color:#71717a;">${t("common.email")}:</td>
          <td style="padding:10px 16px;text-align:right;">
            <a href="mailto:${encodeURIComponent(company.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(company.email)}</a>
          </td>
        </tr>
      </table>

      ${termineHtml}

      <p style="margin:20px 0 0;color:#52525b;font-size:14px;">${t("email.acceptanceConfirmation.agbNote")}</p>

      <div style="text-align:center;margin:24px 0;">
        <a href="${offerViewUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          ${t("email.acceptanceConfirmation.cta")}
        </a>
      </div>

      <p style="margin:0;color:#52525b;font-size:14px;">${kontakt}</p>

      <p style="margin:24px 0 0;color:#71717a;font-size:14px;">
        ${t("common.regards")}<br>
        <strong>${escapeHtml(senderName)}</strong>
      </p>
    </div>
    <div style="padding:16px;text-align:center;color:#a1a1aa;font-size:12px;">
      ${t("common.autoSentBy", { sender: escapeHtml(isCompanyEmail ? company.company_name : getAppName()) })}
    </div>`;

  return {
    subject: t("email.acceptanceConfirmation.subject", { offerNumber }),
    html: wrapEmailDocument(inner, locale),
  };
};

// deno-lint-ignore no-explicit-any -- der Supabase-Client ist edge-seitig nur
// strukturell verfuegbar; das generierte Modell existiert hier nicht.
type Client = any;

/** Schreibt ins Protokoll, ohne die Empfaengeradresse auf die Konsole zu geben. */
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

  // Der ganze Aufbau liegt im Netz: eine fehlende Umgebungsvariable laesst den
  // Client beim Anlegen werfen, und diese Meldung gehoert nicht in die Antwort.
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const deps: AcceptanceConfirmationDeps = {
      authenticate: async (token) => {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user) return null;
        return { userId: data.user.id };
      },
      loadOffer: async (offerId) => {
        const { data, error } = await supabase
          .from("offers")
          .select(
            "id, company_id, lead_id, status, access_token, offer_number, title, language, accepted_via, customer_first_name, customer_last_name, customer_email, service_date, service_start_time",
          )
          .eq("id", offerId)
          .maybeSingle();
        if (error) return { ok: false };
        return { ok: true, value: (data as OfferRow | null) ?? null };
      },
      isCompanyMember: async (userId, companyId) => {
        const { data, error } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (error) return { ok: false };
        return { ok: true, isMember: data !== null };
      },
      hasSentConfirmation: async (offerId) => {
        const { count, error } = await supabase
          .from("email_logs")
          .select("id", { count: "exact", head: true })
          .eq("email_type", EMAIL_TYPE)
          .eq("status", "sent")
          .eq("metadata->>offer_id", offerId);
        if (error) return { ok: false };
        return { ok: true, value: (count ?? 0) > 0 };
      },
      loadOfferItems: async (offerId) => {
        const { data, error } = await supabase
          .from("offer_items")
          .select("service_type, scheduled_date, scheduled_start_time, position")
          .eq("offer_id", offerId);
        if (error) return { ok: false };
        return { ok: true, value: (data as AcceptanceItemRow[] | null) ?? [] };
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
      renderEmail: buildEmail,
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

    const ergebnis = await handleAcceptanceConfirmation(deps, {
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
    logStep("Unhandled failure");
    return new Response(JSON.stringify({ error: "service_unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
