/**
 * Die Entscheidungen der oeffentlichen Absage-Seite — ohne React, ohne Browser,
 * ohne Supabase.
 *
 * ── Warum das hier und nicht in der Komponente steht ────────────────────────
 *
 * Eine Seite, die ueber eine Berechtigung entscheidet, sollte man ausfuehren
 * koennen, ohne einen Browser zu starten. Die Komponente daneben ist deshalb
 * nur noch Anbindung: sie liest `window.location`, ruft Supabase und zeigt an,
 * was hier entschieden wurde.
 *
 * ── Was sich gegenueber der alten Seite aendert ─────────────────────────────
 *
 * Die alte Fassung suchte den Termin ueber `?email=` und las `appointments`
 * und `companies` direkt aus dem Browser. Das konnte gar nicht funktionieren —
 * auf beiden Tabellen liegt RLS ohne Policy fuer `anon` —, und der Link trug
 * die E-Mail-Adresse des Kunden im Klartext durch Verlauf, Referer und
 * Server-Logs.
 *
 * Jetzt gilt: das Token ist die Berechtigung, es steht im FRAGMENT, und das
 * Fragment verlaesst den Browser nie. Gelesen wird ausschliesslich ueber die
 * Vorschau-RPC, geschrieben ausschliesslich ueber die Edge Function.
 */

export const MAX_REASON_LENGTH = 2000;

/** Unter diesem Schluessel haengt die Bindung im History-State. */
export const HISTORY_STATE_KEY = "__appointmentCancel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const istUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

// ── 1. Berechtigung aus der Adresse ─────────────────────────────────────────

export interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export type CapabilitySource = "fragment" | "history";

export type CapabilityResult =
  | {
      ok: true;
      appointmentId: string;
      token: string;
      source: CapabilitySource;
      reason?: undefined;
    }
  | { ok: false; reason: "invalid_appointment_id" | "no_token" | "invalid_token" };

/** Liest `#t=<uuid>`. Andere Fragmentfelder werden ignoriert, nicht geerbt. */
const tokenAusFragment = (hash: string): string | null => {
  const roh = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!roh) return null;
  // `URLSearchParams` versteht das Fragment als Schluessel/Wert-Liste — dieselbe
  // Schreibweise wie eine Abfrage, nur eben hinter dem `#`.
  const wert = new URLSearchParams(roh).get("t");
  return wert && wert.length > 0 ? wert : null;
};

/**
 * Holt die im History-State hinterlegte Bindung — aber nur, wenn sie zu DIESEM
 * Termin gehoert. Ohne diese Pruefung wuerde ein Token nach einem Wechsel auf
 * eine andere Termin-id weiterverwendet, und die Seite wuerde eine Berechtigung
 * behaupten, die es fuer diesen Termin nie gab.
 */
const tokenAusVerlauf = (state: unknown, appointmentId: string): string | null => {
  if (!state || typeof state !== "object") return null;
  const eintrag = (state as Record<string, unknown>)[HISTORY_STATE_KEY];
  if (!eintrag || typeof eintrag !== "object") return null;
  const { appointmentId: gebunden, token } = eintrag as Record<string, unknown>;
  if (gebunden !== appointmentId) return null;
  return istUuid(token) ? token : null;
};

/**
 * Die einzige Stelle, an der aus einer Adresse eine Berechtigung wird.
 *
 * Bewusst NICHT gelesen werden `?t=` und `?email=`. Ein Token in der Abfrage
 * geht an den Server, steht im Referer und landet in jedem Zugriffsprotokoll —
 * es waere kein Geheimnis mehr. Wer einen alten Link mit `?email=` oeffnet,
 * bekommt deshalb dieselbe Antwort wie jemand mit falschem Token: keine.
 */
export const extractCapability = (
  routeAppointmentId: string | undefined,
  loc: LocationLike,
  historyState?: unknown,
): CapabilityResult => {
  if (!istUuid(routeAppointmentId)) {
    return { ok: false, reason: "invalid_appointment_id" };
  }

  const ausFragment = tokenAusFragment(loc.hash);
  if (ausFragment !== null) {
    if (!istUuid(ausFragment)) return { ok: false, reason: "invalid_token" };
    return { ok: true, appointmentId: routeAppointmentId, token: ausFragment, source: "fragment" };
  }

  const gespeichert = tokenAusVerlauf(historyState, routeAppointmentId);
  if (gespeichert !== null) {
    return { ok: true, appointmentId: routeAppointmentId, token: gespeichert, source: "history" };
  }

  return { ok: false, reason: "no_token" };
};

