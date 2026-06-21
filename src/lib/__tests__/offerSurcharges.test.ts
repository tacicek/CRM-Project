import { describe, it, expect } from "vitest";
import {
  computeSurchargeAmount,
  surchargesTotal,
  withComputedAmounts,
  computeOfferTotals,
  type OfferSurcharge,
} from "@/lib/offerSurcharges";

describe("computeSurchargeAmount", () => {
  it("percent → kalem subtotal üzerinden", () => {
    expect(computeSurchargeAmount({ type: "percent", value: 15 }, 1000, null)).toBe(150);
  });
  it("percent 0–100 aralığına kıstırılır", () => {
    expect(computeSurchargeAmount({ type: "percent", value: 150 }, 1000, null)).toBe(1000);
    expect(computeSurchargeAmount({ type: "percent", value: -10 }, 1000, null)).toBe(0);
  });
  it("fixed → sabit CHF (negatif 0)", () => {
    expect(computeSurchargeAmount({ type: "fixed", value: 120 }, 1000, null)).toBe(120);
    expect(computeSurchargeAmount({ type: "fixed", value: -5 }, 1000, null)).toBe(0);
  });
  it("per_km → CHF/km × mesafe (eksik mesafe 0)", () => {
    expect(computeSurchargeAmount({ type: "per_km", value: 2.5 }, 1000, 40)).toBe(100);
    expect(computeSurchargeAmount({ type: "per_km", value: 2.5 }, 1000, null)).toBe(0);
  });
});

describe("surchargesTotal", () => {
  it("karışık surcharge'ları toplar", () => {
    const surcharges: OfferSurcharge[] = [
      { label: "Wochenende", type: "percent", value: 15, amount: 0 },
      { label: "Anfahrt", type: "fixed", value: 120, amount: 0 },
      { label: "Distanz", type: "per_km", value: 2.5, amount: 0 },
    ];
    expect(surchargesTotal(surcharges, 1000, 40)).toBe(370); // 150 + 120 + 100
  });
  it("boş/null → 0", () => {
    expect(surchargesTotal(null, 1000, 40)).toBe(0);
    expect(surchargesTotal([], 1000, 40)).toBe(0);
  });
});

describe("withComputedAmounts", () => {
  it("amount'ları taze hesaplar (immutable snapshot)", () => {
    const input: OfferSurcharge[] = [{ label: "WE", type: "percent", value: 10, amount: 999 }];
    const out = withComputedAmounts(input, 2000, null);
    expect(out[0].amount).toBe(200);
    expect(out[0].label).toBe("WE");
  });
});

describe("computeOfferTotals", () => {
  it("surcharge'lı offer: taban = kalemler + surcharge, MwSt taban üzerinden", () => {
    const surcharges: OfferSurcharge[] = [
      { label: "Wochenende", type: "percent", value: 15, amount: 0 },
      { label: "Anfahrt", type: "fixed", value: 100, amount: 0 },
    ];
    const t = computeOfferTotals(1000, surcharges, 8.1, null);
    expect(t.itemsSubtotal).toBe(1000);
    expect(t.surchargesTotal).toBe(250); // 150 + 100
    expect(t.taxableBase).toBe(1250); // → offers.subtotal
    expect(t.vatAmount).toBe(101.25); // 1250 * 8.1%
    expect(t.total).toBe(1351.25);
  });
  it("surcharge yok → taban = kalemler (eski offer'larla uyumlu)", () => {
    const t = computeOfferTotals(1000, null, 8.1, null);
    expect(t.taxableBase).toBe(1000);
    expect(t.surchargesTotal).toBe(0);
    expect(t.vatAmount).toBe(81);
    expect(t.total).toBe(1081);
  });
  it("GENERATED kolon tutarlılığı: vat = subtotal*rate/100, total = subtotal+vat", () => {
    const t = computeOfferTotals(740, [{ label: "x", type: "fixed", value: 60, amount: 0 }], 8.1, null);
    // taxableBase offers.subtotal'e yazılır → DB generated ile aynı sonucu vermeli
    expect(t.vatAmount).toBe(round2(t.taxableBase * 8.1 / 100));
    expect(t.total).toBe(round2(t.taxableBase + t.vatAmount));
  });
});

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
