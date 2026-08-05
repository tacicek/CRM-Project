/**
 * Die Zeitzonen-Grenze der Termin-Wanduhrwerte.
 *
 * `appointments` speichert eine nackte Schweizer Wanduhr: `appointment_date` (DATE) und
 * `start_time`/`end_time` (TIME), beides ohne Offset. Die Deno-Laufzeit steht auf UTC.
 * Zwischen diesen beiden Welten gibt es genau zwei Übersetzungen, und man braucht beide:
 *
 *   - `zonedWallClockToUtc(datum, zeit)` — was in der Zeile steht, als echter Zeitpunkt.
 *   - `zonedDateString(zeitpunkt)`       — auf welchen Zürcher Kalendertag ein Zeitpunkt fällt.
 *
 * Wer nur die erste hat und für die zweite `toISOString()` nimmt, mischt die Welten. Zürich
 * ist UTC+1/+2, also meldet `toISOString()` zwischen lokaler Mitternacht und 01:00/02:00
 * noch den Vortag. Eine Abfrage `appointment_date = <UTC-Datum>` greift dann in der Nacht
 * den falschen Tag ab — genau der Fehler, den dieses Modul beseitigt.
 *
 * Deno-frei und import-frei, damit die Übersetzungen wie jede andere reine Einheit getestet
 * werden können (siehe __tests__/appointmentDay.test.ts).
 */

export const APP_TIME_ZONE = "Europe/Zurich";

/** Der Offset von `timeZone` gegenüber UTC, gültig zu einem bestimmten Zeitpunkt. */
const offsetMsAt = (instant: number, timeZone: string): number => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  const asSeenInZone = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asSeenInZone - instant;
};

/**
 * Liest eine gespeicherte Wanduhr (`YYYY-MM-DD` + `HH:MM(:SS)`) als Zeit in `timeZone` und
 * gibt den zugehörigen UTC-Zeitpunkt zurück.
 *
 * `new Date("2026-07-03T14:00:00")` läse die 14:00 in einem UTC-Container als 14:00 UTC und
 * verschätzte sich um den CET/CEST-Offset.
 *
 * ── Warum zwei Durchgänge ───────────────────────────────────────────────────
 *
 * Der Offset, den man braucht, gilt zum gesuchten Zeitpunkt — den man noch nicht kennt. Ein
 * einziger Durchgang nimmt deshalb den Offset, der zur Wanduhr *als UTC gelesen* gilt, und
 * das ist in der Nähe einer Zeitumstellung der falsche: für den 2026-03-29 um 01:30 (noch
 * CET, +1) läge die Probe bei 01:30 UTC, also schon hinter der Umstellung, und lieferte +2 —
 * eine Stunde daneben und einen Kalendertag zurück.
 *
 * Der zweite Durchgang misst den Offset am beinahe richtigen Zeitpunkt und trifft. Dieselbe
 * Konstruktion steht in supabase/functions/calendar-feed/ics.ts; sie fehlte hier.
 *
 * Für eine Wanduhr in der übersprungenen Stunde (02:00–03:00 am Frühjahrstag) gibt es keinen
 * zugehörigen Zeitpunkt. Das Ergebnis ist dann eine Konvention, kein Messwert.
 */
export const zonedWallClockToUtc = (
  dateStr: string,
  timeStr: string,
  timeZone = APP_TIME_ZONE,
): Date => {
  const naiveAsUtc = Date.parse(`${dateStr}T${timeStr}Z`);
  let ts = naiveAsUtc - offsetMsAt(naiveAsUtc, timeZone);
  ts = naiveAsUtc - offsetMsAt(ts, timeZone);
  return new Date(ts);
};

/**
 * Der Kalendertag (`YYYY-MM-DD`), auf den ein Zeitpunkt in `timeZone` fällt.
 *
 * Die Gegenrichtung zu `zonedWallClockToUtc`. Sie ist es, die eine Abfrage auf
 * `appointment_date` vergleichbar macht: dort steht ein Zürcher Tagesetikett, kein UTC-Tag.
 *
 * Gelesen werden die `formatToParts`-Bestandteile, nicht die formatierte Zeichenkette —
 * damit hängt das Ergebnis nicht am Zahlenformat der Locale.
 */
export const zonedDateString = (instant: Date, timeZone = APP_TIME_ZONE): string => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(instant).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};

/**
 * Das Etikett des Folgetags zu einem `YYYY-MM-DD`.
 *
 * Reine Etikett-Arithmetik: der Zeitpunkt ist mit `Z` verankert, gerechnet wird in UTC, und
 * UTC kennt keine Sommerzeit — der Tageswechsel wird gezählt, nicht gemessen. Ein Zürcher
 * 23- oder 25-Stunden-Tag ändert daran nichts, weil hier keine Zone im Spiel ist.
 *
 * Der Mittag statt Mitternacht ist reine Vorsicht: sollte je eine Aufrufstelle ein
 * zonenbehaftetes Datum hereinreichen, liegt der Puffer bei zwölf Stunden statt bei null.
 */
export const nextDateString = (dateStr: string): string => {
  const noon = Date.parse(`${dateStr}T12:00:00Z`);
  return new Date(noon + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
};
