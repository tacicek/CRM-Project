import { describe, it, expect } from "vitest";
import {
  computeSurchargeAmount,
  surchargesTotal,
  withComputedAmounts,
  computeOfferTotals,
  validateSurcharges,
  surchargesToJson,
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

describe("validateSurcharges — fail-closed document boundary", () => {
  const valid: OfferSurcharge = { label: "Wochenende", type: "fixed", value: 120, amount: 120 };

  it("treats null/undefined as the valid 'no surcharges' state (distinct from malformed)", () => {
    expect(validateSurcharges(null)).toEqual({ ok: true, value: [] });
    expect(validateSurcharges(undefined)).toEqual({ ok: true, value: [] });
  });

  it("accepts an array of fully-valid surcharges and preserves label/amount", () => {
    const res = validateSurcharges([valid]);
    expect(res).toEqual({ ok: true, value: [valid] });
    if (res.ok) {
      expect(res.value[0].label).toBe("Wochenende");
      expect(res.value[0].amount).toBe(120);
    }
  });

  it("fails closed on a non-array (never coerced to [])", () => {
    expect(validateSurcharges("[]")).toEqual({ ok: false });
    expect(validateSurcharges({})).toEqual({ ok: false });
    expect(validateSurcharges(42)).toEqual({ ok: false });
  });

  it("fails closed when ANY item is malformed — does not silently drop it", () => {
    expect(validateSurcharges([valid, { label: "x" }])).toEqual({ ok: false });
    expect(validateSurcharges([{ label: 1, type: "fixed", value: 1, amount: 1 }])).toEqual({ ok: false });
    expect(validateSurcharges([{ ...valid, amount: NaN }])).toEqual({ ok: false });
    expect(validateSurcharges([{ ...valid, type: "bogus" }])).toEqual({ ok: false });
  });

  it("does not mutate its input and does not change label/amount values", () => {
    const input = [{ label: "A", type: "percent" as const, value: 10, amount: 55.5 }];
    const res = validateSurcharges(input);
    expect(input).toEqual([{ label: "A", type: "percent", value: 10, amount: 55.5 }]);
    if (res.ok) expect(res.value[0].amount).toBe(55.5);
  });
});

describe("surchargesToJson", () => {
  const s = { label: "Wochenende", type: "percent" as const, value: 15, amount: 45 };
  it("re-materializes surcharges as fresh JSON, values/order preserved", () => {
    const out = surchargesToJson([s, { label: "Anfahrt", type: "fixed" as const, value: 120, amount: 120 }]);
    expect(out).toEqual([
      { label: "Wochenende", type: "percent", value: 15, amount: 45 },
      { label: "Anfahrt", type: "fixed", value: 120, amount: 120 },
    ]);
  });
  it("empty → empty array", () => {
    expect(surchargesToJson([])).toEqual([]);
  });
  it("does not mutate input and returns fresh objects", () => {
    const input = [{ ...s }];
    const snap = structuredClone(input);
    const out = surchargesToJson(input);
    expect(input).toEqual(snap);
    if (Array.isArray(out)) expect(out[0]).not.toBe(input[0]);
  });
});
