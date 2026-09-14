/**
 * Wer die Auftragsbestaetigung an den Kunden ausloesen darf — und in welcher
 * Reihenfolge das geprueft wird.
 *
 * ── Zwei Aufrufer, ein Endpunkt ─────────────────────────────────────────────
 *
 * Eine Offerte wird auf zwei Wegen angenommen: vom Kunden auf der
 * Offertenseite (`update_offer_by_token`) oder von der Firma, wenn der Kunde
 * am Telefon zugesagt hat (`accept_offer_manually`). Beide Male bekommt der
 * Kunde dieselbe Bestaetigung. Die Nachweise sind verschieden:
 *
 *   * Offertenseite: das Zugangs-Token der Offerte im Koerper. Die Seite hat
 *     keinen Benutzer; `functions.invoke` schickt dort nur den anon-Schluessel
 *     als Bearer, und der beweist nichts.
 *   * Firma: ein echtes Benutzer-JWT, und der Benutzer muss Mitglied der Firma
 *     der Offerte sein.
 *
 * Deshalb entscheidet der KOERPER, welcher Nachweis gilt: mit `accessToken`
 * das Token, ohne das JWT. Ein JWT-Aufruf wird angemeldet, BEVOR die Datenbank
 * beruehrt wird.
 *
 * ── Warum ein Token-Inhaber keine Mailflut ausloesen kann ───────────────────
 *
 * Das Token steht in jeder Offertenmail und kann weitergegeben werden. Der
 * Endpunkt schickt deshalb nur fuer eine ANGENOMMENE Offerte und nur EINMAL:
 * steht in `email_logs` bereits eine gesendete Bestaetigung, wird
 * uebersprungen. Empfaenger, Sprache und Inhalt kommen ausschliesslich aus der
 * Zeile, nie aus dem Koerper.
 *
 * «Offerte gibt es nicht», «falsches Token» und «fremde Firma» beantworten
 * dieselbe Antwort — sonst waere der Endpunkt ein Orakel fuer Offerten-ids.
 *
 * Diese Datei kommt ohne Deno aus, damit die Reihenfolge pruefbar ist.
 */

import { readBoundedUtf8 } from "./boundedBody.ts";
import { extractBearerToken } from "./appointmentConfirmationGuard.ts";
import type {
  CompanyRow,
  CompanySecretsLike,
  EmailLogEntry,
  HandlerResult,
  LookupResult,
  MembershipResult,
  SendArgs,
} from "./appointmentConfirmationGuard.ts";
import { buildAcceptanceTermine, type AcceptanceItemRow, type AcceptanceTermin } from "./acceptanceTermine.ts";
import type { Locale } from "./i18n/index.ts";

export type { CompanyRow, CompanySecretsLike, EmailLogEntry, HandlerResult, LookupResult, MembershipResult, SendArgs };

export const EMAIL_TYPE = "offer_acceptance_confirmation";

// ── Eingabevertrag ──────────────────────────────────────────────────────────

export const ALLOWED_FIELDS = ["offerId", "accessToken"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParseResult =
  | { ok: true; offerId: string; accessToken: string | null }
  | { ok: false; reason: string };

export const parseAcceptanceConfirmationRequest = (raw: unknown): ParseResult => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "body_not_object" };
  }
  const body = raw as Record<string, unknown>;

  const fremd = Object.keys(body).filter((k) => !(ALLOWED_FIELDS as readonly string[]).includes(k));
  if (fremd.length > 0) return { ok: false, reason: `unknown_fields:${fremd.sort().join(",")}` };

  if (typeof body.offerId !== "string" || !UUID.test(body.offerId)) {
    return { ok: false, reason: "offerId_invalid" };
  }

  if (body.accessToken === undefined) return { ok: true, offerId: body.offerId, accessToken: null };
  if (typeof body.accessToken !== "string" || body.accessToken.length < 16 || body.accessToken.length > 256) {
    return { ok: false, reason: "accessToken_invalid" };
  }
  return { ok: true, offerId: body.offerId, accessToken: body.accessToken };
};

