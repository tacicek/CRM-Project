/**
 * Pure helpers for the Swiss 24-hour time input (TimeInputCH).
 * Kept in a plain module (not the component file) so they are unit-testable and
 * don't trip react-refresh. Canonical form is "HH:MM" (24h) — the DB `time`
 * column / PDF format. No AM/PM anywhere; Switzerland uses 24-hour time.
 */

/** Strip to "HH:MM" (drops any seconds a `time` column may carry). */
export function normalizeDisplay(value: string): string {
  return value ? value.slice(0, 5) : "";
}

/** Auto-insert the colon as the user types: "0830" → "08:30". */
export function autoFormat(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * "08:30" → "08:30" (padded, validated); "" if incomplete/invalid.
 * Complete forms only: "H:MM"/"HH:MM" (with colon) or a bare 4-digit "HHMM".
 * A 2-digit "08" is treated as incomplete (still typing the hour), never 00:08.
 */
export function displayToValue(display: string): string {
  const match = display.match(/^(\d{1,2}):(\d{2})$/) ?? display.match(/^(\d{2})(\d{2})$/);
  if (!match) return "";
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh > 23 || mm > 59) return "";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