/**
 * Die Route, wie sie im Moment aussieht.
 *
 * `key` ist der Schluessel, den React Router jedem VERLAUFSEINTRAG gibt. Ein
 * neuer Schritt bekommt einen neuen Schluessel — vor und zurueck fuehren aber
 * zum selben Eintrag zurueck und damit zum selben `key`. Er benennt also den
 * Eintrag, nicht den Besuch, und taugt allein nicht als Identitaet eines
 * Auftritts; dafuer gibt es die opake Nummer in `RouteSession`.
 */
export interface RouteSnapshot extends LocationLike {
  appointmentId: string | undefined;
  key: string;
}

export interface RouteSession {
  /**
   * Identitaet dieses AUFTRITTS. Opak und bei jedem Aufruf neu — nicht aus
   * Route-Daten zusammengesetzt und ohne jeden Bezug zum Token.
   */
  routeId: string;
  /** Wie die Route aussah. Nur zum Erkennen, dass sich etwas geaendert hat. */
  signature: string;
  capability: CapabilityResult;
}

/**
 * Was die Route ausmacht. Aendert sich dieser Wert, ist es ein neuer Auftritt.
 * Das Token steht bewusst NICHT darin: die Signatur wird verglichen, im Zustand
 * gehalten und waere sonst ein Geheimnis an einer voellig unnoetigen Stelle.
 */
export const routeSignature = (snap: RouteSnapshot): string =>
  // KEIN roher Wert aus Fragment oder Abfrage.
  //
  // Vom Fragment geht nur ein, OB es eines gibt — sein Inhalt IST das Token.
  // Die Abfrage faellt inzwischen ganz heraus, und zwar aus demselben Grund:
  // ein alter Link bringt `?t=<uuid>&email=…` mit, beides wird zur
  // Berechtigung ausdruecklich NICHT gelesen und beim Aufraeumen aus der
  // Adresse entfernt — ueber die Signatur waere es trotzdem im Zustand der
  // Seite gelandet und haette dort ueberdauert. Ein Fingerabdruck waere
  // ebenfalls falsch: ein Geheimnis wird hier gar nicht getragen, auch nicht
  // in verkuerzter Form.
  //
  // Fuer das Erkennen einer Navigation reicht der Rest: React Router legt fuer
  // jeden Schritt einen neuen Verlaufseintrag mit eigenem `key` an, und eine
  // Aenderung der Abfrage ist immer ein solcher Schritt.
  [snap.appointmentId ?? "", snap.key, snap.pathname, snap.hash ? "#" : ""].join("\u0000");

// Laufende Nummer statt zusammengesetztem Schluessel. `location.key` allein
// taugt nicht: er gehoert zum VERLAUFSEINTRAG, nicht zum Besuch. Vor und
// zurueck bringt denselben Eintrag und damit denselben `key` wieder. Zwei
// Auftritte derselben Seite haetten dann dieselbe Kennung, und ein Ergebnis aus
// dem ersten Besuch wuerde im zweiten angezeigt. Genau dafuer gibt es diese
// Nummer: sie zaehlt Auftritte, nicht Eintraege.
let auftrittsZaehler = 0;

/**
 * Eine Berechtigung gilt fuer GENAU einen Route-Auftritt.
 *
 * Vorher wurde sie beim Einhaengen der Komponente eingefroren. Wechselt der
 * Nutzer von Termin A zu Termin B, ohne dass die Komponente dazwischen
 * abgebaut wird — derselbe Router, dieselbe Route, andere id —, dann behielt
 * die Seite A's Token und stellte damit B dar. Ein spaet eintreffendes
 * Ergebnis von A landete ausserdem auf dem Bildschirm von B.
 *
 * Deshalb bekommt jede Sitzung eine Kennung, und jedes Ergebnis traegt die
 * Kennung der Sitzung, die es angefordert hat. Ein Abbruch-Merker allein
 * genuegt nicht: er sagt nur "diese Wirkung ist beendet", nicht "dieses
 * Ergebnis gehoert zu einer anderen Route".
 */
