/**
 * Was beim oeffentlichen Absagen eines Termins geprueft wird — und in welcher
 * Reihenfolge etwas passieren darf.
 *
 * ── Der Vertrauensgrenzwechsel in einem Satz ────────────────────────────────
 *
 * Frueher glaubte `notify-appointment-cancelled` dem Anfragekoerper, wer der
 * Kunde ist, welche Firma betroffen ist und an welche Adressen geschrieben
 * wird. Der Endpunkt verlangte keinen Nachweis und verschickte trotzdem Mails.
 * Jetzt glaubt er nur einem: dem Capability-Token aus B.2.1. Alles Weitere —
 * Empfaenger, Firmenname, Sprache, Absagegrund — kommt aus den Zeilen, die
 * dieser Token aufschliesst.
 *
 * ── Warum diese Datei existiert ─────────────────────────────────────────────
 *
 * `index.ts` importiert von `https://`-URLs und benutzt Deno-Globals; dort
 * laesst sich nichts ausfuehren, was Vitest sehen koennte. Deshalb steht hier
 * die Entscheidungslogik und bekommt ihre Mitspieler (Datenbank, Resend,
 * Protokoll) hereingereicht. Getestet wird derselbe Ablauf, den die Edge
 * Function nimmt, nicht eine Nachbildung davon.
 *
 * ── Zusicherungen, die das Zusammenspiel traegt ─────────────────────────────
 *
 * Zustandsuebergang: GENAU EINMAL. Das garantiert nicht diese Datei, sondern
 * `cancel_appointment_by_action_token` in der Datenbank — ein Aufruf unter
 * einer Zeilensperre. Ein zweiter Klick bekommt `already_cancelled` und loest
 * nichts mehr aus.
 *
 * E-Mail: HOECHSTENS EINMAL, und nur als bestes Bemuehen. Der Versand haengt
 * am Ergebnis `cancelled_now`, und das gibt es pro Termin nur ein einziges Mal.
 * Faellt der Edge-Prozess zwischen dem Commit der Datenbank und dem Versand
 * aus, geht KEINE Mail raus — die Absage steht trotzdem. Das ist bewusst so:
 * ein Wiederholungsversuch wuerde `already_cancelled` sehen und schweigen,
 * und ein Wiederholungsversuch VOR der Antwort koennte doppelt zustellen.
 * Diese Phase verspricht ausdruecklich kein exactly-once fuer Mails; wer das
 * braucht, braucht ein Outbox-Muster, und das ist eine eigene Architekturstufe.
 *
 * ── Warum hier keine Ratenbegrenzung steht ──────────────────────────────────
 *
 * Die teure Nebenwirkung haengt bereits an einem einmaligen, atomaren Ergebnis.
 * Zufaellig geratene Tokens erzeugen keine Mail, sie erzeugen `403`. Eine
 * Begrenzung pro Termin-id waere sogar schaedlich: ein Angreifer koennte damit
 * das Kontingent eines echten Kunden aufbrauchen und ihm gezielt die Absage
 * verbauen. Eine Begrenzung pro Token-Hash waere unbegrenzt viele Zeilen fuer
 * unbegrenzt viele geratene Tokens. Es bleibt bei Methode, Groesse, Form und
 * Capability.
 */

// Nur der Typ, nicht der Wert: `import type` verschwindet beim Uebersetzen,
// diese Datei bleibt also frei von Laufzeitabhaengigkeiten.
import type { Locale } from "./i18n/index.ts";

// ── Eingabevertrag ──────────────────────────────────────────────────────────

export interface AppointmentCancellationRequest {
  appointmentId: string;
  actionToken: string;
  reason: string | null;
}

/** Mehr als diese drei Felder darf der Koerper nicht enthalten. */
export const ALLOWED_FIELDS = ["appointmentId", "actionToken", "reason"] as const;

/**
 * Die Felder, mit denen der alte Endpunkt gefuettert wurde. Sie stehen hier
 * nicht, damit sie geduldet werden, sondern damit der Test jedes einzeln
 * durchprobieren kann: keines davon darf noch bestimmen, wer eine Mail bekommt
 * oder was darin steht.
 */
export const REJECTED_LEGACY_FIELDS = [
  "appointmentTitle",
  "appointmentDate",
  "appointmentTime",
  "customerName",
  "customerEmail",
  "companyEmail",
  "companyName",
  "companyId",
  "language",
  "cancellationReason",
] as const;

