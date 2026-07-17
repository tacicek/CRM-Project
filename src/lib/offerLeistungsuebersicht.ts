/**
 * Read boundary for `offer_leistungsuebersicht.included_services` (a `Json` column).
 *
 * The offer PDF's Leistungsübersicht is OPTIONAL, decorative content — it must never affect
 * the financial offer. So this parser is fail-closed for correctness but non-blocking for the
 * email: a non-array or ANY malformed entry returns `null` (caller omits the whole
 * Leistungsübersicht), NOT an empty `[]` presented as valid. A fully-valid array (including an
 * empty one) is returned as fresh `{ name }` literals — no silent filtering, no mutation.
 */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const parseIncludedServices = (raw: unknown): { name: string }[] | null => {
  if (!Array.isArray(raw)) return null;
  const out: { name: string }[] = [];
  for (const s of raw) {
    if (!isRecord(s) || typeof s.name !== "string") return null;
    out.push({ name: s.name });
  }
  return out;
};
