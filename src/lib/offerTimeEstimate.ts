/**
 * Canonical contract for the `time_estimate` JSON column (present on both `offers`
 * and `offer_items`, `Json | null` in the generated types).
 *
 * Writer-verified shape (OfferteErstellen / OfferteBearbeiten persist exactly this):
 *
 *   { minHours: number, maxHours: number, hourlyRate: number }   // finite numbers
 *   | null                                                        // no estimate
 *
 * `time_estimate` is OPTIONAL DISPLAY metadata: it shows an hour range + rate on the
 * offer, but the persisted price (`unit_price`, totals) is computed and stored
 * separately — a document never derives money from this field at render time. So a
 * malformed value degrades to `null` ("no estimate shown"), the safe never-wrong state
 * for display metadata. This is deliberately different from FINANCIAL config JSON,
 * which must fail closed rather than degrade.
 *
 * Implemented as a pure type-guard (matching `parseSurcharges` in offerSurcharges.ts),
 * NOT Zod: this project's tsconfig runs `strict: false`, under which `z.infer` widens
 * object properties to optional and would not match the required domain shape.
 */

export type OfferTimeEstimate = {
  minHours: number;
  maxHours: number;
  hourlyRate: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Narrow a raw `Json | null` value from a query into the domain shape.
 * Returns `null` for an absent (`null`/`undefined`) OR malformed value — treated the
 * same for this optional display field, on purpose. Never throws; never fabricates
 * numbers (NaN/Infinity are rejected).
 */
export const parseTimeEstimate = (raw: unknown): OfferTimeEstimate | null => {
  if (!isRecord(raw)) return null;
  if (
    isFiniteNumber(raw.minHours) &&
    isFiniteNumber(raw.maxHours) &&
    isFiniteNumber(raw.hourlyRate)
  ) {
    return { minHours: raw.minHours, maxHours: raw.maxHours, hourlyRate: raw.hourlyRate };
  }
  return null;
};
