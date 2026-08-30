import { MAX_BODY_BYTES, readBoundedUtf8 } from "./boundedBody.ts";
import {
  type BudgetEntscheid,
  type PaidApiBucket,
  istMitgliedschaftsAbweisung,
} from "./paidApiGuard.ts";

/**
 * Der gemeinsame Ablauf der drei bezahlten Google-Endpunkte.
 *
 * WAS HIER LIEGT — und was ausdruecklich nicht
 *
 * Hier liegen nur die Zusagen, die fuer alle drei GLEICH sein muessen:
 * begrenztes Lesen, Reihenfolge der Pruefungen, Form der Ablehnung,
 * `Retry-After`, und ein Protokoll ohne Kundeninhalt.
 *
 * Hier liegt NICHT: das Zod-Schema, der Google-URL-Bau, die Pruefung der
 * Google-Antwort, die Ergebnisabbildung. Jeder Endpunkt behaelt seine eigenen —
 * eine Abstraktion, die drei verschiedene Vertraege hinter einem Namen
 * versteckt, macht sie nicht gleich, sondern nur schwerer zu lesen.
 *
 * DIE REIHENFOLGE IST DER SICHERHEITSVERTRAG
 *
 *   OPTIONS -> Methode -> begrenzter Rumpf -> JSON -> Token -> company_id-Form
 *   -> Nutzdaten (Zod) -> lokale Google-Vorbereitung -> Budget -> Google
 *
 * Alles, was scheitern kann, ohne Geld zu kosten, scheitert VOR dem Budget.
 * Eine unfoermige Nutzlast darf keinen bezahlten Topf anfassen, und ein
 * fehlender API-Schluessel auch nicht: was Google ohnehin nie erreicht, soll
 * kein Kontingent verbrauchen.
 */

export interface SichererLogger {
  (ereignis: string, felder?: Record<string, string | number | boolean>): void;
}

export interface PaidApiUmgebung {
  verifyToken: (token: string) => Promise<string | null>;
  consumeBudget: (
    bucket: PaidApiBucket,
    userId: string,
    companyId: string,
  ) => Promise<BudgetEntscheid>;
  fetchGoogle: (url: string) => Promise<Response>;
  log: SichererLogger;
  grenzeBytes?: number;
}

/** Was ein Endpunkt selbst mitbringt. */
export interface EndpunktVertrag<TNutzlast, TErgebnis> {
  name: string;
  bucket: PaidApiBucket;
  /** Zod-artig: wirft oder liefert null bei ungueltiger Nutzlast. */
  pruefeNutzlast: (roh: unknown) => TNutzlast | null;
  /**
   * Baut die Google-URL AUS LOKALEN MITTELN. Fehlt der Schluessel, wird hier
   * `null` geliefert — dann gibt es 503, und zwar VOR dem Budget.
   */
  baueUrl: (nutzlast: TNutzlast) => string | null;
  /** Wertet die Google-Antwort aus. `null` = fachlich abgelehnt (502-Klasse). */
  werteAus: (daten: unknown) => TErgebnis | null;
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ablehnung = (
  status: number,
  code: string,
  nachricht: string,
  retryAfter?: number,
): Response =>
  new Response(JSON.stringify({ error: nachricht, code }), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      ...(retryAfter !== undefined ? { "Retry-After": String(retryAfter) } : {}),
      ...(status === 405 ? { Allow: "POST, OPTIONS" } : {}),
    },
  });

