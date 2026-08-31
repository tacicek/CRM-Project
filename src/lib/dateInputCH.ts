/**
 * Pure helpers for the Swiss-format date field (DD.MM.YYYY on screen,
 * ISO YYYY-MM-DD in state). Extracted so they can be tested — the component
 * itself is not, per the repo's testing policy.
 *
 * WHY THE STRICTNESS BELOW EXISTS
 *
 * The earlier version treated "well-formed" as "valid": its only check was
 * `isNaN(new Date(y-m-d))`. Year 0261 passes that check — `0261-08-31` is a
 * perfectly ordinary Date — so the field committed it, and offer 10091 went to
 * the customer with "Termin 31.08.261".
 *
 * One keystroke was enough. `autoFormat` keeps only the first eight digits and
 * re-slices them, so typing a single `0` into the year of a full `31.08.2026`
 * yields `31.08.0202`, which the old check waved through on the spot. Blur did
 * not rescue it either: blur only reverts what `displayToIso` rejects.
 *
 * So the gate has to answer the domain question, not the parser question: is
 * this a date a person could have meant?
 */

/** Nobody schedules a Swiss move in year 261 or 4000. Wide enough to never
 *  reject a real entry, narrow enough that a mangled year cannot survive. */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2199;

/** "2026-04-29" → "29.04.2026" */
export function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

/** Auto-insert dots as the user types: "2904" → "29.04." */
export function autoFormat(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
}

/**
 * "29.04.2026" → "2026-04-29", or "" when the entry is not a date a person
 * could have meant.
 *
 * Rejects: wrong shape, a year outside [MIN_YEAR, MAX_YEAR], and any
 * combination that does not survive the round trip — 31.04 and 29.02.2027 come
 * back as a different day, so they are not the date that was typed.
 */
export function displayToIso(display: string): string {
  const clean = display.replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  if (parts.length !== 3) return "";

  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return "";
  if (d.length > 2 || m.length > 2) return "";

  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  if (year < MIN_YEAR || year > MAX_YEAR) return "";
  if (month < 1 || month > 12) return "";
  if (day < 1 || day > 31) return "";

  const iso = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Round trip in UTC — `new Date("YYYY-MM-DD")` is parsed as UTC midnight, so
  // reading the parts back with the local getters would shift the day west of
  // Greenwich and reject valid dates.
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return "";
  }

  return iso;
}
