/**
 * Offer Zuschläge (surcharges) — saf fiyat çekirdeği (tek kaynak, spec §5.3/§5.5).
 *
 * DB/React bilmez. Tüm yüzeyler (form önizleme, detay, public, PDF, e-posta) bu
 * helper'dan beslenir → "ekranda X, PDF'te Y" tutarsızlığını önler.
 *
 * GENERATED kolon uyumu: surcharge'lar VAT'tan önce vergilendiği için (norm),
 * vergi tabanı = kalemler + surcharge'lar. Bu taban `offers.subtotal`'e yazılır;
 * böylece GENERATED vat_amount (= subtotal*vat_rate/100) ve total doğru kalır.
 */

export type SurchargeType = "percent" | "fixed" | "per_km";

export interface OfferSurcharge {
  label: string;
  type: SurchargeType;
  /** percent: 15 (%) · fixed: 120.00 (CHF) · per_km: 2.50 (CHF/km) */
  value: number;
  /** Kaydetme anında hesaplanmış CHF tutarı (immutable snapshot). */
  amount: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/**
 * Tek bir surcharge'ın CHF tutarını hesaplar.
 * - percent: kalem subtotal'ı üzerinden (0–100 aralığına kıstırılır)
 * - fixed: sabit CHF (negatif → 0)
 * - per_km: CHF/km × iş mesafesi (negatif/eksik → 0)
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

/** Tüm surcharge'ların toplam CHF tutarı. */
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

/** Surcharge dizisini taze `amount`'larla döner (kaydetme anı snapshot'ı). */
export const withComputedAmounts = (
  surcharges: OfferSurcharge[] | null | undefined,
  itemsSubtotal: number,
  distanceKm: number | null | undefined,
): OfferSurcharge[] =>
  (surcharges ?? []).map((s) => ({
    ...s,
    amount: computeSurchargeAmount(s, itemsSubtotal, distanceKm),
  }));

export interface OfferTotals {
  /** Σ kalemler (offer_items.total). */
  itemsSubtotal: number;
  surchargesTotal: number;
  /** Vergi tabanı = itemsSubtotal + surchargesTotal → offers.subtotal'e yazılır. */
  taxableBase: number;
  vatAmount: number;
  total: number;
}

/**
 * Bir offer'ın tüm toplamlarını hesaplar (tek kaynak).
 * taxableBase, GENERATED vat_amount/total ile birebir tutarlı olacak şekilde
 * offers.subtotal'e yazılmalıdır.
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
