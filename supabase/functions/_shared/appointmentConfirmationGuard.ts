/**
 * Wer die Terminbestaetigung ausloesen darf — und in welcher Reihenfolge das
 * geprueft wird.
 *
 * ── Was vorher moeglich war ─────────────────────────────────────────────────
 *
 * `send-appointment-confirmation` nahm einen Anfragekoerper entgegen, baute
 * sofort einen Client mit dem Service-Role-Schluessel und arbeitete los. Kein
 * JWT, keine Firmenzugehoerigkeit, keine Methodenpruefung. Wer eine Termin-UUID
 * kannte — sie steht in Kalenderlinks, ICS-Dateien und Mails —, konnte damit
 * beliebig oft eine Mail an den ECHTEN Kunden einer FREMDEN Firma ausloesen,
 * unter deren Absenderidentitaet und auf deren Resend-Kontingent.
 *
 * Die Empfaengeradresse liess sich nicht setzen; das ist der einzige Grund,
 * warum es kein offener Relay war. Es blieb eine anmeldungsfreie Ausloesung
 * kostenpflichtiger Nebenwirkungen im Namen Dritter.
 *
 * Zusaetzlich war die Antwort ein Orakel: `404` gegen `skipped: type` gegen
 * `skipped: no_email` gegen `skipped: no_api_key` verriet, ob eine UUID
 * existiert, welchen Typ der Termin hat, ob eine Kundenadresse hinterlegt ist
 * und ob die Firma einen eigenen Mailzugang besitzt.
 *
 * ── Was jetzt gilt ──────────────────────────────────────────────────────────
 *
 * Ein echtes Benutzer-JWT, und der Benutzer muss Mitglied der Firma sein, zu
 * der der Termin gehoert. „Termin gibt es nicht" und „Termin gehoert einer
 * anderen Firma" beantworten dieselbe Antwort mit demselben Koerper — sonst
 * bliebe das Orakel bestehen.
 *
 * Die Pruefung liegt hier und nicht im Gateway. Auf dieser Installation wird
 * `verify_jwt` nicht ausgewertet: der Edge-Container laeuft mit global
 * abgeschalteter Pruefung, und Kong reicht `/functions/v1/*` ohne Auth-Plugin
 * durch. Ein `verify_jwt = true` waere kein Schutz, sondern eine Zeile, die im
 * Repo wie einer aussieht.
 *
 * ── Warum diese Datei ohne Deno auskommt ────────────────────────────────────
 *
 * Damit die Reihenfolge pruefbar ist. Genau sie traegt die Zusicherung: mit
 * einer fremden Termin-UUID darf kein Geheimnis gelesen, keine Mail geschickt
 * und keine Protokollzeile geschrieben werden. Das laesst sich nur zeigen,
 * wenn man den Ablauf mit aufzeichnenden Doppeln ausfuehren kann.
 */

import { MAX_BODY_BYTES, readBoundedUtf8 } from "./boundedBody.ts";
import type { Locale } from "./i18n/index.ts";

// ── Eingabevertrag ──────────────────────────────────────────────────────────

export const ALLOWED_FIELDS = ["appointmentId"] as const;

/**
 * Felder, mit denen der Endpunkt frueher haette gefuettert werden koennen. Sie
 * stehen hier, damit jedes einzeln durchprobiert werden kann: keines darf je
 * bestimmen, wer eine Mail bekommt oder was darin steht.
 */
export const REJECTED_LEGACY_FIELDS = [
  "customerEmail",
  "companyId",
  "companyEmail",
  "language",
  "subject",
  "html",
  "resendApiKey",
  "from",
  "to",
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const istUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Termintypen, die nie eine Kundenmail ausloesen. */
export const SKIP_TYPES: readonly string[] = ["blocked", "meeting"];

export type ParseResult =
  | { ok: true; appointmentId: string; reason?: undefined }
  | { ok: false; reason: string };

export const parseConfirmationRequest = (raw: unknown): ParseResult => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "body_not_object" };
  }
  const body = raw as Record<string, unknown>;

  const fremd = Object.keys(body).filter((k) => !(ALLOWED_FIELDS as readonly string[]).includes(k));
  if (fremd.length > 0) return { ok: false, reason: `unknown_fields:${fremd.sort().join(",")}` };

  if (!istUuid(body.appointmentId)) return { ok: false, reason: "appointmentId_invalid" };
  return { ok: true, appointmentId: body.appointmentId };
};