export const MAX_BODY_BYTES = 8 * 1024;
export const MAX_REASON_LENGTH = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `reason?: undefined` am Erfolgszweig ist kein Zierrat: das Projekt uebersetzt
 * ohne `strict`, und ohne dieses Feld verengt TypeScript die Union nach
 * `if (!parsed.ok)` nicht zuverlaessig.
 */
export type ParseResult =
  | { ok: true; value: AppointmentCancellationRequest; reason?: undefined }
  | { ok: false; reason: string };

/** Groesse in BYTES, nicht in Zeichen — ein Emoji ist vier Bytes und ein Zeichen. */
export const bodyByteLength = (text: string): number =>
  new TextEncoder().encode(text).length;

// ── Begrenzter Koerperleser ─────────────────────────────────────────────────

export type BoundedBodyResult =
  | { ok: true; text: string; bytes: number; reason?: undefined }
  | { ok: false; reason: "too_large" | "invalid_encoding" | "read_error"; text?: undefined };

export interface BodySource {
  /** Der Kopf `Content-Length`, so wie er ankam. Roh, ungeprueft. */
  contentLength: string | null;
  stream: ReadableStream<Uint8Array> | null;
}

/**
 * Liest hoechstens `maxBytes` Bytes und entschluesselt sie als UTF-8.
 *
 * Warum nicht `req.text()`: das liest den GANZEN Koerper in den Speicher und
 * gibt ihn erst danach heraus. Eine Groessenpruefung, die danach kommt, ist
 * keine Eingangsbegrenzung, sondern nur eine Parsebegrenzung — der Speicher ist
 * zu diesem Zeitpunkt bereits belegt. Bei einem oeffentlichen Endpunkt ohne
 * Anmeldung ist das der billigste Hebel, den ein Angreifer hat.
 *
 * `Content-Length` wird NICHT geglaubt. Er darf nur eines: frueh ABLEHNEN.
 * Ein zu kleiner oder fehlender Wert aendert nichts, weil waehrend des Lesens
 * ohnehin mitgezaehlt wird. Umgekehrt spart ein glaubhaft zu grosser Wert das
 * Anfassen des Datenstroms ganz.
 *
 * Entschluesselt wird erst am Ende und ueber den gesamten Puffer: ein
 * mehrbyte-Zeichen kann ueber eine Stueckgrenze laufen, und stueckweises
 * Dekodieren wuerde es zerreissen. `fatal: true`, weil ungueltiges UTF-8 eine
 * kaputte Anfrage ist und kein Anlass, stillschweigend Ersatzzeichen
 * einzusetzen.
 */
