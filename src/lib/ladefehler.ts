/**
 * Was ein fehlgeschlagener Ladevorgang bedeutet — als reine Funktion.
 *
 * BEFUND
 * Die Kundenkarte behandelte jeden Fehlschlag gleich wie "nichts vorhanden":
 * `customer_summary` scheiterte → alle Beträge standen auf CHF 0.00, der
 * Verlauf scheiterte → "Noch keine Ereignisse". Beides sind Aussagen über die
 * Wirklichkeit, die niemand geprüft hat. Eine fehlende Berechtigung, ein
 * abgerissenes Netz und ein leerer Bestand verlangen drei verschiedene
 * Antworten und drei verschiedene Sätze.
 *
 * Diese Funktion trifft die Unterscheidung an EINER Stelle, damit Karte, Liste,
 * Verlauf und Adressblock nicht jeweils eigene Vermutungen anstellen.
 */

/** Ein Ladefehler in der Form, in der die Oberfläche ihn beantworten kann. */
export type Ladefehler = {
  art: "kein_zugriff" | "verbindung" | "unbekannt" | "schema_veraltet";
  /** Die Rohmeldung — nur für die Detailzeile, nie als einzige Auskunft. */
  nachricht: string;
};

/** Die Felder, die PostgrestError und ein `fetch`-Fehler gemeinsam haben. */
export type FehlerEingabe = {
  code?: string | null;
  message?: string | null;
} | null | undefined;

/**
 * PostgREST meldet eine abgelehnte Berechtigung als 42501 (die RAISE EXCEPTION
 * mit ERRCODE = 'insufficient_privilege' aus den RPCs) oder als PGRST301
 * (abgelaufenes JWT). Beides heisst für den Bediener dasselbe: er darf hier
 * nicht hin — nicht "es ist nichts da".
 */
const ZUGRIFF_CODES = new Set(["42501", "PGRST301", "PGRST302"]);

/**
 * Der Browser meldet ein abgerissenes Netz ohne Code. Die Meldungen sind je
 * nach Browser verschieden; geprüft wird deshalb auf die drei bekannten
 * Wortlaute UND auf "kein Code" — ein Fehler ohne Code kam nie aus Postgres.
 */
const VERBINDUNG_TEXTE = ["failed to fetch", "networkerror", "load failed", "fetch failed"];

export const deuteLadefehler = (fehler: FehlerEingabe): Ladefehler | null => {
  if (!fehler) return null;

  const code = (fehler.code ?? "").trim();
  const nachricht = (fehler.message ?? "").trim();

  if (ZUGRIFF_CODES.has(code)) {
    return { art: "kein_zugriff", nachricht };
  }

  const klein = nachricht.toLowerCase();
  if (VERBINDUNG_TEXTE.some((t) => klein.includes(t)) || (code === "" && nachricht !== "")) {
    return { art: "verbindung", nachricht };
  }

  return { art: "unbekannt", nachricht };
};

/**
 * Ein Fehler ist ein Fehler, auch wenn er keine Meldung trägt: ein leeres
 * Objekt aus einem `catch` darf nicht als "alles in Ordnung" durchgehen.
 */
export const istFehlgeschlagen = (fehler: FehlerEingabe): boolean =>
  fehler !== null && fehler !== undefined;

/**
 * Trägt die Antwort einer RPC die Felder, mit denen die Oberfläche rechnet?
 *
 * BEFUND
 * Die Kundenkarte erwartet seit 20260807100000 die Blöcke `offen` und
 * `aktionen` in `customer_summary`. Läuft die Oberfläche gegen eine Datenbank,
 * in der diese Migration noch nicht eingespielt ist, antwortet die alte Fassung
 * ohne diese Blöcke — und der Achtungsstreifen las `offen.faelle` auf
 * `undefined`. Ergebnis: eine leere Seite mit einer Meldung in der Konsole.
 *
 * Das ist KEIN Ladefehler im üblichen Sinn: die Abfrage hat funktioniert, die
 * Antwort ist nur älter als der Bildschirm, der sie anzeigt. Genau das gehört
 * hingeschrieben — ein "Erneut versuchen" hilft dagegen nicht, ein Deploy schon.
 *
 * BEWUSST KEIN Ersatzwert. Ein `?? 0` hätte den Absturz beseitigt und dafür
 * behauptet, dieser Kunde habe keine offenen Fälle.
 */
export const veralteteAntwort = (
  antwort: unknown,
  pflichtfelder: readonly string[],
): Ladefehler | null => {
  if (antwort === null || antwort === undefined || typeof antwort !== "object") {
    return null; // kein Inhalt ist Sache des Aufrufers, nicht dieser Prüfung
  }
  const fehlend = pflichtfelder.filter(
    (feld) => (antwort as Record<string, unknown>)[feld] === undefined,
  );
  return fehlend.length === 0
    ? null
    : { art: "schema_veraltet", nachricht: fehlend.join(", ") };
};
