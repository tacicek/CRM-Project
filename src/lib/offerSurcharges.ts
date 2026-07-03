/**
 * Offer Zuschläge (surcharges) — pure pricing core (single source, spec §5.3/§5.5).
 *
 * Does not know about DB/React. All surfaces (form preview, detail, public, PDF, e-mail) are fed
 * from this helper → prevents the "X on screen, Y in the PDF" inconsistency.
 *
 * GENERATED column compatibility: since surcharges are taxed before VAT (per the norm),
 * the tax base = items + surcharges. This base is written to `offers.subtotal`;
 * so the GENERATED vat_amount (= subtotal*vat_rate/100) and total stay correct.
 */

export type SurchargeType = "percent" | "fixed" | "per_km";

export interface OfferSurcharge {
  label: string;
  type: SurchargeType;
  /** percent: 15 (%) · fixed: 120.00 (CHF) · per_km: 2.50 (CHF/km) */
  value: number;
  /** CHF amount computed at save time (immutable snapshot). */
  amount: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/**
 * Computes the CHF amount of a single surcharge.
 * - percent: on the item subtotal (clamped to the 0–100 range)
 * - fixed: fixed CHF (negative → 0)
 * - per_km: CHF/km × job distance (negative/missing → 0)
 */
export const computeSurchargeAmount = (
  surcharge: Pick<OfferSurcharge, "type" | "value">,
  itemsSubtotal: number,
  distanceKm: number | null | undefined,
): number => {
  const value = Number.isFinite(surcharge.value) ? surcharge.value : 0;
  switch (surcharge.type) {
    case "percent":
      return round2(itemsSubtotal * (clamp(value, 0, 100) / 100));
    case "fixed":
      return round2(Math.max(0, value));
    case "per_km":
      return round2(Math.max(0, value) * Math.max(0, distanceKm ?? 0));
    default:
      return 0;
  }
};

/** Total CHF amount of all surcharges. */
export const surchargesTotal = (
  surcharges: OfferSurcharge[] | null | undefined,
  itemsSubtotal: number,
  distanceKm: number | null | undefined,
): number =>
  round2(
    (surcharges ?? []).reduce(
      (sum, s) => sum + computeSurchargeAmount(s, itemsSubtotal, distanceKm),
      0,
    ),
  );

/** Returns the surcharge array with fresh `amount`s (save-time snapshot). */
export const withComputedAmounts = (
  surcharges: OfferSurcharge[] | null | undefined,
  itemsSubtotal: number,
  distanceKm: number | null | undefined,
): OfferSurcharge[] =>
  (surcharges ?? []).map((s) => ({
    ...s,
    amount: computeSurchargeAmount(s, itemsSubtotal, distanceKm),
  }));

/** DB jsonb → OfferSurcharge[] (safe boundary conversion, for read surfaces). */
export const parseSurcharges = (raw: unknown): OfferSurcharge[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is OfferSurcharge =>
      !!s && typeof s === "object" && typeof (s as OfferSurcharge).label === "string",
  );
};

/** Sum of the stored (snapshot) surcharge amounts. */
export const sumSurchargeAmounts = (surcharges: OfferSurcharge[] | null | undefined): number =>
  round2((surcharges ?? []).reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0));

export interface OfferTotals {
  /** Σ items (offer_items.total). */
  itemsSubtotal: number;
  surchargesTotal: number;
  /** Tax base = itemsSubtotal + surchargesTotal → written to offers.subtotal. */
  taxableBase: number;
  vatAmount: number;
  total: number;
}

/**
 * Computes all totals of an offer (single source).
 * taxableBase must be written to offers.subtotal so it stays exactly consistent with
 * the GENERATED vat_amount/total.
 */
export const computeOfferTotals = (
  itemsSubtotal: number,
  surcharges: OfferSurcharge[] | null | undefined,
  vatRate: number,
  distanceKm: number | null | undefined,
): OfferTotals => {
  const items = round2(itemsSubtotal);
  const st = surchargesTotal(surcharges, items, distanceKm);
  const taxableBase = round2(items + st);
  const vatAmount = round2((taxableBase * (Number.isFinite(vatRate) ? vatRate : 0)) / 100);
  return {
    itemsSubtotal: items,
    surchargesTotal: st,
    taxableBase,
    vatAmount,
    total: round2(taxableBase + vatAmount),
  };
};
