import { describe, it, expect } from "vitest";
import {
  computeSurchargeAmount,
  surchargesTotal,
  withComputedAmounts,
  computeOfferTotals,
  type OfferSurcharge,
} from "@/lib/offerSurcharges";

describe("computeSurchargeAmount", () => {
  it("percent → on the item subtotal", () => {
    expect(computeSurchargeAmount({ type: "percent", value: 15 }, 1000, null)).toBe(150);
  });
  it("percent is clamped to the 0–100 range", () => {
    expect(computeSurchargeAmount({ type: "percent", value: 150 }, 1000, null)).toBe(1000);
    expect(computeSurchargeAmount({ type: "percent", value: -10 }, 1000, null)).toBe(0);
  });
  it("fixed → fixed CHF (negative 0)", () => {
    expect(computeSurchargeAmount({ type: "fixed", value: 120 }, 1000, null)).toBe(120);
    expect(computeSurchargeAmount({ type: "fixed", value: -5 }, 1000, null)).toBe(0);
  });
  it("per_km → CHF/km × distance (missing distance 0)", () => {
    expect(computeSurchargeAmount({ type: "per_km", value: 2.5 }, 1000, 40)).toBe(100);
    expect(computeSurchargeAmount({ type: "per_km", value: 2.5 }, 1000, null)).toBe(0);
  });
});

describe("surchargesTotal", () => {
  it("sums mixed surcharges", () => {
    const surcharges: OfferSurcharge[] = [
      { label: "Wochenende", type: "percent", value: 15, amount: 0 },
      { label: "Anfahrt", type: "fixed", value: 120, amount: 0 },
      { label: "Distanz", type: "per_km", value: 2.5, amount: 0 },
    ];
    expect(surchargesTotal(surcharges, 1000, 40)).toBe(370); // 150 + 120 + 100
  });
  it("empty/null → 0", () => {
    expect(surchargesTotal(null, 1000, 40)).toBe(0);
    expect(surchargesTotal([], 1000, 40)).toBe(0);
  });
});

describe("withComputedAmounts", () => {
  it("computes amounts fresh (immutable snapshot)", () => {
    const input: OfferSurcharge[] = [{ label: "WE", type: "percent", value: 10, amount: 999 }];
    const out = withComputedAmounts(input, 2000, null);
    expect(out[0].amount).toBe(200);
    expect(out[0].label).toBe("WE");
  });
});

describe("computeOfferTotals", () => {
  it("offer with surcharge: base = items + surcharge, MwSt on the base", () => {
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
  it("no surcharge → base = items (compatible with old offers)", () => {
    const t = computeOfferTotals(1000, null, 8.1, null);
    expect(t.taxableBase).toBe(1000);
    expect(t.surchargesTotal).toBe(0);
    expect(t.vatAmount).toBe(81);
    expect(t.total).toBe(1081);
  });
  it("GENERATED column consistency: vat = subtotal*rate/100, total = subtotal+vat", () => {
    const t = computeOfferTotals(740, [{ label: "x", type: "fixed", value: 60, amount: 0 }], 8.1, null);
    // taxableBase is written to offers.subtotal → must give the same result as the DB generated
    expect(t.vatAmount).toBe(round2(t.taxableBase * 8.1 / 100));
    expect(t.total).toBe(round2(t.taxableBase + t.vatAmount));
  });
});

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