/**
 * Vergleich ohne fruehen Ausstieg. Die Laenge verraet er — die ist fuer ein
 * Token fester Bauart ohnehin kein Geheimnis.
 */
export const tokensEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// ── Zeilen aus der Datenbank ────────────────────────────────────────────────

export interface OfferRow {
  id: string;
  company_id: string;
  lead_id: string | null;
  status: string;
  access_token: string | null;
  offer_number: number | string | null;
  title: string | null;
  language: string | null;
  accepted_via: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  service_date: string | null;
  service_start_time: string | null;
}

export interface AcceptanceRenderContext {
  offer: OfferRow;
  company: CompanyRow;
  termine: AcceptanceTermin[];
  isCompanyEmail: boolean;
  locale: Locale;
}

export interface AcceptanceConfirmationDeps {
  authenticate(token: string): Promise<{ userId: string } | null>;
  loadOffer(offerId: string): Promise<LookupResult<OfferRow>>;
  isCompanyMember(userId: string, companyId: string): Promise<MembershipResult>;
  /** `true`, wenn fuer diese Offerte schon eine Bestaetigung GESENDET wurde. */
  hasSentConfirmation(offerId: string): Promise<LookupResult<boolean>>;
  loadOfferItems(offerId: string): Promise<LookupResult<AcceptanceItemRow[]>>;
  loadCompany(companyId: string): Promise<LookupResult<CompanyRow>>;
  loadSecrets(companyId: string): Promise<LookupResult<CompanySecretsLike>>;
  renderEmail(ctx: AcceptanceRenderContext): { subject: string; html: string };
  sendEmail(args: SendArgs): Promise<{ id?: string; error?: unknown }>;
  logEmail(entry: EmailLogEntry): Promise<void>;
  toLocale(value: unknown): Locale;
  defaultResendApiKey(): string | undefined;
  defaultFrom(): string;
  log(step: string, details?: Record<string, unknown>): void;
}

export interface AcceptanceConfirmationHttpRequest {
  method: string;
  authorization: string | null;
  contentLength?: string | null;
  body?: ReadableStream<Uint8Array> | null;
}

const ANTWORT_405: HandlerResult = {
  status: 405,
  body: { error: "method_not_allowed" },
  headers: { Allow: "POST, OPTIONS" },
};
const ANTWORT_401: HandlerResult = { status: 401, body: { error: "unauthorized" } };
const ANTWORT_400: HandlerResult = { status: 400, body: { error: "invalid_request" } };
const ANTWORT_404: HandlerResult = { status: 404, body: { error: "not_found" } };
const ANTWORT_409: HandlerResult = { status: 409, body: { error: "offer_not_accepted" } };
const ANTWORT_503: HandlerResult = { status: 503, body: { error: "service_unavailable" } };

const uebersprungen = (reason: string): HandlerResult => ({
  status: 200,
  body: { success: true, skipped: true, reason },
});

/**
 * Aussen ein Fangnetz: jede Abhaengigkeit kann werfen, und nach aussen geht
 * dann eine feste Antwort ohne Fehlerinhalt.
 */
export const handleAcceptanceConfirmation = async (
  deps: AcceptanceConfirmationDeps,
  req: AcceptanceConfirmationHttpRequest,
): Promise<HandlerResult> => {
  try {
    return await fuehreAblaufAus(deps, req);
  } catch {
    try {
      deps.log("Unhandled dependency failure");
    } catch {
      /* selbst das Protokoll darf scheitern, ohne die Antwort zu aendern */
    }
    return ANTWORT_503;
  }
};

