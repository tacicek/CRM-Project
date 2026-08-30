/**
 * Wer darf eine bezahlte Fremd-API benutzen — und wie oft.
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * `_shared/rateLimit.ts` haelt seinen Zaehler in einer `Map` im Modulkoerper.
 * Der ausgerollte Router erzeugt PRO ANFRAGE einen neuen User-Worker, also wird
 * der Modulkoerper jedes Mal neu ausgewertet: die `Map` ist immer leer, und die
 * Drossel greift nie. Gemessen am 2026-08-28 an `calculate-distance`, 61
 * Anfragen, null Antworten mit 429 — vor und nach dem Ausrollen identisch.
 *
 * Eine Drossel allein waere ohnehin die falsche Antwort. Alle Aufrufer der drei
 * Google-Proxys liegen hinter `/firma`; keine oeffentliche Seite benutzt sie.
 * Eine bezahlte API anonym erreichbar zu lassen, nur weil daneben ein Zaehler
 * steht, ist kein Schutz.
 *
 * ALSO ZWEI SCHRANKEN, IN DIESER REIHENFOLGE
 *
 *   1. Wer bist du?   JWT pruefen, Benutzer-ID SERVERSEITIG ableiten.
 *   2. Wie viel noch? `consume_api_budget` in Postgres — ueberlebt Worker und
 *      Neustarts, ist unter Nebenlaeufigkeit atomar, prueft die Mitgliedschaft
 *      in der angegebenen Firma und fuehrt drei Toepfe: Benutzer, Firma, global.
 *
 * FAIL CLOSED
 *
 * Faellt der Zaehler aus, wird NICHT durchgelassen. Eine kaputte Drossel ist
 * kein Freibrief — sie ist ein Grund, die bezahlte API in Ruhe zu lassen.
 * Deshalb 503 und kein Google-Aufruf.
 *
 * Diese Datei kennt kein Deno, kein `fetch` und keinen Supabase-Client. Alles
 * Aeussere kommt als Abhaengigkeit herein, damit die Zusagen pruefbar sind —
 * insbesondere die wichtigste: eine abgewiesene Anfrage erreicht Google nie.
 */

export type PaidApiBucket = "google-places" | "google-distance";

export interface BudgetEntscheid {
  allowed: boolean;
  retry_after: number;
}

export interface PaidApiGuardDeps {
  /** Prueft das Bearer-Token serverseitig. Liefert die Benutzer-ID oder null. */
  verifyToken: (token: string) => Promise<string | null>;
  /** Ruft `consume_api_budget` als service_role auf. Wirft bei Stoerung. */
  consumeBudget: (
    bucket: PaidApiBucket,
    userId: string,
    companyId: string,
  ) => Promise<BudgetEntscheid>;
  /** Fuer Protokoll und Fehlersuche — nie mit Kundeninhalt. */
  log?: (nachricht: string, felder?: Record<string, unknown>) => void;
}

export interface PaidApiGuardEingabe {
  bucket: PaidApiBucket;
  /** Roher `Authorization`-Header, so wie er ankam. */
  authorizationHeader: string | null;
  /** Aus dem Anfragerumpf — ungeprueft. Die Mitgliedschaft prueft die Datenbank. */
  companyId: unknown;
}

