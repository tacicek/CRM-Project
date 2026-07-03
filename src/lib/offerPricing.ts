// Shared pure helpers for the offer pricing model.
// Single source: PDF (ServiceTable) + public OfferView derive the same logic from here — no inline copies.
//
// NOTE: mapOfferData (maxHours guard) and OfferteItemRow (min&&max guard) still use their own inline
// guards; guard consolidation = scope of 3b (CLAUDE.md root-cause: not a patch, to be merged in a
// separate, deliberate step).

export interface TimeEstimate {
  minHours: number;
  maxHours: number;
  hourlyRate: number;
}

/**
 * Returns the price range of a blind/stundenbasiert (hourly) item.
 *
 * Guard is IDENTICAL to ServiceTable (ItemRow): if `te` is missing or
 * `!(minHours > 0 && hourlyRate > 0)` then null (PDF behaviour is preserved).
 *
 * DEFENSIVE: DB jsonb may carry an unexpected shape and the caller uses `as Offer`/`as OfferItem`
 * casts (TS does not warn). So we trust the VALUE, not the TYPE — if the fields are not real
 * numbers it returns null instead of blowing up.
 */
export const hourlyRange = (
  te: TimeEstimate | null | undefined,
): { min: number; max: number } | null => {
  if (
    !te ||
    typeof te.minHours !== "number" ||
    typeof te.maxHours !== "number" ||
    typeof te.hourlyRate !== "number"
  ) {
    return null;
  }
  if (!(te.minHours > 0 && te.hourlyRate > 0)) return null;
  return {
    min: te.minHours * te.hourlyRate,
    max: te.maxHours * te.hourlyRate,
  };
};

// ---------------------------------------------------------------------------
// Offer subtotal — SINGLE SOURCE (create + edit derive the same formula from here).
//
// Lesson #8 (reference): if subtotal/VAT is computed in multiple places it diverges.
// Previous state: create excluded by price_type (optional+inkl excluded), edit excluded by the
// unit==="inkl." string (which missed optional) → after edit+save the DB total drifted.
// Solution: a single pure fn; exclusion by SEMANTIC price_type, not by the unit string.
// ---------------------------------------------------------------------------

export interface SubtotalItem {
  priceType: string; // 'pauschale' | 'per_unit' | 'per_hour' | 'optional' | 'inkl'
  quantity: number;
  unitPrice: number;
  timeEstimate: TimeEstimate | null;
}

// Item types not included in the subtotal (shown but not summed): optional, inkl.
const EXCLUDED_FROM_SUBTOTAL = new Set(["optional", "inkl"]);

/**
 * Is an item "free" (not in the subtotal → chip in the UI)? priceType ∈ {inkl, optional} → true.
 * Paid (pauschale/per_unit/per_hour → box) → false.
 *
 * ⚠️ SINGLE SOURCE: derives from the same constant EXCLUDED_FROM_SUBTOTAL that determines
 * subtotal/VAT — the "free = not in the subtotal" semantics are not split (Lesson #8). No separate
 * {inkl,optional} list is defined; the chip/box distinction and the financial distinction always stay in sync.
 */
export const isFreeItem = (priceType: string | null | undefined): boolean =>
  EXCLUDED_FROM_SUBTOTAL.has(priceType ?? "");

// Same set as OfferItem.priceType (OfferteItemRow). For the catalog → offer item bridge.
export type OfferPriceType = "pauschale" | "per_unit" | "per_hour" | "inkl" | "optional";

/**
 * A catalog item's price type, derived from its semantic flags — SINGLE SOURCE for both
 * catalog-add paths in OfferteErstellen (no inline copies that can diverge).
 *
 * Priority (semantic flags first, unit only as fallback):
 *   1. is_default_included → "inkl"      (included → chip)
 *   2. is_optional         → "optional"  (on request → chip)
 *   3. unit "Inklusiv"     → "inkl"      (legacy, still honoured)
 *   4. unit-based paid type → per_hour / per_unit / pauschale (→ box)
 *
 * NOTE: default_price is intentionally NOT consulted — a CHF 0 optional item must stay
 * "optional", not silently become "inkl". The flags decide, never the price.
 */
export const derivePriceTypeFromCatalog = (item: {
  is_default_included?: boolean;
  is_optional?: boolean;
  unit?: string | null;
}): OfferPriceType => {
  if (item.is_default_included) return "inkl";
  if (item.is_optional) return "optional";
  if (item.unit === "Inklusiv") return "inkl";
  const u = (item.unit ?? "").trim().toLowerCase();
  if (u.includes("stunde") || u.includes("std")) return "per_hour";
  if (["stück", "stk", "stk.", "m3", "m³", "m2", "m²", "kg", "lfm", "tag", "fahrt", "person", "stockwerk"].includes(u))
    return "per_unit";
  return "pauschale";
};

/**
 * Computes the subtotal of an item list (pure — does not parse, expects numbers).
 * - priceType ∈ {optional, inkl} → skipped (isFreeItem).
 * - if timeEstimate is valid (hourlyRange) → mode 'min' lower bound, 'max' upper bound.
 * - otherwise quantity * unitPrice.
 */
export const computeItemsSubtotal = (
  items: SubtotalItem[],
  mode: "min" | "max" = "min",
): number =>
  items.reduce((sum, item) => {
    if (isFreeItem(item.priceType)) return sum;
    const r = hourlyRange(item.timeEstimate);
    if (r) return sum + (mode === "min" ? r.min : r.max);
    return sum + item.quantity * item.unitPrice;
  }, 0);

/**
 * itemsSubtotal + (fixed) surcharge sum → taxableBase → VAT → total.
 * For the UPPER bound of the blind range, the PDF (mapOfferData) and OfferView use the same chain.
 * surchargesSum is FIXED (stored amounts) — percent is not recomputed (offers.surcharges already
 * carries a computed amount). The min side comes from the DB's GENERATED values; this fn is only
 * for the upper bound (max). vatRate 0 → vatAmount 0.
 */
export const computeTotalsFromSubtotal = (
  itemsSubtotal: number,
  surchargesSum: number,
  vatRate: number,
): { taxableBase: number; vatAmount: number; total: number } => {
  const taxableBase = itemsSubtotal + surchargesSum;
  const vatAmount = (taxableBase * (vatRate > 0 ? vatRate : 0)) / 100;
  return { taxableBase, vatAmount, total: taxableBase + vatAmount };
};

// Blind offer disclaimer — PDF (BlindOfferteDisclaimer) + OfferView (DOM) use the same text.
export const BLIND_DISCLAIMER_LABEL = "Wichtiger Hinweis";
export const BLIND_DISCLAIMER_TEXT =
  "Diese Offerte wurde ohne persönliche Besichtigung erstellt und basiert ausschliesslich auf den " +
  "Angaben des Kunden. Die aufgeführten Preise sind Schätzungen. Allfällige Anpassungen werden vor " +
  "Auftragserteilung in Absprache mit dem Kunden vorgenommen.";