export const openRouteSession = (snap: RouteSnapshot, historyState?: unknown): RouteSession => {
  auftrittsZaehler += 1;
  return {
    routeId: `auftritt-${auftrittsZaehler}`,
    signature: routeSignature(snap),
    capability: extractCapability(snap.appointmentId, snap, historyState),
  };
};

/** Darf ein Ergebnis dieser Herkunft noch angezeigt werden? */
export const belongsToSession = (session: RouteSession, routeId: string | null): boolean =>
  routeId !== null && routeId === session.routeId;

// ── 2. Adresse aufraeumen ───────────────────────────────────────────────────

export interface UrlCleanupPlan {
  /** Immer true — der Plan entsteht nur, wenn es wirklich etwas zu tun gibt. */
  replace: boolean;
  /** Pfad plus die erhaltenswerten Abfrageparameter, ohne Fragment. */
  url: string;
  /** Der vollstaendige neue History-State, inklusive dem, was schon da war. */
  state: Record<string, unknown>;
}

/**
 * Das Token soll nach dem Lesen aus der Adresszeile verschwinden — es steht
 * sonst im Verlauf des Geraets und in jedem Screenshot. Es muss aber einen
 * Neuladen ueberleben, sonst waere die Seite nach F5 tot. Beides zusammen geht
 * ueber `history.replaceState`: Adresse sauber, Token im State.
 *
 * Von der Abfrage bleibt nur `lang` stehen. Alles andere — insbesondere ein
 * mitgeschlepptes `?t=` oder `?email=` aus einem alten Link — wird beim
 * Aufraeumen entfernt, statt weiter durch die Gegend getragen zu werden.
 *
 * Der bestehende State bleibt erhalten: React Router legt dort seine eigenen
 * Felder ab, und die zu ueberschreiben wuerde die Navigation beschaedigen.
 */
interface Bindung {
  appointmentId: string;
  token: string;
}

/** Liest eine Bindung — oder gibt null zurueck. Wirft nie, egal was dort steht. */
const leseBindung = (wert: unknown): Bindung | null => {
  if (!wert || typeof wert !== "object" || Array.isArray(wert)) return null;
  const { appointmentId, token } = wert as Record<string, unknown>;
  if (typeof appointmentId !== "string" || !istUuid(token)) return null;
  return { appointmentId, token };
};

const bindungenGleich = (a: Bindung | null, b: Bindung | null): boolean =>
  a === null ? b === null : b !== null && a.appointmentId === b.appointmentId && a.token === b.token;

export const planUrlCleanup = (
  capability: CapabilityResult,
  loc: LocationLike,
  historyState?: unknown,
): UrlCleanupPlan | null => {
  const vorhanden =
    historyState && typeof historyState === "object" ? { ...(historyState as Record<string, unknown>) } : {};

  // Gewuenschte Bindung: nur bei gueltiger Berechtigung, und immer an DIESEN
  // Termin. Ist die Berechtigung ungueltig, verschwindet auch ein alter
  // Eintrag — sonst wuerde ein Neuladen auf der falschen Termin-id ein
  // laengst ueberholtes Token wiederbeleben.
  const gewuenscht = capability.ok
    ? { appointmentId: capability.appointmentId, token: capability.token }
    : null;
  const rohVorhanden = Object.prototype.hasOwnProperty.call(vorhanden, HISTORY_STATE_KEY);
  const aktuell = leseBindung(vorhanden[HISTORY_STATE_KEY]);

  const alteAbfrage = new URLSearchParams(loc.search);
  const neueAbfrage = new URLSearchParams();
  const lang = alteAbfrage.get("lang");
  if (lang) neueAbfrage.set("lang", lang);
  const abfrage = neueAbfrage.toString();

  const zielUrl = abfrage ? `${loc.pathname}?${abfrage}` : loc.pathname;
  const istUrl = `${loc.pathname}${loc.search}${loc.hash}`;

  const zielZustand = { ...vorhanden };
  if (gewuenscht) zielZustand[HISTORY_STATE_KEY] = gewuenscht;
  else delete zielZustand[HISTORY_STATE_KEY];

  const urlAendertSich = zielUrl !== istUrl;
  // Strukturell verglichen, nicht serialisiert. `JSON.stringify` stand hier
  // vorher und war ein Fehler: ein `BigInt` im State laesst es WERFEN, ein
  // Zyklus ebenso — und dann bliebe die Adresse ungeputzt, weil die Funktion
  // gar nicht mehr bis zum Plan kommt. Fremder State ist nichts, worueber ein
  // Aufraeumschritt stolpern darf.
  const bindungAendertSich = gewuenscht === null ? rohVorhanden : !bindungenGleich(aktuell, gewuenscht);
  if (!urlAendertSich && !bindungAendertSich) return null;

  return { replace: true, url: zielUrl, state: zielZustand };
};

