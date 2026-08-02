/**
 * Decision logic for `notify-besichtigung` — validation, authorisation and the order in
 * which side effects may happen.
 *
 * ── Why this file exists ────────────────────────────────────────────────────────────
 *
 * The function is called from the PUBLIC offer page, so it cannot require a JWT and it
 * cannot carry an `x-internal-secret` (a secret shipped to a browser is not a secret).
 * Until now it required nothing at all: it read the recipient address, the company id and
 * the offer's title and total straight from the request body, then loaded that company's
 * Resend credentials and sent mail. Anyone who could reach the URL could send mail to any
 * address, from the victim company's sender identity, with text of their choosing.
 *
 * The offer access token is the capability that already exists for this page, so it is
 * what authorises the call. Everything the mail says, and everyone it goes to, is then
 * read from the row that token unlocked — never from the body.
 *
 * The orchestration lives here rather than in `index.ts` because the property that matters
 * is an ORDERING property ("nothing happens before the token is verified"), and an ordering
 * property is only really tested by running it. `index.ts` cannot run under vitest — it
 * imports from `https://` URLs and uses Deno globals — so the flow takes its collaborators
 * as arguments and the test supplies recording doubles.
 */

// Nur der Typ, nicht der Wert: ein `import type` wird beim Uebersetzen entfernt,
// also holt sich diese Datei damit keine Laufzeitabhaengigkeit ins Haus und
// bleibt unter vitest lauffaehig.
import type { Locale } from "./i18n/index.ts";

// ── Request contract ────────────────────────────────────────────────────────────────
// Five fields. Everything the old contract carried — companyId, companyEmail, companyName,
// customerEmail, customerName, customerPhone, offerTitle, offerTotal — is gone, because
// every one of them was a value the caller could choose and the mail then believed.

export interface NotifyBesichtigungRequest {
  offerId: string;
  accessToken: string;
  besichtigungDate: string;
  besichtigungTime: string | null;
  customerNote: string | null;
}

export const ERLAUBTE_FELDER = [
  "offerId",
  "accessToken",
  "besichtigungDate",
  "besichtigungTime",
  "customerNote",
] as const;

/** A note longer than this is refused rather than truncated — truncation hides intent. */
export const MAX_NOTE_LENGTH = 2000;

/** One besichtigung mail per offer per minute. Mirrors notify-offer-response. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `offers.access_token` defaults to 32 hex chars; older rows may differ in length. */
const TOKEN = /^[A-Za-z0-9_-]{10,128}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * `reason?: undefined` im Erfolgsfall ist Absicht, kein Fuellwort: `tsconfig.app.json`
 * setzt `strict: false`, und ohne `strictNullChecks` verengt TypeScript eine Union nach
 * `if (!x.ok)` nicht zuverlaessig — `x.reason` waere dort ein Fehler. Mit dem optionalen
 * Feld ist der Zugriff auf beiden Zweigen gueltig und bleibt typsicher (im Erfolgsfall
 * eben `undefined`). Deno uebersetzt strict; diese Datei soll unter beiden Einstellungen
 * fehlerfrei sein, ohne Unterdrueckung.
 */
export type ParseResult =
  | { ok: true; value: NotifyBesichtigungRequest; reason?: undefined }
  | { ok: false; reason: string };

/**
 * Strict body validation. Unknown fields are a refusal, not something to ignore: a body
 * that still carries `companyEmail` is a caller working from the old contract, and
 * silently dropping it would let that caller believe the field still steers anything.
 */
export const parseNotifyBesichtigungRequest = (raw: unknown): ParseResult => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "body_not_object" };
  }
  const body = raw as Record<string, unknown>;

  const unbekannt = Object.keys(body).filter(
    (k) => !(ERLAUBTE_FELDER as readonly string[]).includes(k),
  );
  if (unbekannt.length > 0) {
    return { ok: false, reason: `unknown_fields:${unbekannt.sort().join(",")}` };
  }

  if (typeof body.offerId !== "string" || !UUID.test(body.offerId)) {
    return { ok: false, reason: "offerId_invalid" };
  }
  // The token is validated for SHAPE only. Its value never reaches a log line or an
  // error message — a leaked token in a log is the same incident as a leaked token.
  if (typeof body.accessToken !== "string" || !TOKEN.test(body.accessToken)) {
    return { ok: false, reason: "accessToken_invalid" };
  }
  if (typeof body.besichtigungDate !== "string" || !istEchtesDatum(body.besichtigungDate)) {
    return { ok: false, reason: "besichtigungDate_invalid" };
  }

  const zeit = body.besichtigungTime;
  if (zeit !== undefined && zeit !== null && (typeof zeit !== "string" || !TIME.test(zeit))) {
    return { ok: false, reason: "besichtigungTime_invalid" };
  }

  const notiz = body.customerNote;
  if (notiz !== undefined && notiz !== null) {
    if (typeof notiz !== "string") return { ok: false, reason: "customerNote_invalid" };
    if (notiz.length > MAX_NOTE_LENGTH) return { ok: false, reason: "customerNote_too_long" };
  }

  return {
    ok: true,
    value: {
      offerId: body.offerId,
      accessToken: body.accessToken,
      besichtigungDate: body.besichtigungDate,
      besichtigungTime: (zeit as string | null | undefined) ?? null,
      customerNote: (notiz as string | null | undefined) ?? null,
    },
  };
};