export type PaidApiGuardErgebnis =
  | { ok: true; userId: string; companyId: string }
  | {
      ok: false;
      status: 401 | 400 | 429 | 503;
      code: string;
      message: string;
      retryAfterSeconds?: number;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const guardPaidApiCall = async (
  eingabe: PaidApiGuardEingabe,
  deps: PaidApiGuardDeps,
): Promise<PaidApiGuardErgebnis> => {
  const log = deps.log ?? (() => {});

  // 1. Kein Token — kein Zugang. Vorher war dieser Endpunkt anonym erreichbar.
  const header = eingabe.authorizationHeader ?? "";
  // `\b\s*` statt `\s+`: ein Header, der nur aus dem Wort "Bearer" besteht, ist
  // KEIN Token namens "Bearer". Die erste Fassung liess ihn durch, weil ohne
  // folgendes Leerzeichen das Praefix nicht griff — gefunden vom Test, bevor
  // irgendetwas ausgerollt war.
  const token = header.replace(/^bearer\b\s*/i, "").trim();
  if (!token) {
    log("paid-api: kein Bearer-Token", { bucket: eingabe.bucket });
    return { ok: false, status: 401, code: "no_token", message: "Nicht authentifiziert." };
  }

  let userId: string | null;
  try {
    userId = await deps.verifyToken(token);
  } catch {
    // Auch der Ausfall der Pruefung ist keine Erlaubnis.
    log("paid-api: Tokenpruefung gestoert", { bucket: eingabe.bucket });
    return { ok: false, status: 503, code: "auth_unavailable", message: "Anmeldung derzeit nicht pruefbar." };
  }
  if (!userId) {
    log("paid-api: ungueltiges Token", { bucket: eingabe.bucket });
    return { ok: false, status: 401, code: "invalid_token", message: "Ungueltige Sitzung." };
  }

  // 2. Die Firma kommt aus dem Rumpf und wird NICHT geglaubt — die Datenbank
  //    prueft die Mitgliedschaft. Hier nur die Form, damit ein Unsinnswert
  //    nicht erst eine Abfrage kostet.
  const companyId = eingabe.companyId;
  if (typeof companyId !== "string" || !UUID.test(companyId)) {
    return { ok: false, status: 400, code: "company_id_missing", message: "company_id fehlt oder ist ungueltig." };
  }

  // 3. Budget. Ein Ausfall ist 503 — nicht "dann eben durchlassen".
  let entscheid: BudgetEntscheid;
  try {
    entscheid = await deps.consumeBudget(eingabe.bucket, userId, companyId);
  } catch (err) {
    log("paid-api: Budgetpruefung gestoert", {
      bucket: eingabe.bucket,
      grund: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 503, code: "budget_unavailable", message: "Dienst derzeit nicht verfuegbar." };
  }

  if (!entscheid.allowed) {
    log("paid-api: Budget erschoepft", { bucket: eingabe.bucket, retry_after: entscheid.retry_after });
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      message: "Zu viele Anfragen. Bitte kurz warten.",
      retryAfterSeconds: Math.max(1, Math.ceil(entscheid.retry_after)),
    };
  }

  return { ok: true, userId, companyId };
};

/** Kopfzeilen fuer eine abgewiesene Antwort — `Retry-After` nur, wenn es eine gibt. */
export const guardAntwortHeaders = (
  ergebnis: Extract<PaidApiGuardErgebnis, { ok: false }>,
): Record<string, string> =>
  ergebnis.retryAfterSeconds !== undefined
    ? { "Retry-After": String(ergebnis.retryAfterSeconds) }
    : {};

/**
 * Ist dieser Fehler die Mitgliedschafts-Abweisung — und nicht Rechteschwund?
 *
 * Bis `20260830100000` hob `consume_api_budget` bei fehlender Mitgliedschaft
 * `insufficient_privilege` (42501). Denselben Code hebt Postgres auch, wenn ein
 * GRANT kaputt ist. Ein Handler konnte beides nicht unterscheiden und haette
 * einen Ausfall als 403 an den Kunden gemeldet — eine falsche Auskunft ueber
 * die Ursache, und eine, die den Betreiber die Stoerung nicht sehen laesst.
 *
 * Seither hat die Abweisung eine eigene Identitaet:
 *
 *     SQLSTATE R2403   DETAIL r2_membership_denied
 *
 * Geprueft werden BEIDE. Der Code allein koennte irgendwann anderweitig
 * vergeben werden; der Marker allein koennte in einer fremden Meldung
 * auftauchen. Alles andere — auch 42501 — ist 503.
 */
export const istMitgliedschaftsAbweisung = (fehler: unknown): boolean => {
  if (typeof fehler !== "object" || fehler === null) return false;
  const f = fehler as { code?: unknown; details?: unknown; detail?: unknown; message?: unknown };
  const code = typeof f.code === "string" ? f.code : "";
  const detail =
    (typeof f.details === "string" ? f.details : "") ||
    (typeof f.detail === "string" ? f.detail : "");
  return code === "R2403" && detail.includes("r2_membership_denied");
};

/**
 * Ist das ein ABGELEHNTES Token — oder ein Ausfall des Anmeldedienstes?
 *
 * `supabase-js` liefert `auth.getUser(jwt)` bei einem ungueltigen ODER
 * abgelaufenen Token einen `AuthApiError` zurueck — nicht nur bei einer
 * Stoerung. Die erste Fassung der drei Adapter warf jeden Fehler weiter, und
 * der gemeinsame Ablauf stuft jeden Wurf als 503 `auth_unavailable` ein.
 *
 * Folge: eine abgelaufene Sitzung meldete dem Bedienenden "Dienst nicht
 * verfuegbar" statt "bitte neu anmelden", und das Betriebsprotokoll fuellte
 * sich mit erfundenen Ausfaellen. Die 401-Klasse war in der Produktion
 * unerreichbar.
 *
 * Bitter daran: fuer den Budgetweg hatte ich genau dieses Argument selbst
 * aufgeschrieben — `42501` darf nicht als 403 durchgehen, sonst sieht man die
 * Stoerung nie — und auf dem Anmeldeweg nicht angewandt. Gefunden von der
 * unabhaengigen Durchsicht.
 *
 * Die Unterscheidung: eine ANTWORT des Auth-Dienstes (4xx) heisst "Token
 * abgelehnt" und wird zu 401. Alles andere — Netzfehler, 5xx, unbekannte Form —
 * bleibt ein Wurf und damit 503. Im Zweifel Ausfall, nicht Ablehnung: eine
 * faelschlich als 401 gemeldete Stoerung wuerde den Bedienenden in eine
 * endlose Neuanmeldung schicken.
 */
/**
 * GoTrue-Fehlercodes, die eine ABLEHNUNG bedeuten. Sie sind die verlaesslichste
 * Auskunft, die der Dienst gibt — verlaesslicher als der Status, den auch ein
 * Gateway davor setzen kann.
 */
const ABLEHNUNGSCODES = new Set([
  "bad_jwt",
  "session_expired",
  "session_not_found",
  "refresh_token_not_found",
  "user_not_found",
  "invalid_credentials",
  "no_authorization",
]);

/**
 * Status, die NIE eine Ablehnung sind, obwohl sie im 4xx-Bereich liegen.
 *
 * `429` ist der gefaehrlichste: wer bei einer Drosselung "Sitzung ungueltig"
 * hoert, meldet sich neu an — und erhoeht damit genau die Last, die ihn
 * gedrosselt hat. `408` ist eine Zeitueberschreitung, also eine Stoerung.
 */
const AUSFALL_TROTZ_4XX = new Set([408, 429]);

export const istAbgelehntesToken = (fehler: unknown): boolean => {
  if (typeof fehler !== "object" || fehler === null) return false;
  const f = fehler as {
    status?: unknown;
    name?: unknown;
    code?: unknown;
    error_code?: unknown;
    __isAuthError?: unknown;
  };
  const status = typeof f.status === "number" ? f.status : undefined;
  const code =
    (typeof f.code === "string" ? f.code : "") ||
    (typeof f.error_code === "string" ? f.error_code : "");

  // 1. Sagt GoTrue selbst, dass es eine Ablehnung ist, glauben wir das.
  if (ABLEHNUNGSCODES.has(code)) return true;

  // 2. Stoerungen bleiben Stoerungen, auch mit 4xx-Status.
  if (status !== undefined && (AUSFALL_TROTZ_4XX.has(status) || status >= 500)) return false;

  // 3. Sonst nur, wenn es wirklich ein Auth-Fehler ist. Ein nacktes
  //    `{ status: 401 }` ohne Auth-Kennzeichen kann auch vom Gateway kommen —
  //    etwa ein rotierter API-Schluessel, also eine Fehlkonfiguration. Die als
  //    "Sitzung ungueltig" zu melden, schickt jeden Bedienenden in eine
  //    Neuanmeldung, die nichts hilft.
  const istAuthFehler = f.name === "AuthApiError" || f.__isAuthError === true;
  if (istAuthFehler && status !== undefined && status >= 400 && status < 500) return true;

  return false;
};

/**
 * Der gemeinsame Adapter fuer `verifyToken`.
 *
 * Er stand dreimal wortgleich in den Handlern — und war dreimal gleich falsch.
 * Einmal hier ist eine Stelle zum Pruefen statt drei zum Vergessen.
 */
export interface AuthDienst {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
}

export const erstelleTokenPruefung =
  (dienst: AuthDienst) =>
  async (token: string): Promise<string | null> => {
    const { data, error } = await dienst.auth.getUser(token);
    if (error) {
      if (istAbgelehntesToken(error)) return null; // 401
      throw error; // 503
    }
    return data.user?.id ?? null;
  };