// ── 3. Vorschau ─────────────────────────────────────────────────────────────

/**
 * Genau die Felder, die `get_appointment_by_action_token` herausgibt — und
 * keines mehr. Kein Kundenname, keine Kundenadresse, keine Firmen-E-Mail,
 * keine internen Notizen, keine `company_id` und kein Token. Was hier nicht
 * steht, kann die Seite nicht anzeigen und nicht versehentlich weitergeben.
 */
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rescheduled"
  | "no_show";

export type AppointmentType = "besichtigung" | "service" | "follow_up" | "meeting" | "blocked";

export type DocumentLanguage = "de" | "fr" | "en";

export interface PreviewAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  title: string;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  location_city: string | null;
  language: DocumentLanguage;
  company_name: string;
  company_phone: string | null;
}

const PREVIEW_FIELDS = [
  "id",
  "appointment_date",
  "start_time",
  "end_time",
  "all_day",
  "title",
  "appointment_type",
  "status",
  "location_city",
  "language",
  "company_name",
  "company_phone",
] as const;

export type PreviewOutcome =
  /** Falsch, abgelaufen, widerrufen oder fremd — die Seite unterscheidet das nicht. */
  | { kind: "ok"; appointment: PreviewAppointment }
  | { kind: "invalid" }
  | { kind: "service_error" };

export interface RpcResult {
  data: unknown;
  error: unknown;
}

/** Die Werte, die `appointment_status` annehmen kann. */
export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "rescheduled",
  "no_show",
];

/** Die Werte, die `appointment_type` annehmen kann. */
export const APPOINTMENT_TYPES: readonly AppointmentType[] = [
  "besichtigung",
  "service",
  "follow_up",
  "meeting",
  "blocked",
];

const SPRACHEN: readonly DocumentLanguage[] = ["de", "fr", "en"];

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const ZEIT = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const istEchtesDatum = (wert: string): boolean => {
  if (!DATUM.test(wert)) return false;
  const [j, m, t] = wert.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t;
};

const istText = (v: unknown): v is string => typeof v === "string";

/**
 * Text oder NULL — und `undefined` gehoert ausdruecklich nicht dazu.
 * Als Anweisungsfolge geschrieben, weil TypeScript ein `unknown` in einer
 * ODER-Bedingung innerhalb eines Fragezeichen-Ausdrucks nicht verengt.
 */
const textOderNull = (v: unknown): { ok: true; wert: string | null } | { ok: false; wert?: undefined } => {
  if (v === null) return { ok: true, wert: null };
  if (typeof v === "string") return { ok: true, wert: v };
  return { ok: false };
};
const istEinerVon = <T extends string>(v: unknown, erlaubt: readonly T[]): v is T =>
  typeof v === "string" && (erlaubt as readonly string[]).includes(v);

/**
 * Die Antwort der Vorschau-RPC einordnen — streng, und gegen die ERWARTETE
 * Termin-id.
 *
 * Warum die id hier noch einmal geprueft wird, obwohl sie im Aufruf stand: die
 * Antwort ist die einzige Quelle dessen, was die Seite anzeigt. Kaeme sie —
 * durch einen Fehler, einen Zwischenspeicher oder eine vertauschte Zuordnung —
 * fuer einen anderen Termin zurueck, wuerde die Seite fremde Daten unter einer
 * Berechtigung zeigen, die dafuer nie gedacht war. Das ist billig zu pruefen
 * und teuer zu uebersehen.
 *
 * Alle uebrigen Felder werden auf Typ, Form und erlaubte Werte geprueft. Ein
 * unbekannter Status oder eine unbekannte Terminart fuehrt zu `service_error`
 * und NICHT zu einem Formular: was die Seite nicht versteht, darf sie nicht
 * zum Absagen anbieten. Fehlende Werte werden nicht durch leere Zeichenketten
 * ersetzt — ein Modell aus Platzhaltern sieht gueltig aus und ist es nicht.
 */
