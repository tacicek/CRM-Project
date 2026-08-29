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