/**
 * `Authorization: Bearer <token>` — streng. Genau zwei Teile, das Schema
 * genau so geschrieben, der Rest nicht leer. `Basic`, ein leeres `Bearer` oder
 * ein dritter Teil sind kein Nachweis.
 */
export const extractBearerToken = (header: string | null | undefined): string | null => {
  if (typeof header !== "string") return null;
  const teile = header.split(" ");
  if (teile.length !== 2) return null;
  if (teile[0] !== "Bearer") return null;
  return teile[1].length > 0 ? teile[1] : null;
};

// ── Zeilen aus der Datenbank ────────────────────────────────────────────────

export interface AppointmentRow {
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
  language: string | null;
}

export interface CompanyRow {
  id: string;
  company_name: string;
  email: string;
  phone: string | null;
  resend_enabled: boolean | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
}

export interface CompanySecretsLike {
  resend_api_key: string | null;
}

/**
 * Die Mitgliedschaft als DREI Zustaende, nicht zwei. „Die Abfrage ist
 * fehlgeschlagen" ist etwas anderes als „der Benutzer gehoert nicht dazu": das
 * eine ist eine Stoerung, das andere eine Absage. Beides auf `false`
 * abzubilden — wie es der gemeinsame Helfer tut — verschluckt einen
 * Betriebsfehler und laesst ihn wie ein Rechteproblem aussehen.
 */
export type MembershipResult =
  | { ok: true; isMember: boolean }
  | { ok: false };

/**
 * Dasselbe Prinzip fuer jedes Nachschlagen: „die Abfrage ist fehlgeschlagen"
 * ist etwas anderes als „es gibt die Zeile nicht".
 *
 * Beides auf `null` abzubilden — wie es der Supabase-Client nahelegt — macht
 * aus einer Stoerung ein `404`. Der Aufrufer wuerde dann einen Termin fuer
 * geloescht halten, der nur gerade nicht erreichbar war.
 */
export type LookupResult<T> =
  | { ok: true; value: T | null }
  | { ok: false; value?: undefined };

export interface RenderContext {
  appointment: AppointmentRow;
  company: CompanyRow;
  isCompanyEmail: boolean;
  locale: Locale;
}

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  apiKey: string;
  from: string;
}

export interface EmailLogEntry {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  emailType: string;
  status: "sent" | "failed";
  errorMessage?: string;
  companyId?: string;
  leadId?: string;
  language?: Locale;
  metadata?: Record<string, unknown>;
}

export interface ConfirmationDeps {
  /** Loest ein JWT in einen Benutzer auf. `null` heisst: kein gueltiger Benutzer. */
  authenticate(token: string): Promise<{ userId: string } | null>;
  loadAppointment(appointmentId: string): Promise<LookupResult<AppointmentRow>>;
  isCompanyMember(userId: string, companyId: string): Promise<MembershipResult>;
  loadCompany(companyId: string): Promise<LookupResult<CompanyRow>>;
  loadSecrets(companyId: string): Promise<LookupResult<CompanySecretsLike>>;
  renderEmail(ctx: RenderContext): { subject: string; html: string };
  sendEmail(args: SendArgs): Promise<{ id?: string; error?: unknown }>;
  logEmail(entry: EmailLogEntry): Promise<void>;
  toLocale(value: unknown): Locale;
  defaultResendApiKey(): string | undefined;
  defaultFrom(): string;
  log(step: string, details?: Record<string, unknown>): void;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown> | null;
  headers?: Record<string, string>;
}