export const classifyPreview = (res: RpcResult, expectedAppointmentId: string): PreviewOutcome => {
  if (res.error) return { kind: "service_error" };
  if (!Array.isArray(res.data)) return { kind: "service_error" };
  if (res.data.length === 0) return { kind: "invalid" };
  if (res.data.length > 1) return { kind: "service_error" };

  const zeile = res.data[0];
  if (!zeile || typeof zeile !== "object" || Array.isArray(zeile)) return { kind: "service_error" };
  const roh = zeile as Record<string, unknown>;

  // Identitaet zuerst.
  if (!istUuid(roh.id) || roh.id !== expectedAppointmentId) return { kind: "service_error" };

  // Pflichtfelder mit fester Form.
  if (!istText(roh.appointment_date) || !istEchtesDatum(roh.appointment_date)) return { kind: "service_error" };
  if (!istText(roh.start_time) || !ZEIT.test(roh.start_time)) return { kind: "service_error" };
  if (!istText(roh.end_time) || !ZEIT.test(roh.end_time)) return { kind: "service_error" };
  if (!istText(roh.title)) return { kind: "service_error" };
  if (!istText(roh.company_name)) return { kind: "service_error" };

  // Aufzaehlungen: nur bekannte Werte.
  if (!istEinerVon(roh.status, APPOINTMENT_STATUSES)) return { kind: "service_error" };
  if (!istEinerVon(roh.appointment_type, APPOINTMENT_TYPES)) return { kind: "service_error" };
  if (!istEinerVon(roh.language, SPRACHEN)) return { kind: "service_error" };

  // `all_day` ist in der Tabelle NULL-faehig; NULL heisst dort schlicht "kein
  // ganztaegiger Termin". Alles andere als true/false/null ist ein Vertragsbruch.
  //
  // `undefined` ist hier ausdruecklich KEIN gueltiger Wert. Es bedeutet nicht
  // "leer", sondern "das Feld war gar nicht dabei" — und eine Antwort, der ein
  // vertraglich zugesagtes Feld fehlt, ist eine kaputte Antwort und kein
  // Termin ohne Ortsangabe.
  if (roh.all_day !== true && roh.all_day !== false && roh.all_day !== null) {
    return { kind: "service_error" };
  }

  // Wirklich NULL-faehige Felder: Text oder NULL, nichts Drittes. Ueber einen
  // kleinen Helfer, weil TypeScript die Verengung aus einem verneinten `&&`
  // nicht mituebernimmt — der Wert bliebe `unknown`.
  const stadt = textOderNull(roh.location_city);
  if (!stadt.ok) return { kind: "service_error" };
  const telefon = textOderNull(roh.company_phone);
  if (!telefon.ok) return { kind: "service_error" };

  return {
    kind: "ok",
    appointment: {
      id: roh.id,
      appointment_date: roh.appointment_date,
      start_time: roh.start_time,
      end_time: roh.end_time,
      all_day: roh.all_day === true,
      title: roh.title,
      appointment_type: roh.appointment_type,
      status: roh.status,
      location_city: stadt.wert,
      language: roh.language,
      company_name: roh.company_name,
      company_phone: telefon.wert,
    },
  };
};

/** Nur zu Pruefzwecken: die Erlaubnisliste als Datum, nicht als Behauptung. */
export const previewFieldNames = (): readonly string[] => PREVIEW_FIELDS;

// ── 4. Absage ───────────────────────────────────────────────────────────────

export interface CancellationPayload {
  appointmentId: string;
  actionToken: string;
  reason: string | null;
}

export type PayloadResult =
  | { ok: true; payload: CancellationPayload; reason?: undefined }
  | { ok: false; reason: "reason_too_long" };

/**
 * Der Koerper der Edge-Anfrage: genau drei Felder.
 *
 * Kein Ersatztext fuer einen leeren Grund. Frueher schrieb die Seite dafuer
 * "Vom Kunden abgesagt" in der Sprache der Firma hinein — das sah in der
 * Datenbank aus wie eine Aussage des Kunden, war aber keine. Leer bleibt leer;
 * die Datenbank macht daraus NULL.
 */