const fuehreAblaufAus = async (
  deps: AcceptanceConfirmationDeps,
  req: AcceptanceConfirmationHttpRequest,
): Promise<HandlerResult> => {
  // 1. Methode.
  if (req.method === "OPTIONS") return { status: 200, body: null };
  if (req.method !== "POST") {
    deps.log("Rejected method", { method: req.method });
    return ANTWORT_405;
  }

  // 2. Koerper, begrenzt — er entscheidet, welcher Nachweis gilt.
  let gelesen: Awaited<ReturnType<typeof readBoundedUtf8>>;
  try {
    gelesen = await readBoundedUtf8(
      { contentLength: req.contentLength ?? null, stream: req.body ?? null },
      8 * 1024,
    );
  } catch {
    deps.log("Could not read the request body", { reason: "unreadable_stream" });
    return ANTWORT_400;
  }
  if (!gelesen.ok) {
    if (gelesen.reason === "too_large") {
      deps.log("Rejected body size");
      return { status: 413, body: { error: "payload_too_large" } };
    }
    deps.log("Could not read the request body", { reason: gelesen.reason });
    return ANTWORT_400;
  }

  let roh: unknown;
  try {
    roh = JSON.parse(gelesen.text);
  } catch {
    deps.log("Rejected body", { reason: "malformed_json" });
    return ANTWORT_400;
  }
  const parsed = parseAcceptanceConfirmationRequest(roh);
  if (!parsed.ok) {
    deps.log("Rejected body", { reason: parsed.reason });
    return ANTWORT_400;
  }

  // 3. JWT-Weg: anmelden, bevor die Datenbank beruehrt wird.
  let benutzerId: string | null = null;
  if (parsed.accessToken === null) {
    const jwt = extractBearerToken(req.authorization);
    if (jwt === null) {
      deps.log("Rejected authorization header");
      return ANTWORT_401;
    }
    let benutzer: { userId: string } | null;
    try {
      benutzer = await deps.authenticate(jwt);
    } catch {
      deps.log("Authentication failed");
      return ANTWORT_401;
    }
    if (!benutzer || typeof benutzer.userId !== "string" || benutzer.userId === "") {
      deps.log("Rejected token");
      return ANTWORT_401;
    }
    benutzerId = benutzer.userId;
  }

  // 4. Die Zeile — einzige Quelle fuer Firma, Empfaenger und Sprache.
  const offerZeile = await deps.loadOffer(parsed.offerId);
  if (!offerZeile.ok) {
    deps.log("Offer lookup failed", { offerId: parsed.offerId });
    return ANTWORT_503;
  }
  const offer = offerZeile.value;
  if (!offer) {
    deps.log("Offer not found", { offerId: parsed.offerId });
    return ANTWORT_404;
  }

  // 5. Nachweis gegen die Zeile.
  if (parsed.accessToken !== null) {
    if (!offer.access_token || !tokensEqual(offer.access_token, parsed.accessToken)) {
      deps.log("Access token mismatch", { offerId: offer.id });
      return ANTWORT_404;
    }
  } else {
    const zugehoerig = await deps.isCompanyMember(benutzerId as string, offer.company_id);
    if (!zugehoerig.ok) {
      deps.log("Membership check failed", { offerId: offer.id });
      return ANTWORT_503;
    }
    if (!zugehoerig.isMember) {
      deps.log("Not a member of the offer's company", { offerId: offer.id });
      return ANTWORT_404;
    }
  }

  // ── Ab hier ist der Aufrufer berechtigt ──────────────────────────────────

  if (offer.status !== "accepted") {
    deps.log("Offer is not accepted", { offerId: offer.id });
    return ANTWORT_409;
  }
  if (!offer.customer_email) {
    deps.log("Skipped", { reason: "no_email" });
    return uebersprungen("no_email");
  }

  const schonGesendet = await deps.hasSentConfirmation(offer.id);
  if (!schonGesendet.ok) {
    deps.log("Email log lookup failed", { offerId: offer.id });
    return ANTWORT_503;
  }
  if (schonGesendet.value === true) {
    deps.log("Skipped", { reason: "already_sent" });
    return uebersprungen("already_sent");
  }

  const positionen = await deps.loadOfferItems(offer.id);
  if (!positionen.ok) {
    deps.log("Offer items lookup failed", { offerId: offer.id });
    return ANTWORT_503;
  }

  const firmenZeile = await deps.loadCompany(offer.company_id);
  if (!firmenZeile.ok) {
    deps.log("Company lookup failed", { offerId: offer.id });
    return ANTWORT_503;
  }
  const company = firmenZeile.value;
  if (!company) {
    deps.log("Company not found", { offerId: offer.id });
    return ANTWORT_404;
  }

  // Ein Lesefehler ist kein «kein Schluessel hinterlegt» — sonst ginge die Mail
  // unter der falschen Absenderidentitaet hinaus, weil die Datenbank klemmte.
  const geheimZeile = await deps.loadSecrets(company.id);
  if (!geheimZeile.ok) {
    deps.log("Secret lookup failed", { offerId: offer.id });
    return ANTWORT_503;
  }
  const geheimnisse = geheimZeile.value ?? { resend_api_key: null };
  const globalerSchluessel = deps.defaultResendApiKey();
  let apiKey = globalerSchluessel;
  let from = deps.defaultFrom();
  let isCompanyEmail = false;
  if (company.resend_enabled && geheimnisse.resend_api_key && company.resend_from_email) {
    apiKey = geheimnisse.resend_api_key;
    from = `${company.resend_from_name || company.company_name} <${company.resend_from_email}>`;
    isCompanyEmail = true;
  }

  if (!apiKey) {
    deps.log("Skipped", { reason: "no_api_key" });
    return uebersprungen("no_api_key");
  }

  const locale = deps.toLocale(offer.language);
  const termine = buildAcceptanceTermine(positionen.value ?? [], offer);
  const renderFor = (firmenAbsender: boolean) =>
    deps.renderEmail({ offer, company, termine, isCompanyEmail: firmenAbsender, locale });
  let { subject, html } = renderFor(isCompanyEmail);

  const versenden = async (schluessel: string, absender: string) => {
    try {
      const ergebnis = await deps.sendEmail({
        to: offer.customer_email as string,
        subject,
        html,
        apiKey: schluessel,
        from: absender,
      });
      // `resend.emails.send` liefert `{ error }` zurueck, statt zu werfen.
      return Boolean(ergebnis?.error);
    } catch {
      return true;
    }
  };

  let fehlgeschlagen = await versenden(apiKey, from);

  if (fehlgeschlagen && isCompanyEmail && globalerSchluessel && globalerSchluessel !== apiKey) {
    deps.log("Company key failed, retrying with the shared key", { offerId: offer.id });
    isCompanyEmail = false;
    from = deps.defaultFrom();
    ({ subject, html } = renderFor(false));
    fehlgeschlagen = await versenden(globalerSchluessel, from);
  }

  const kundenName = `${offer.customer_first_name ?? ""} ${offer.customer_last_name ?? ""}`.trim();

  try {
    await deps.logEmail({
      recipientEmail: offer.customer_email,
      recipientName: kundenName || undefined,
      subject,
      emailType: EMAIL_TYPE,
      status: fehlgeschlagen ? "failed" : "sent",
      errorMessage: fehlgeschlagen ? "resend_error" : undefined,
      companyId: company.id,
      leadId: offer.lead_id ?? undefined,
      language: locale,
      // `offer_id` wie in `send-offer`: danach filtert die Detailseite ihre
      // Versandliste, und danach sucht `hasSentConfirmation`.
      metadata: {
        offer_id: offer.id,
        accepted_via: offer.accepted_via,
        isCompanyEmail,
      },
    });
  } catch {
    deps.log("Could not write the email log", { offerId: offer.id });
  }

  if (fehlgeschlagen) {
    deps.log("Email send failed", { offerId: offer.id });
    return { status: 502, body: { error: "email_send_failed" } };
  }

  deps.log("Email sent", { offerId: offer.id });
  return { status: 200, body: { success: true } };
};