export interface ConfirmationHttpRequest {
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
/** Ein Koerper fuer beide Faelle: „gibt es nicht" und „gehoert dir nicht". */
const ANTWORT_404: HandlerResult = { status: 404, body: { error: "not_found" } };
const ANTWORT_503: HandlerResult = { status: 503, body: { error: "service_unavailable" } };

const uebersprungen = (reason: string): HandlerResult => ({
  status: 200,
  body: { success: true, skipped: true, reason },
});

/**
 * Der ganze Ablauf in der Reihenfolge, die die Zusicherung traegt.
 *
 * Nichts, was ein Geheimnis liest, Geld kostet oder eine Zeile schreibt,
 * passiert vor Schritt 8. Eine Anfrage mit falscher Methode wird beantwortet,
 * ohne dass ihr Koerper Speicher kostet; eine ohne gueltiges JWT beruehrt die
 * Datenbank ueberhaupt nicht.
 *
 * Aussen herum liegt ein Fangnetz. Jede Abhaengigkeit kann werfen — ein
 * Netzfehler im Client, ein kaputter Uebersetzungsschluessel, ein Renderer,
 * der ueber einen unerwarteten Wert stolpert. Ohne dieses Netz traegt die
 * Ausnahme ihre Meldung und ihren Stapel bis in die Antwort der Laufzeit, und
 * darin steht dann, was gerade in der Hand war: Adressen, Schluessel,
 * Anfrageparameter. Nach aussen geht deshalb IMMER eine feste Antwort, und ins
 * Protokoll nur ein Kennzeichen ohne die Ausnahme selbst.
 */
export const handleAppointmentConfirmation = async (
  deps: ConfirmationDeps,
  req: ConfirmationHttpRequest,
): Promise<HandlerResult> => {
  try {
    return await fuehreAblaufAus(deps, req);
  } catch {
    // Absichtlich ohne den Fehler: weder Meldung noch Stapel noch Ursache.
    try {
      deps.log("Unhandled dependency failure");
    } catch {
      /* selbst das Protokoll darf scheitern, ohne die Antwort zu aendern */
    }
    return ANTWORT_503;
  }
};

const fuehreAblaufAus = async (
  deps: ConfirmationDeps,
  req: ConfirmationHttpRequest,
): Promise<HandlerResult> => {
  // 1. Methode.
  if (req.method === "OPTIONS") return { status: 200, body: null };
  if (req.method !== "POST") {
    deps.log("Rejected method", { method: req.method });
    return ANTWORT_405;
  }

  // 2. Nachweis — VOR dem Lesen des Koerpers. Ein Fremder soll nicht einmal
  //    8 KiB Speicher belegen koennen.
  const token = extractBearerToken(req.authorization);
  if (token === null) {
    deps.log("Rejected authorization header");
    return ANTWORT_401;
  }

  // 3. Wer ist das? Der Wert des Tokens wird nirgends weitergereicht.
  let benutzer: { userId: string } | null;
  try {
    benutzer = await deps.authenticate(token);
  } catch {
    deps.log("Authentication failed");
    return ANTWORT_401;
  }
  if (!benutzer || typeof benutzer.userId !== "string" || benutzer.userId === "") {
    deps.log("Rejected token");
    return ANTWORT_401;
  }

  // 4. Koerper, begrenzt.
  // `readBoundedUtf8` faengt Lesefehler selbst ab; `getReader()` kann aber
  // werfen, etwa wenn der Strom schon gesperrt ist. Das ist eine unbrauchbare
  // Anfrage und keine Stoerung des Dienstes.
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

  // 5. Form.
  let roh: unknown;
  try {
    roh = JSON.parse(gelesen.text);
  } catch {
    deps.log("Rejected body", { reason: "malformed_json" });
    return ANTWORT_400;
  }
  const parsed = parseConfirmationRequest(roh);
  if (!parsed.ok) {
    deps.log("Rejected body", { reason: parsed.reason });
    return ANTWORT_400;
  }

  // 6. Die Zeile. Sie ist die einzige Quelle der Firmenzugehoerigkeit — die
  //    kann nicht aus dem Anfragekoerper kommen, sonst waere sie behauptet
  //    statt geprueft.
  const terminZeile = await deps.loadAppointment(parsed.appointmentId);
  if (!terminZeile.ok) {
    deps.log("Appointment lookup failed", { appointmentId: parsed.appointmentId });
    return ANTWORT_503;
  }
  const appointment = terminZeile.value;
  if (!appointment) {
    deps.log("Appointment not found", { appointmentId: parsed.appointmentId });
    return ANTWORT_404;
  }

  // 7. Zugehoerigkeit. Jedes Mitglied genuegt: die RLS-Policy
  //    `appointments_manage_member` erlaubt jedem Mitglied das ANLEGEN eines
  //    Termins, und wer anlegen darf, muss die Bestaetigung ausloesen duerfen.
  //    Eine Rollenhuerde hier wuerde den Normalweg fuer gewoehnliche
  //    Mitglieder stillschweigend kaputtmachen.
  const zugehoerig = await deps.isCompanyMember(benutzer.userId, appointment.company_id);
  if (!zugehoerig.ok) {
    // Stoerung, nicht Absage. Auf 403 abzubilden wuerde eine kaputte Datenbank
    // als Rechteproblem tarnen.
    deps.log("Membership check failed", { appointmentId: appointment.id });
    return ANTWORT_503;
  }
  if (!zugehoerig.isMember) {
    // Bewusst dieselbe Antwort wie „gibt es nicht": sonst liesse sich der
    // Endpunkt zum Durchprobieren fremder Termin-ids benutzen.
    deps.log("Not a member of the appointment's company", { appointmentId: appointment.id });
    return ANTWORT_404;
  }

  // ── Ab hier ist der Aufrufer berechtigt ──────────────────────────────────

  if (SKIP_TYPES.includes(appointment.appointment_type)) {
    deps.log("Skipped", { reason: "type" });
    return uebersprungen("type");
  }
  if (!appointment.customer_email) {
    deps.log("Skipped", { reason: "no_email" });
    return uebersprungen("no_email");
  }

  const firmenZeile = await deps.loadCompany(appointment.company_id);
  if (!firmenZeile.ok) {
    deps.log("Company lookup failed", { appointmentId: appointment.id });
    return ANTWORT_503;
  }
  const company = firmenZeile.value;
  if (!company) {
    deps.log("Company not found", { appointmentId: appointment.id });
    return ANTWORT_404;
  }

  // Erst jetzt das Geheimnis — und auch hier: ein Lesefehler ist kein
  // „kein Schluessel hinterlegt". Still auf den allgemeinen Zugang
  // auszuweichen wuerde die Mail unter der falschen Absenderidentitaet
  // verschicken, weil die Datenbank gerade klemmte.
  const geheimZeile = await deps.loadSecrets(company.id);
  if (!geheimZeile.ok) {
    deps.log("Secret lookup failed", { appointmentId: appointment.id });
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

  const locale = deps.toLocale(appointment.language);
  const { subject, html } = deps.renderEmail({ appointment, company, isCompanyEmail, locale });

  const versenden = async (schluessel: string, absender: string) => {
    try {
      const ergebnis = await deps.sendEmail({
        to: appointment.customer_email as string,
        subject,
        html,
        apiKey: schluessel,
        from: absender,
      });
      // `resend.emails.send` liefert `{ error }` zurueck, statt zu werfen —
      // das ist ein ECHTER Fehlschlag.
      return Boolean(ergebnis?.error);
    } catch {
      return true;
    }
  };

  let fehlgeschlagen = await versenden(apiKey, from);

  // Rueckfall auf den allgemeinen Zugang, wenn der eigene der Firma versagt.
  if (fehlgeschlagen && isCompanyEmail && globalerSchluessel && globalerSchluessel !== apiKey) {
    deps.log("Company key failed, retrying with the shared key", { appointmentId: appointment.id });
    isCompanyEmail = false;
    from = deps.defaultFrom();
    fehlgeschlagen = await versenden(globalerSchluessel, from);
  }

  const kundenName =
    `${appointment.customer_first_name ?? ""} ${appointment.customer_last_name ?? ""}`.trim();

  try {
    await deps.logEmail({
      recipientEmail: appointment.customer_email,
      recipientName: kundenName || undefined,
      subject,
      emailType: "appointment_confirmation",
      status: fehlgeschlagen ? "failed" : "sent",
      // Nichtssagend mit Absicht: die Antwort des Anbieters kann Adresse und
      // Teile des Inhalts enthalten und wird spaeter im Dashboard angezeigt.
      errorMessage: fehlgeschlagen ? "resend_error" : undefined,
      companyId: company.id,
      leadId: appointment.lead_id ?? undefined,
      language: locale,
      metadata: {
        appointmentId: appointment.id,
        appointmentType: appointment.appointment_type,
        isCompanyEmail,
      },
    });
  } catch {
    deps.log("Could not write the email log", { appointmentId: appointment.id });
  }

  if (fehlgeschlagen) {
    deps.log("Email send failed", { appointmentId: appointment.id });
    // Ohne das Anbieterobjekt: es ging frueher als `details` an den Client.
    return { status: 502, body: { error: "email_send_failed" } };
  }

  deps.log("Email sent", { appointmentId: appointment.id });
  // Ohne die Kennung des Anbieters — sie gehoert nicht in eine Antwort, und
  // der Aufrufer wertet nur `success` und `skipped` aus.
  return { status: 200, body: { success: true } };
};