export const buildCancellationPayload = (
  appointmentId: string,
  actionToken: string,
  reason: string,
): PayloadResult => {
  if (reason.length > MAX_REASON_LENGTH) return { ok: false, reason: "reason_too_long" };
  return {
    ok: true,
    payload: {
      appointmentId,
      actionToken,
      reason: reason.trim().length === 0 ? null : reason,
    },
  };
};

export type CancellationOutcome =
  | { kind: "cancelled_now" }
  | { kind: "already_cancelled" }
  | { kind: "invalid" }
  | { kind: "not_cancellable" }
  | { kind: "service_error" };

export interface InvokeResult {
  data: unknown;
  error: unknown;
  /** Der HTTP-Status, sofern die Anbindung ihn aus dem Fehler herausholen konnte. */
  status?: number | null;
}

/**
 * Die Antwort der Edge Function einordnen.
 *
 * Ein Fehler mit Status wird nach Bedeutung getrennt: 403 heisst "der Link
 * taugt nicht" (und sagt bewusst nicht, warum), 409 heisst "dieser Termin
 * laesst sich nicht mehr absagen". Alles andere ist eine Stoerung, bei der ein
 * zweiter Versuch sinnvoll ist.
 *
 * Ohne Fehler wird die FORM geprueft, nicht bloss der Statuscode. Ein 200 mit
 * unbekanntem Koerper als Erfolg zu werten waere die gefaehrlichste Variante:
 * die Seite behauptete eine Absage, die nie stattgefunden hat.
 */
export const classifyCancellation = (res: InvokeResult): CancellationOutcome => {
  if (res.error) {
    if (res.status === 403) return { kind: "invalid" };
    if (res.status === 409) return { kind: "not_cancellable" };
    return { kind: "service_error" };
  }

  const koerper = res.data;
  if (!koerper || typeof koerper !== "object" || Array.isArray(koerper)) {
    return { kind: "service_error" };
  }
  const { success, result } = koerper as Record<string, unknown>;
  if (success !== true) return { kind: "service_error" };
  if (result === "cancelled_now") return { kind: "cancelled_now" };
  if (result === "already_cancelled") return { kind: "already_cancelled" };
  return { kind: "service_error" };
};

// ── 5. Was die Seite anzeigt ────────────────────────────────────────────────

export type PageView =
  | "loading"
  | "form"
  | "done"
  | "already_cancelled"
  | "not_cancellable"
  | "invalid_link"
  | "service_error";

/**
 * Ein Formular gibt es nur fuer die Zustaende, aus denen heraus eine Absage
 * ueberhaupt moeglich ist — dieselbe Erlaubnisliste wie in der Datenbank.
 * Alles andere fuehrt in eine Auskunft, nie in einen Absendeknopf.
 */
export const viewForPreview = (appointment: PreviewAppointment): PageView => {
  switch (appointment.status) {
    case "pending":
    case "confirmed":
    case "rescheduled":
      return "form";
    case "cancelled":
      return "already_cancelled";
    default:
      return "not_cancellable";
  }
};

export const viewForOutcome = (outcome: CancellationOutcome): PageView => {
  switch (outcome.kind) {
    case "cancelled_now":
      return "done";
    case "already_cancelled":
      return "already_cancelled";
    case "invalid":
      return "invalid_link";
    case "not_cancellable":
      return "not_cancellable";
    default:
      return "service_error";
  }
};

/**
 * Zeiten nur, wenn es welche gibt. Ein ganztaegiger Termin hat in der Datenbank
 * zwar `start_time`, aber die Angabe bedeutet dort nichts — sie als Zeitfenster
 * anzuzeigen waere schlicht falsch.
 */
export const showsTimeRange = (appointment: PreviewAppointment): boolean =>
  !appointment.all_day && appointment.start_time.length > 0 && appointment.end_time.length > 0;

/**
 * Der Kalendereintrag bleibt ganztaegigen Terminen vorenthalten: der
 * vorhandene ICS-Helfer kennt nur Termine mit Uhrzeit und wuerde aus
 * `all_day` einen erfundenen Zeitraum machen. Lieber keine Datei als eine
 * falsche — den Helfer zu erweitern gehoert nicht in diese Stufe.
 */
export const offersCalendarFile = (appointment: PreviewAppointment): boolean =>
  showsTimeRange(appointment);