export const readBoundedUtf8 = async (
  quelle: BodySource,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<BoundedBodyResult> => {
  if (istAngekuendigtZuGross(quelle.contentLength, maxBytes)) {
    // Der Datenstrom wird gar nicht erst angefasst.
    return { ok: false, reason: "too_large" };
  }

  if (!quelle.stream) return { ok: true, text: "", bytes: 0 };

  const reader = quelle.stream.getReader();
  try {
    // EIN Puffer, fest auf die erlaubte Groesse. Vorher wurden die Stuecke
    // gesammelt und anschliessend in einen zweiten Puffer kopiert — doppelter
    // Speicher fuer dieselben Bytes, und zwar genau bei der Anfrage, die
    // moeglichst wenig kosten soll.
    const puffer = new Uint8Array(maxBytes);
    let gesamt = 0;

    for (;;) {
      let stueck: ReadableStreamReadResult<Uint8Array>;
      try {
        stueck = await reader.read();
      } catch {
        // Ohne den Fehler: er kann Teile des Koerpers enthalten.
        await stilleAbbestellung(reader);
        return { ok: false, reason: "read_error" };
      }

      if (stueck.done) break;
      const wert = stueck.value;
      if (!wert || wert.byteLength === 0) continue;

      if (gesamt + wert.byteLength > maxBytes) {
        // Das ueberzaehlige Stueck wird ausdruecklich NICHT in den Puffer
        // kopiert, und gelesen wird auch nicht weiter.
        await stilleAbbestellung(reader);
        return { ok: false, reason: "too_large" };
      }

      puffer.set(wert, gesamt);
      gesamt += wert.byteLength;
    }

    try {
      // Entschluesselt wird nur der gefuellte Teil, und erst am Ende: ein
      // Mehrbyte-Zeichen kann ueber eine Stueckgrenze laufen, stueckweises
      // Dekodieren wuerde es zerreissen.
      const text = new TextDecoder("utf-8", { fatal: true }).decode(puffer.subarray(0, gesamt));
      return { ok: true, text, bytes: gesamt };
    } catch {
      return { ok: false, reason: "invalid_encoding" };
    }
  } finally {
    // Auf JEDEM Ausgang — erfolgreich, zu gross, Lesefehler, kaputte Kodierung
    // und auch dann, wenn das Abbestellen selbst geworfen hat. Ein Strom, der
    // gesperrt zurueckbleibt, ist von aussen nicht mehr zu gebrauchen; das
    // Freigeben darf aber umgekehrt kein Ergebnis umdrehen, deshalb steht es
    // im `finally` und sein eigener Fehler wird verschluckt.
    try {
      reader.releaseLock();
    } catch {
      /* der Aufrufer hat sein Ergebnis bereits */
    }
  }
};

/**
 * Ist die ANGEKUENDIGTE Laenge sicher zu gross?
 *
 * Ohne `Number()`, und das ist der Punkt. `9007199254740993` besteht nur aus
 * Ziffern und ist offensichtlich groesser als 8192 — aber die Zahl liegt
 * jenseits von `Number.MAX_SAFE_INTEGER`, `Number.isSafeInteger` sagt `false`,
 * und die Angabe galt damit als unbrauchbar. Ergebnis: der Strom wurde
 * angefasst, obwohl der Absender selbst ankuendigt, ein Vielfaches der Grenze
 * zu schicken.
 *
 * Verglichen wird deshalb als Zeichenkette: fuehrende Nullen weg, dann erst
 * die Laenge, bei Gleichstand lexikografisch. Fuer reine Ziffernfolgen ist das
 * dieselbe Ordnung wie der Zahlenvergleich — nur ohne obere Schranke.
 *
 * Alles, was nicht ausschliesslich aus Ziffern besteht (leer, Vorzeichen,
 * Exponent, Buchstaben), gilt als nicht vorhanden. Dann misst der Leser selbst;
 * geschenkt wird dadurch nichts.
 */
const istAngekuendigtZuGross = (contentLength: string | null, maxBytes: number): boolean => {
  if (contentLength === null) return false;
  const ziffern = contentLength.trim();
  if (!/^\d+$/.test(ziffern)) return false;

  const ohneFuehrendeNullen = ziffern.replace(/^0+(?=\d)/, "");
  const grenze = String(maxBytes);
  if (ohneFuehrendeNullen.length !== grenze.length) {
    return ohneFuehrendeNullen.length > grenze.length;
  }
  return ohneFuehrendeNullen > grenze;
};

/** Abbestellen ist bestes Bemuehen: manche Quellen werfen dabei. */
const stilleAbbestellung = async (reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> => {
  try {
    await reader.cancel();
  } catch {
    /* egal — der Aufrufer hat bereits entschieden */
  }
};

export const parseCancellationRequest = (raw: unknown): ParseResult => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "body_not_object" };
  }
  const body = raw as Record<string, unknown>;

  // Unbekanntes wird abgelehnt statt ignoriert. Wer noch die alten Felder
  // schickt, soll einen Fehler sehen und nicht stillschweigend eine Mail
  // ausloesen, deren Inhalt er sich selbst ausgedacht hat.
  const fremd = Object.keys(body).filter(
    (k) => !(ALLOWED_FIELDS as readonly string[]).includes(k),
  );
  if (fremd.length > 0) {
    return { ok: false, reason: `unknown_fields:${fremd.sort().join(",")}` };
  }

  const { appointmentId, actionToken, reason } = body;

  if (typeof appointmentId !== "string" || !UUID.test(appointmentId)) {
    return { ok: false, reason: "appointmentId_invalid" };
  }
  if (typeof actionToken !== "string" || !UUID.test(actionToken)) {
    // Absichtlich ohne den Wert in der Begruendung: diese Zeichenkette wird
    // protokolliert.
    return { ok: false, reason: "actionToken_invalid" };
  }

  let grund: string | null = null;
  if (reason !== undefined && reason !== null) {
    if (typeof reason !== "string") return { ok: false, reason: "reason_not_string" };
    if (reason.length > MAX_REASON_LENGTH) return { ok: false, reason: "reason_too_long" };
    grund = reason;
  }

  return { ok: true, value: { appointmentId, actionToken, reason: grund } };
};