/** `2026-02-30` matches the pattern but is not a date. */
const istEchtesDatum = (s: string): boolean => {
  if (!DATE.test(s)) return false;
  const [j, m, t] = s.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t;
};

// ── Offer eligibility ───────────────────────────────────────────────────────────────

export interface OfferRow {
  id: string;
  company_id: string;
  status: string;
  superseded_at: string | null;
  valid_until: string | null;
  service_date: string | null;
  language: string | null;
  title: string;
  total: number | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string | null;
}

export type EligibilityResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

/**
 * The acceptance deadline the public page shows: the earlier of `valid_until` and the day
 * before `service_date`. Mirrors `getAcceptanceDeadline` in OfferView.tsx — the server must
 * not accept what the UI would have refused, because the UI is only a suggestion.
 */
export const computeAcceptanceDeadline = (
  validUntil: string | null,
  serviceDate: string | null,
): string | null => {
  const kandidaten: string[] = [];
  if (validUntil && DATE.test(validUntil)) kandidaten.push(validUntil);
  if (serviceDate && DATE.test(serviceDate)) {
    const d = new Date(`${serviceDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    kandidaten.push(d.toISOString().slice(0, 10));
  }
  if (kandidaten.length === 0) return null;
  return kandidaten.sort()[0];
};

/**
 * Same three conditions the page uses to decide whether it offers the button at all:
 * status is `sent` or `viewed`, the version is not superseded, the deadline has not passed.
 */
export const evaluateOfferEligibility = (offer: OfferRow, heute: string): EligibilityResult => {
  if (offer.superseded_at !== null) return { ok: false, reason: "superseded" };
  if (offer.status !== "sent" && offer.status !== "viewed") {
    return { ok: false, reason: "status_not_open" };
  }
  const frist = computeAcceptanceDeadline(offer.valid_until, offer.service_date);
  if (frist !== null && heute > frist) return { ok: false, reason: "expired" };
  return { ok: true };
};

// ── Orchestration ───────────────────────────────────────────────────────────────────

export interface CompanyRow {
  id: string;
  company_name: string;
  email: string;
  notification_email: string | null;
  default_language: string | null;
  resend_enabled: boolean | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
}

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  /** Aufgeloest aus der geprueften Firmenzeile — der Aufrufer raet nichts. */
  apiKey: string;
  from: string;
}

export interface RenderContext {
  offer: OfferRow;
  company: CompanyRow;
  request: NotifyBesichtigungRequest;
  isCompanyEmail: boolean;
  customerLocale: Locale;
  companyLocale: Locale;
}

/**
 * Was der Guard von einem Secret-Traeger braucht: den Resend-Schluessel, sonst nichts.
 * Absichtlich nicht `Record<string, unknown>` — eine Schnittstelle wie `CompanySecrets`
 * ist darauf unter `strict` nicht zuweisbar (Interfaces bekommen keine implizite
 * Indexsignatur), und der Aufrufer muesste casten. Ein Cast an einer Stelle, an der die
 * Typen wirklich verschieden sind, ist eine unterdrueckte Frage, keine Antwort.
 */
export interface CompanySecretsLike {
  resend_api_key?: string | null;
}

/** Die Felder, die dieser Ablauf wirklich protokolliert. */
export interface EmailLogEntry {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  emailType: string;
  status: "sent" | "failed";
  errorMessage?: string;
  companyId?: string;
  language?: Locale;
  metadata?: Record<string, unknown>;
}

export interface NotifyBesichtigungDeps {
  /** Loads the offer by id AND token together — one query, no separate existence probe. */
  loadOffer(offerId: string, accessToken: string): Promise<OfferRow | null>;
  loadCompany(companyId: string): Promise<CompanyRow | null>;
  /** Persistent per-offer cooldown over email_logs. `error` non-null ⇒ unknown ⇒ refuse. */
  countRecentBesichtigungEmails(
    offerId: string,
    sinceIso: string,
  ): Promise<{ count: number | null; error: unknown }>;
  loadSecrets(companyId: string): Promise<CompanySecretsLike>;
  sendEmail(args: SendArgs): Promise<{ id?: string; error?: unknown }>;
  logEmail(entry: EmailLogEntry): Promise<void>;
  insertNotification(entry: Record<string, unknown>): Promise<void>;
  renderCompanyEmail(ctx: RenderContext): { subject: string; html: string };
  renderCustomerEmail(ctx: RenderContext): { subject: string; html: string };
  toLocale(value: unknown): Locale;
  defaultResendApiKey(): string | undefined;
  defaultFrom(): string;
  now(): number;
  log(step: string, details?: Record<string, unknown>): void;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * The whole flow, in the order the ordering property demands.
 *
 * Nothing that costs money, sends mail, reads a secret or writes a row happens before the
 * token has matched a row. `loadSecrets`, `sendEmail`, `logEmail` and `insertNotification`
 * are all reached only after step 3.
 */
export const handleNotifyBesichtigung = async (
  deps: NotifyBesichtigungDeps,
  rawBody: unknown,
): Promise<HandlerResult> => {
  // 1. Shape.
  const parsed = parseNotifyBesichtigungRequest(rawBody);
  if (!parsed.ok) {
    deps.log("Rejected body", { reason: parsed.reason });
    return { status: 400, body: { error: "Ungültige Anfrage." } };
  }
  const request = parsed.value;

  // 2. Capability. id AND token in one query; a miss says nothing about which of the two
  //    was wrong, so the response cannot be used to enumerate offers.
  const offer = await deps.loadOffer(request.offerId, request.accessToken);
  if (!offer) {
    deps.log("Token validation failed", { offerId: request.offerId });
    return { status: 403, body: { error: "Ungültiger Token" } };
  }

  // 3. Same conditions the page applies before it shows the button.
  const heute = new Date(deps.now()).toISOString().slice(0, 10);
  const eignung = evaluateOfferEligibility(offer, heute);
  if (!eignung.ok) {
    deps.log("Offer not eligible", { offerId: offer.id, reason: eignung.reason });
    return { status: 409, body: { error: "Diese Offerte kann nicht mehr beantwortet werden." } };
  }

  // 4. Cooldown. A leaked but still valid token would otherwise be a mail cannon: this
  //    path never changes the offer status, so nothing else would stop a repeat.
  //
  //    Diese Sperre ist SEQUENZIELL und best-effort, nicht atomar: gezaehlt wird, was
  //    bereits in `email_logs` steht. Zwei Anfragen, die sich ueberlappen, sehen beide
  //    den Stand von vorher und kommen beide durch — das Fenster ist die Zeit zwischen
  //    Zaehlung und erstem Log-Eintrag. Gegen wiederholtes Feuern mit einem geleakten
  //    Token wirkt sie; gegen einen parallelen Schwall nicht, und das wird hier auch
  //    nicht behauptet. Eine atomare Sperre braucht einen Zaehler mit eigener
  //    Transaktion (z. B. `consume_rate_limit`) und damit eine Migration — bewusst
  //    eine eigene Phase, nicht hier.
  const seit = new Date(deps.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const rl = await deps.countRecentBesichtigungEmails(offer.id, seit);
  if (rl.error) {
    // Fail closed. An unreadable counter is not a licence to send.
    deps.log("Rate-limit query failed", { offerId: offer.id });
    return { status: 503, body: { error: "Vorübergehend nicht verfügbar." } };
  }
  if ((rl.count ?? 0) >= 1) {
    deps.log("Rate-limited", { offerId: offer.id });
    return { status: 429, body: { error: "Zu viele Anfragen. Bitte warten Sie einen Moment." } };
  }

  // 5. Company — by the offer's company_id, never by a body field.
  const company = await deps.loadCompany(offer.company_id);
  if (!company) {
    deps.log("Company not found", { companyId: offer.company_id });
    return { status: 500, body: { error: "Firma nicht gefunden." } };
  }
  const secrets = await deps.loadSecrets(offer.company_id);

  const customerLocale = deps.toLocale(offer.language);
  const companyLocale = deps.toLocale(company.default_language);

  let resendApiKey = deps.defaultResendApiKey();
  let fromAddress = deps.defaultFrom();
  let isCompanyEmail = false;
  if (company.resend_enabled && secrets.resend_api_key && company.resend_from_email) {
    resendApiKey = secrets.resend_api_key;
    fromAddress = `${company.resend_from_name || company.company_name} <${company.resend_from_email}>`;
    isCompanyEmail = true;
  }
  if (!resendApiKey) {
    deps.log("No Resend API key configured, skipping email");
    return { status: 200, body: { success: true, message: "Email notification skipped" } };
  }

  const ctx: RenderContext = { offer, company, request, isCompanyEmail, customerLocale, companyLocale };
  const kundenName = `${offer.customer_first_name} ${offer.customer_last_name}`.trim();
  // The firm's address comes from the row, with the dedicated notification address winning.
  const firmenEmpfaenger = company.notification_email || company.email;

  const gemeinsam = {
    offerId: offer.id,
    offerTitle: offer.title,
    besichtigungDate: request.besichtigungDate,
    besichtigungTime: request.besichtigungTime,
    isCompanyEmail,
  };

  // 6. Company mail.
  const firma = deps.renderCompanyEmail(ctx);
  const firmaErgebnis = await deps.sendEmail({
    to: firmenEmpfaenger,
    subject: firma.subject,
    html: firma.html,
    apiKey: resendApiKey,
    from: fromAddress,
  });

  if (firmaErgebnis.error) {
    // A provider error is a failure, and it is logged as one. Writing "sent" here was the
    // other half of the problem: the log would have claimed a delivery that never happened.
    deps.log("Error sending company email");
    await deps.logEmail({
      recipientEmail: firmenEmpfaenger,
      recipientName: company.company_name,
      subject: firma.subject,
      emailType: "besichtigung_request",
      status: "failed",
      errorMessage: "resend_error",
      companyId: company.id,
      language: companyLocale,
      metadata: gemeinsam,
    });
    return { status: 502, body: { error: "E-Mail konnte nicht gesendet werden." } };
  }

  await deps.logEmail({
    recipientEmail: firmenEmpfaenger,
    recipientName: company.company_name,
    subject: firma.subject,
    emailType: "besichtigung_request",
    status: "sent",
    companyId: company.id,
    language: companyLocale,
    metadata: gemeinsam,
  });

  // 7. In-app notification — every identifier from the verified rows.
  await deps.insertNotification({
    company_id: company.id,
    type: "besichtigung_request",
    title: "👀 Besichtigungsanfrage erhalten",
    body: `${kundenName} wünscht eine Besichtigung am ${request.besichtigungDate}${
      request.besichtigungTime ? ` um ${request.besichtigungTime} Uhr` : ""
    } für "${offer.title}".`,
    metadata: {
      offer_id: offer.id,
      offer_title: offer.title,
      customer_name: kundenName,
      customer_email: offer.customer_email,
      customer_phone: offer.customer_phone,
      besichtigung_date: request.besichtigungDate,
      besichtigung_time: request.besichtigungTime,
      customer_note: request.customerNote,
    },
  });

  // 8. Customer confirmation — to the address on the offer row.
  const kunde = deps.renderCustomerEmail(ctx);
  const kundeErgebnis = await deps.sendEmail({
    to: offer.customer_email,
    subject: kunde.subject,
    html: kunde.html,
    apiKey: resendApiKey,
    from: fromAddress,
  });

  if (kundeErgebnis.error) {
    deps.log("Error sending customer confirmation email");
    await deps.logEmail({
      recipientEmail: offer.customer_email,
      recipientName: kundenName,
      subject: kunde.subject,
      emailType: "besichtigung_confirmation",
      status: "failed",
      errorMessage: "resend_error",
      companyId: company.id,
      language: customerLocale,
      metadata: gemeinsam,
    });
    // The firm was already told; the run is not rolled back for the confirmation copy.
  } else {
    await deps.logEmail({
      recipientEmail: offer.customer_email,
      recipientName: kundenName,
      subject: kunde.subject,
      emailType: "besichtigung_confirmation",
      status: "sent",
      companyId: company.id,
      language: customerLocale,
      metadata: gemeinsam,
    });
  }

  return {
    status: 200,
    body: {
      success: true,
      companyEmailId: firmaErgebnis.id,
      customerEmailId: kundeErgebnis.id,
      customerEmailSent: !kundeErgebnis.error,
      isCompanyEmail,
    },
  };
};