export const bearbeitePaidApiAnfrage = async <TNutzlast, TErgebnis>(
  req: Request,
  vertrag: EndpunktVertrag<TNutzlast, TErgebnis>,
  umg: PaidApiUmgebung,
): Promise<Response> => {
  const { name, bucket } = vertrag;

  // 1. OPTIONS: nur CORS. Keine Anmeldung, kein Budget, kein Google.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // 2. Nur POST.
  if (req.method !== "POST") {
    umg.log("methode_abgelehnt", { fn: name, status: 405 });
    return ablehnung(405, "method_not_allowed", "Methode nicht erlaubt.");
  }

  // 3. Begrenzt lesen. Es gab dafuer bereits `readBoundedUtf8` im selben
  //    Verzeichnis — ein zweiter Leser waere eine zweite Wahrheit gewesen.
  //    Er zaehlt beim Lesen mit und glaubt `Content-Length` nur, wenn der Wert
  //    zu GROSS ist (dann wird der Strom gar nicht erst angefasst).
  const rumpf = await readBoundedUtf8(
    { contentLength: req.headers.get("Content-Length"), stream: req.body },
    umg.grenzeBytes ?? MAX_BODY_BYTES,
  );
  if (!rumpf.ok) {
    const status = rumpf.reason === "too_large" ? 413 : 400;
    umg.log(rumpf.reason === "too_large" ? "rumpf_zu_gross" : "rumpf_unlesbar", { fn: name, status });
    return status === 413
      ? ablehnung(413, "payload_too_large", "Anfrage zu gross.")
      : ablehnung(400, "invalid_body", "Ungueltiger Anfragerumpf.");
  }

  // 4. Genau einmal auswerten.
  let roh: unknown;
  try {
    roh = JSON.parse(rumpf.text);
  } catch {
    umg.log("json_unlesbar", { fn: name, status: 400 });
    return ablehnung(400, "invalid_json", "Ungueltiger Anfragerumpf.");
  }

  // 5. Token. Ein gestoerter Pruefdienst ist 503, keine Erlaubnis — und auch
  //    kein "ungueltige Sitzung", das waere eine Luege ueber die Ursache.
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^bearer\b\s*/i, "").trim();
  if (!token) {
    umg.log("kein_token", { fn: name, status: 401 });
    return ablehnung(401, "no_token", "Nicht authentifiziert.");
  }

  let userId: string | null;
  try {
    userId = await umg.verifyToken(token);
  } catch {
    umg.log("auth_gestoert", { fn: name, status: 503 });
    return ablehnung(503, "auth_unavailable", "Anmeldung derzeit nicht pruefbar.");
  }
  if (!userId) {
    umg.log("token_ungueltig", { fn: name, status: 401 });
    return ablehnung(401, "invalid_token", "Ungueltige Sitzung.");
  }

  // 6. Form der company_id. Die Mitgliedschaft prueft die Datenbank.
  const companyId = (roh as { company_id?: unknown } | null)?.company_id;
  if (typeof companyId !== "string" || !UUID.test(companyId)) {
    umg.log("company_id_unfoermig", { fn: name, status: 400 });
    return ablehnung(400, "company_id_missing", "company_id fehlt oder ist ungueltig.");
  }

  // 7. Nutzdaten. Unfoermig heisst 400 — und kostet kein Budget.
  const nutzlast = vertrag.pruefeNutzlast(roh);
  if (nutzlast === null) {
    umg.log("nutzlast_ungueltig", { fn: name, status: 400 });
    return ablehnung(400, "invalid_payload", "Ungueltige Anfragedaten.");
  }

  // 8. Google-Anfrage lokal vorbereiten. Fehlt der Schluessel, ist das 503 —
  //    VOR dem Budget, denn ein Kontingent fuer eine Anfrage zu verbrauchen,
  //    die ohnehin nie hinausgeht, waere Diebstahl am Kunden.
  const url = vertrag.baueUrl(nutzlast);
  if (!url) {
    umg.log("google_konfiguration_fehlt", { fn: name, status: 503 });
    return ablehnung(503, "upstream_unconfigured", "Dienst derzeit nicht verfuegbar.");
  }

  // 9. Budget. Die Mitgliedschaft entscheidet die Datenbank.
  let entscheid: BudgetEntscheid;
  try {
    entscheid = await umg.consumeBudget(bucket, userId, companyId);
  } catch (fehler) {
    if (istMitgliedschaftsAbweisung(fehler)) {
      // Bewusst allgemein: die Antwort verraet nicht, ob es die Firma gibt.
      umg.log("mitgliedschaft_abgelehnt", { fn: name, status: 403, bucket });
      return ablehnung(403, "forbidden", "Kein Zugriff.");
    }
    umg.log("budget_gestoert", { fn: name, status: 503, bucket });
    return ablehnung(503, "budget_unavailable", "Dienst derzeit nicht verfuegbar.");
  }

  if (!entscheid.allowed) {
    const retry = Math.max(1, Math.ceil(entscheid.retry_after));
    umg.log("budget_erschoepft", { fn: name, status: 429, bucket, retry_after: retry });
    return ablehnung(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.", retry);
  }

  // 10. Genau ein bezahlter Aufruf.
  let antwort: Response;
  try {
    antwort = await umg.fetchGoogle(url);
  } catch {
    umg.log("upstream_nicht_erreichbar", { fn: name, status: 503, bucket });
    return ablehnung(503, "upstream_unavailable", "Dienst derzeit nicht verfuegbar.");
  }

  if (!antwort.ok) {
    umg.log("upstream_fehler", { fn: name, status: 502, bucket });
    return ablehnung(502, "upstream_error", "Antwort des Dienstes nicht verwertbar.");
  }

  let daten: unknown;
  try {
    daten = await antwort.json();
  } catch {
    umg.log("upstream_unlesbar", { fn: name, status: 502, bucket });
    return ablehnung(502, "upstream_error", "Antwort des Dienstes nicht verwertbar.");
  }

  const ergebnis = vertrag.werteAus(daten);
  if (ergebnis === null) {
    umg.log("upstream_abgelehnt", { fn: name, status: 502, bucket });
    return ablehnung(502, "upstream_error", "Antwort des Dienstes nicht verwertbar.");
  }

  umg.log("erledigt", { fn: name, status: 200, bucket });
  return new Response(JSON.stringify(ergebnis), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
};