// ── Zeilen, die aus der Datenbank kommen ────────────────────────────────────

/** Was `cancel_appointment_by_action_token` zurueckgibt. */
export interface CancelResultRow {
  result_code: string;
  appointment_id: string;
  company_id: string;
  status: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface AppointmentRow {
  id: string;
  company_id: string;
  title: string;
  appointment_date: string;
  start_time: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  language: string | null;
}

export interface CompanyRow {
  id: string;
  company_name: string | null;
  email: string | null;
  notification_email: string | null;
  default_language: string | null;
  resend_enabled: boolean | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
}

export interface CompanySecretsLike {
  resend_api_key: string | null;
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
  language?: Locale;
  metadata?: Record<string, unknown>;
}

/**
 * Was die Renderer brauchen. Bemerkenswert ist, was FEHLT: das Token. Es ist
 * kein Bestandteil dieses Zusammenhangs und kann deshalb weder in einen
 * Betreff noch in ein Mailfeld geraten.
 */
export interface CancellationRenderContext {
  appointment: AppointmentRow;
  company: CompanyRow;
  cancellationReason: string | null;
  isCompanyEmail: boolean;
  locale: Locale;
  appName: string;
}

export interface AppointmentCancellationDeps {
  /** Der atomare Uebergang. Einziger Weg, der etwas veraendert. */
  cancelByToken(args: {
    appointmentId: string;
    token: string;
    reason: string | null;
  }): Promise<{ rows: CancelResultRow[] | null; error: unknown }>;
  loadAppointment(appointmentId: string): Promise<AppointmentRow | null>;
  loadCompany(companyId: string): Promise<CompanyRow | null>;
  loadSecrets(companyId: string): Promise<CompanySecretsLike>;
  sendEmail(args: SendArgs): Promise<{ id?: string; error?: unknown }>;
  logEmail(entry: EmailLogEntry): Promise<void>;
  insertNotification(entry: Record<string, unknown>): Promise<void>;
  renderCompanyEmail(ctx: CancellationRenderContext): { subject: string; html: string };
  renderCustomerEmail(ctx: CancellationRenderContext): { subject: string; html: string };
  toLocale(value: unknown): Locale;
  defaultResendApiKey(): string | undefined;
  defaultFrom(): string;
  appName(): string;
  log(step: string, details?: Record<string, unknown>): void;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown> | null;
  headers?: Record<string, string>;
}

export interface CancellationHttpRequest {
  method: string;
  /** `Content-Length`, roh. Darf nur frueh ablehnen, nie etwas erlauben. */
  contentLength?: string | null;
  /**
   * Der Koerper als Datenstrom — NICHT als fertige Zeichenkette. Nur so kann
   * die Methode ueber das Lesen entscheiden und die Grenze waehrend des Lesens
   * greifen.
   */
  body?: ReadableStream<Uint8Array> | null;
}

const ANTWORT_405: HandlerResult = {
  status: 405,
  body: { error: "method_not_allowed" },
  headers: { Allow: "POST, OPTIONS" },
};

/**
 * Der ganze Ablauf in der Reihenfolge, die die Zusicherung traegt.
 *
 * Nichts, was Geld kostet, Mail verschickt, ein Geheimnis liest oder eine Zeile
 * schreibt, passiert vor Schritt 5. Eine missgebildete Anfrage beruehrt die
 * Datenbank ueberhaupt nicht.
 */
export const handleAppointmentCancellation = async (
  deps: AppointmentCancellationDeps,
  req: CancellationHttpRequest,
): Promise<HandlerResult> => {
  // 1. Methode.
  if (req.method === "OPTIONS") return { status: 200, body: null };
  if (req.method !== "POST") {
    deps.log("Rejected method", { method: req.method });
    return ANTWORT_405;
  }

  // 2. Koerper lesen — begrenzt, und ERST JETZT. Vor dieser Zeile ist noch kein
  //    einziges Byte des Koerpers angefasst worden; eine Anfrage mit falscher
  //    Methode wird beantwortet, ohne dass ihr Koerper Speicher kostet.
  const gelesen = await readBoundedUtf8({
    contentLength: req.contentLength ?? null,
    stream: req.body ?? null,
  });
  if (!gelesen.ok) {
    if (gelesen.reason === "too_large") {
      deps.log("Rejected body size");
      return { status: 413, body: { error: "payload_too_large" } };
    }
    // Kaputte Kodierung und Lesefehler sind beide "die Anfrage ist unbrauchbar".
    // Welches von beidem, geht den Aufrufer nichts an.
    deps.log("Could not read the request body", { reason: gelesen.reason });
    return { status: 400, body: { error: "invalid_request" } };
  }

  // Zweiter Riegel derselben Grenze. Der Leser oben ist der wirksame; dieser
  // hier faengt einen Aufrufer ab, der den Text auf einem anderen Weg
  // hereingibt — er kostet einen Vergleich und kann nicht schaden.
  if (bodyByteLength(gelesen.text) > MAX_BODY_BYTES) {
    deps.log("Rejected body size");
    return { status: 413, body: { error: "payload_too_large" } };
  }

  // 3. JSON.
  let roh: unknown;
  try {
    roh = JSON.parse(gelesen.text);
  } catch {
    deps.log("Rejected body", { reason: "malformed_json" });
    return { status: 400, body: { error: "invalid_request" } };
  }

  // 4. Form.
  const parsed = parseCancellationRequest(roh);
  if (!parsed.ok) {
    deps.log("Rejected body", { reason: parsed.reason });
    return { status: 400, body: { error: "invalid_request" } };
  }
  const request = parsed.value;

  // 5. Der Uebergang. Prueft Token, Frist, Status und geplanten Beginn in der
  //    Datenbank, unter einer Zeilensperre.
  const { rows, error } = await deps.cancelByToken({
    appointmentId: request.appointmentId,
    token: request.actionToken,
    reason: request.reason,
  });

  if (error) {
    // Ohne den rohen Fehler: er kann Verbindungszeichenketten und im
    // schlimmsten Fall die Parameter des Aufrufs enthalten — darunter das Token.
    deps.log("Cancellation RPC failed", { appointmentId: request.appointmentId });
    return { status: 503, body: { error: "service_unavailable" } };
  }
  if (!Array.isArray(rows)) {
    deps.log("Cancellation RPC returned an unusable shape", { appointmentId: request.appointmentId });
    return { status: 503, body: { error: "service_unavailable" } };
  }

  // 6. Ergebnis.
  //
  //    Kein Treffer heisst: falsche id, falsches Token, fremdes Token,
  //    abgelaufen oder widerrufen. Welches davon, sagt die Antwort nicht — sonst
  //    liesse sich der Endpunkt zum Durchprobieren von Terminen benutzen.
  if (rows.length === 0) {
    deps.log("Capability rejected", { appointmentId: request.appointmentId });
    return { status: 403, body: { error: "invalid_or_expired" } };
  }
  if (rows.length > 1) {
    deps.log("Cancellation RPC returned more than one row", { appointmentId: request.appointmentId });
    return { status: 503, body: { error: "service_unavailable" } };
  }

  const ergebnis = rows[0];
  if (!ergebnis || typeof ergebnis.result_code !== "string") {
    deps.log("Cancellation RPC returned a row without a result code", {
      appointmentId: request.appointmentId,
    });
    return { status: 503, body: { error: "service_unavailable" } };
  }

  if (ergebnis.result_code === "not_cancellable") {
    // Ohne den Status der Zeile: ob der Termin abgeschlossen ist, jemand nicht
    // erschienen ist oder er nur schon begonnen hat, geht den Aufrufer nichts an.
    deps.log("Not cancellable", { appointmentId: request.appointmentId });
    return { status: 409, body: { error: "not_cancellable" } };
  }

  if (ergebnis.result_code === "already_cancelled") {
    // Der zweite Klick. Kein Geheimnis wird geladen, keine Mail geschrieben,
    // keine Zeile angelegt — genau das macht die Wiederholung ungefaehrlich.
    deps.log("Already cancelled", { appointmentId: request.appointmentId });
    return { status: 200, body: { success: true, result: "already_cancelled" } };
  }

  if (ergebnis.result_code !== "cancelled_now") {
    deps.log("Cancellation RPC returned an unknown result code", {
      appointmentId: request.appointmentId,
      resultCode: ergebnis.result_code,
    });
    return { status: 503, body: { error: "service_unavailable" } };
  }

  // 7. Ab hier ist der Termin abgesagt und in der Datenbank festgeschrieben.
  //    Was jetzt noch folgt, ist Benachrichtigung. Nichts davon darf die
  //    Antwort umdrehen: der Kunde hat abgesagt, und das ist geschehen, auch
  //    wenn kein Mailanbieter erreichbar ist.
  const erfolg: HandlerResult = {
    status: 200,
    body: { success: true, result: "cancelled_now" },
  };

  try {
    await benachrichtige(deps, ergebnis);
  } catch (fehler) {
    deps.log("Notification stage failed after a completed cancellation", {
      appointmentId: ergebnis.appointment_id,
      kind: fehler instanceof Error ? fehler.name : "unknown",
    });
  }

  return erfolg;
};

/**
 * Alles nach dem Uebergang. Getrennt, damit im Ablauf oben auf einen Blick
 * sichtbar bleibt: dieser ganze Block kann fehlschlagen, ohne dass sich die
 * Antwort aendert.
 */
const benachrichtige = async (
  deps: AppointmentCancellationDeps,
  ergebnis: CancelResultRow,
): Promise<void> => {
  const appointment = await deps.loadAppointment(ergebnis.appointment_id);
  if (!appointment) {
    deps.log("Appointment row vanished after the transition", {
      appointmentId: ergebnis.appointment_id,
    });
    return;
  }

  // Gegenprobe. Die Zeile wird zwar mit der id aus dem RPC-Ergebnis geholt,
  // aber die Firma entscheidet, wer Post bekommt und welches Geheimnis gelesen
  // wird. Weichen die beiden Quellen ab, stimmt etwas grundlegend nicht — dann
  // lieber gar keine Mail als eine an die falsche Firma.
  if (appointment.id !== ergebnis.appointment_id || appointment.company_id !== ergebnis.company_id) {
    deps.log("Appointment/company mismatch between RPC result and row", {
      appointmentId: ergebnis.appointment_id,
    });
    return;
  }

  const company = await deps.loadCompany(ergebnis.company_id);
  if (!company) {
    deps.log("Company row not found for a completed cancellation", {
      appointmentId: ergebnis.appointment_id,
    });
    return;
  }

  const kundenName = `${appointment.customer_first_name ?? ""} ${appointment.customer_last_name ?? ""}`.trim();
  const companyLocale = deps.toLocale(company.default_language);
  const customerLocale = deps.toLocale(appointment.language);

  // In-App zuerst. Sie ist der verlaessliche Kanal: sie braucht keinen fremden
  // Dienst, und wenn der Mailversand scheitert, sieht die Firma die Absage
  // trotzdem im Dashboard.
  //
  // Weder Token noch Absagegrund noch eine Adresse stehen in den Metadaten.
  // Benachrichtigungen werden im Dashboard breit gelesen; der Grund gehoert in
  // die Mail und in die Terminzeile, nicht in eine Randnotiz.
  try {
    await deps.insertNotification({
      company_id: company.id,
      type: "appointment_cancelled",
      title: "❌ Termin abgesagt",
      body: `${kundenName || "Ein Kunde"} hat den Termin "${appointment.title}" abgesagt.`,
      metadata: {
        appointment_id: appointment.id,
        route: "/firma/kalender",
        priority: "high",
      },
    });
  } catch (fehler) {
    deps.log("Could not write the in-app notification", {
      appointmentId: appointment.id,
      kind: fehler instanceof Error ? fehler.name : "unknown",
    });
  }

  // Absender bestimmen. Eigener Resend-Zugang der Firma, sonst der allgemeine.
  const geheimnisse = await deps.loadSecrets(company.id);
  let apiKey = deps.defaultResendApiKey();
  let from = deps.defaultFrom();
  let isCompanyEmail = false;
  if (company.resend_enabled && geheimnisse.resend_api_key && company.resend_from_email) {
    apiKey = geheimnisse.resend_api_key;
    from = `${company.resend_from_name || company.company_name || ""} <${company.resend_from_email}>`.trim();
    isCompanyEmail = true;
  }

  if (!apiKey) {
    // Kein Schluessel ist ein gueltiger Betriebszustand, kein Fehler. Die
    // Absage steht, die Firma sieht sie im Dashboard.
    deps.log("No Resend key configured, skipping both emails", { appointmentId: appointment.id });
    return;
  }

  const basis: CancellationRenderContext = {
    appointment,
    company,
    cancellationReason: ergebnis.cancellation_reason,
    isCompanyEmail,
    locale: companyLocale,
    appName: deps.appName(),
  };

  // Zwei voneinander unabhaengige Versuche. Scheitert der eine, wird der andere
  // trotzdem unternommen — der Kunde soll seine Bestaetigung auch dann
  // bekommen, wenn die Adresse der Firma nicht erreichbar ist, und umgekehrt.
  const firmenEmpfaenger = company.notification_email || company.email;
  if (firmenEmpfaenger) {
    const mail = deps.renderCompanyEmail(basis);
    await versuche(deps, {
      to: firmenEmpfaenger,
      recipientName: company.company_name ?? undefined,
      subject: mail.subject,
      html: mail.html,
      apiKey,
      from,
      emailType: "appointment_cancelled",
      companyId: company.id,
      language: companyLocale,
      appointmentId: appointment.id,
      isCompanyEmail,
    });
  } else {
    deps.log("Company has no recipient address, skipping the firma email", {
      appointmentId: appointment.id,
    });
  }

  if (appointment.customer_email) {
    const mail = deps.renderCustomerEmail({ ...basis, locale: customerLocale });
    await versuche(deps, {
      to: appointment.customer_email,
      recipientName: kundenName || undefined,
      subject: mail.subject,
      html: mail.html,
      apiKey,
      from,
      emailType: "appointment_cancelled_customer",
      companyId: company.id,
      language: customerLocale,
      appointmentId: appointment.id,
      isCompanyEmail,
    });
  } else {
    deps.log("No customer address on the appointment, skipping the customer email", {
      appointmentId: appointment.id,
    });
  }
};

interface Versuch {
  to: string;
  recipientName?: string;
  subject: string;
  html: string;
  apiKey: string;
  from: string;
  emailType: string;
  companyId: string;
  language: Locale;
  appointmentId: string;
  isCompanyEmail: boolean;
}

/**
 * Ein Versand samt Protokoll. Wirft nie — der Aufrufer soll den zweiten Versuch
 * unternehmen, egal wie dieser hier ausgegangen ist.
 *
 * `resend.emails.send` liefert `{ error }` zurueck, statt zu werfen. Das ist
 * ein ECHTER Fehlschlag und darf nicht als `sent` protokolliert werden.
 */
const versuche = async (deps: AppointmentCancellationDeps, v: Versuch): Promise<void> => {
  let fehlgeschlagen = false;
  try {
    const ergebnis = await deps.sendEmail({
      to: v.to,
      subject: v.subject,
      html: v.html,
      apiKey: v.apiKey,
      from: v.from,
    });
    fehlgeschlagen = Boolean(ergebnis?.error);
  } catch {
    fehlgeschlagen = true;
  }

  try {
    await deps.logEmail({
      recipientEmail: v.to,
      recipientName: v.recipientName,
      subject: v.subject,
      emailType: v.emailType,
      status: fehlgeschlagen ? "failed" : "sent",
      // Bewusst nichtssagend. Die Antwort des Anbieters kann die Adresse und
      // Teile des Inhalts enthalten; sie gehoert nicht in eine Tabelle, die
      // spaeter im Dashboard angezeigt wird.
      errorMessage: fehlgeschlagen ? "resend_error" : undefined,
      companyId: v.companyId,
      language: v.language,
      // Keine Token, kein Absagegrund, keine Adresse ausser der ohnehin
      // vorhandenen Empfaengerspalte.
      metadata: { appointmentId: v.appointmentId, isCompanyEmail: v.isCompanyEmail },
    });
  } catch {
    deps.log("Could not write the email log", { appointmentId: v.appointmentId });
  }

  deps.log(fehlgeschlagen ? "Email send failed" : "Email sent", {
    appointmentId: v.appointmentId,
    emailType: v.emailType,
  });
};
