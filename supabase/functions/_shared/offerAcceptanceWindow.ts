/**
 * Bis wann darf der Kunde diese Offerte annehmen?
 *
 * EINE REGEL, DREI LAUFZEITEN
 *
 * Die Frist ist der FRUEHERE von zwei Tagen: `valid_until` und der Tag VOR
 * `service_date`. Der zweite Teil ist der unauffaellige: eine Offerte fuer den
 * 2. September ist am 2. September nicht mehr annehmbar, ganz gleich, was in
 * `valid_until` steht. Wer nur auf `valid_until` schaut, sieht eine Offerte,
 * die noch offen aussieht und es nicht ist.
 *
 * Genau daran ist 10095 gescheitert: Ausfuehrung 02.09., Gueltig bis 10.09.,
 * Frist damit der 01.09. — ein Tag VOR dem Anlegen. Die Offerte war in dem
 * Moment tot, in dem sie gespeichert wurde, und nichts im Formular sagte es.
 *
 * Deshalb steht die Regel hier und nicht in der Seite, die sie zufaellig
 * braucht: sie wird an drei Stellen gebraucht, die einander nicht sehen —
 * beim ANLEGEN (was der Bediener gerade einstellt), beim SENDEN (die
 * massgebliche Pruefung in `send-offer`) und beim ANNEHMEN (die oeffentliche
 * Seite). Drei Kopien waeren drei Wahrheiten.
 *
 * Eine vierte Kopie bleibt bewusst bestehen: `update_offer_by_token` rechnet
 * dieselbe Frist in SQL. Das ist die letzte Grenze — sie haelt auch dann, wenn
 * niemand diese Datei aufgerufen hat. SQL kann kein TypeScript importieren;
 * die Doppelung ist der Preis fuer eine Grenze, die wirklich eine ist.
 *
 * KEINE ABHAENGIGKEITEN. Deno und Browser laden dieselbe Datei; sie darf
 * weder Deno-Globals noch React noch einen i18n-Katalog kennen. Sie liefert
 * Daten, keine Saetze.
 *
 * ZEITZONE: gerechnet wird in UTC, weil die Datenbank in UTC laeuft und dort
 * `CURRENT_DATE` ueber die Annahme entscheidet. Waere die Oberflaeche auf die
 * lokale Zeit gegangen, haetten Browser und Datenbank in den Stunden nach
 * Mitternacht verschiedene Tage gemeint.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `true` fuer genau die Form `YYYY-MM-DD`. Kein Kalendercheck — den macht `addDays`. */
export const istIsoDatum = (wert: unknown): wert is string =>
  typeof wert === "string" && DATE.test(wert);

/** Der heutige Tag als `YYYY-MM-DD` in UTC — dieselbe Rechnung wie `CURRENT_DATE`. */
export const heuteIso = (jetzt: Date = new Date()): string => jetzt.toISOString().slice(0, 10);

/** `("2026-09-02", -1)` → `"2026-09-01"`. Monats- und Jahreswechsel macht `Date` selbst. */
export const addDays = (iso: string, tage: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
};

/**
 * Der letzte Tag, an dem der Kunde annehmen darf — `null`, wenn keiner der
 * beiden Werte gesetzt ist und die Annahme damit unbefristet ist.
 */
export const computeAcceptanceDeadline = (
  validUntil: string | null,
  serviceDate: string | null,
): string | null => {
  const kandidaten: string[] = [];
  if (istIsoDatum(validUntil)) kandidaten.push(validUntil);
  if (istIsoDatum(serviceDate)) kandidaten.push(addDays(serviceDate, -1));
  if (kandidaten.length === 0) return null;
  // ISO-Datumsstrings sind lexikographisch sortierbar; der erste ist der frueheste.
  return kandidaten.sort()[0];
};

export interface AcceptanceWindow {
  /** Der letzte Annahmetag, oder `null` bei unbefristeter Annahme. */
  frist: string | null;
  /** `false` heisst: der Kunde kann diese Offerte nicht mehr annehmen. */
  offen: boolean;
}

/**
 * Beantwortet die Frage, an der alle drei Aufrufer haengen: kann der Kunde
 * heute noch zusagen?
 *
 * `heute` wird uebergeben statt hier gelesen, damit die Regel pruefbar bleibt
 * und Server und Browser denselben Tag meinen koennen.
 */
export const evaluateAcceptanceWindow = (
  validUntil: string | null,
  serviceDate: string | null,
  heute: string,
): AcceptanceWindow => {
  if (!istIsoDatum(heute)) {
    // Ein unbrauchbarer Vergleichstag ist ein Programmierfehler, kein Datenfall.
    // Ihn stillschweigend als "offen" zu behandeln hiesse, das Tor zu oeffnen,
    // ohne die Frage gestellt zu haben.
    throw new TypeError(`evaluateAcceptanceWindow: heute muss YYYY-MM-DD sein, war: ${String(heute)}`);
  }
  const frist = computeAcceptanceDeadline(validUntil, serviceDate);
  return { frist, offen: frist === null || heute <= frist };
};
