import { describe, it, expect } from "vitest";
import {
  hourlyRange,
  isFreeItem,
  derivePriceTypeFromCatalog,
  computeItemsSubtotal,
  computeTotalsFromSubtotal,
  applyDiscount,
  computeDiscountAmount,
  computeDisplayTotals,
  type SubtotalItem,
  BLIND_DISCLAIMER_LABEL,
  BLIND_DISCLAIMER_TEXT,
} from "@/lib/offerPricing";

describe("hourlyRange", () => {
  it("normal: returns min*rate and max*rate", () => {
    expect(hourlyRange({ minHours: 2, maxHours: 4, hourlyRate: 100 })).toEqual({
      min: 200,
      max: 400,
    });
  });

  it("null/undefined → null", () => {
    expect(hourlyRange(null)).toBeNull();
    expect(hourlyRange(undefined)).toBeNull();
  });

  it("minHours=0 or hourlyRate=0 → null (identical to the ServiceTable guard)", () => {
    expect(hourlyRange({ minHours: 0, maxHours: 4, hourlyRate: 100 })).toBeNull();
    expect(hourlyRange({ minHours: 2, maxHours: 4, hourlyRate: 0 })).toBeNull();
  });

  it("defensive: wrong shape / wrong type → null (without blowing up)", () => {
    // as-cast trap: DB jsonb may carry an unexpected shape
    expect(hourlyRange({ min: 2, max: 4 } as unknown as Parameters<typeof hourlyRange>[0])).toBeNull();
    expect(
      hourlyRange({ minHours: "2", maxHours: "4", hourlyRate: "100" } as unknown as Parameters<typeof hourlyRange>[0]),
    ).toBeNull();
    expect(hourlyRange({} as unknown as Parameters<typeof hourlyRange>[0])).toBeNull();
  });
});

describe("isFreeItem", () => {
  it("free (chip) types → true", () => {
    expect(isFreeItem("inkl")).toBe(true);
    expect(isFreeItem("optional")).toBe(true);
  });

  it("paid (box) types → false", () => {
    expect(isFreeItem("pauschale")).toBe(false);
    expect(isFreeItem("per_unit")).toBe(false);
    expect(isFreeItem("per_hour")).toBe(false);
  });

  it("null/undefined/empty → false (defensive)", () => {
    expect(isFreeItem(null)).toBe(false);
    expect(isFreeItem(undefined)).toBe(false);
    expect(isFreeItem("")).toBe(false);
  });
});

describe("derivePriceTypeFromCatalog", () => {
  it("is_default_included → inkl (flag takes priority, independent of price)", () => {
    expect(derivePriceTypeFromCatalog({ is_default_included: true, unit: "Stunde" })).toBe("inkl");
  });

  it("is_optional → optional (does NOT become inkl even if CHF 0)", () => {
    expect(derivePriceTypeFromCatalog({ is_optional: true, unit: "Pauschale" })).toBe("optional");
    expect(derivePriceTypeFromCatalog({ is_optional: true, unit: "" })).toBe("optional");
  });

  it("no flag, unit 'Inklusiv' → inkl (legacy)", () => {
    expect(derivePriceTypeFromCatalog({ unit: "Inklusiv" })).toBe("inkl");
  });

  it("unit contains hours → per_hour", () => {
    expect(derivePriceTypeFromCatalog({ unit: "Stunde" })).toBe("per_hour");
    expect(derivePriceTypeFromCatalog({ unit: "Std." })).toBe("per_hour");
  });

  it("unit-based unit → per_unit", () => {
    expect(derivePriceTypeFromCatalog({ unit: "Stück" })).toBe("per_unit");
    expect(derivePriceTypeFromCatalog({ unit: "m³" })).toBe("per_unit");
    expect(derivePriceTypeFromCatalog({ unit: "Tag" })).toBe("per_unit");
  });

  it("unrecognized / empty unit → pauschale", () => {
    expect(derivePriceTypeFromCatalog({ unit: "Pauschale" })).toBe("pauschale");
    expect(derivePriceTypeFromCatalog({ unit: null })).toBe("pauschale");
    expect(derivePriceTypeFromCatalog({})).toBe("pauschale");
  });

  it("priority: is_default_included comes before is_optional", () => {
    expect(derivePriceTypeFromCatalog({ is_default_included: true, is_optional: true })).toBe("inkl");
  });
});

describe("computeItemsSubtotal", () => {
  // Mixed fixture: pauschale + priced optional + inkl + blind
  const mixed: SubtotalItem[] = [
    { priceType: "pauschale", quantity: 1, unitPrice: 1000, timeEstimate: null },
    { priceType: "optional", quantity: 1, unitPrice: 200, timeEstimate: null },
    { priceType: "inkl", quantity: 1, unitPrice: 50, timeEstimate: null },
    { priceType: "pauschale", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 2, maxHours: 4, hourlyRate: 100 } },
  ];

  it("min: excluding optional+inkl, blind lower bound (1000 + 2*100) = 1200", () => {
    expect(computeItemsSubtotal(mixed, "min")).toBe(1200);
  });

  it("max: blind upper bound (1000 + 4*100) = 1400", () => {
    expect(computeItemsSubtotal(mixed, "max")).toBe(1400);
  });

  it("REGRESSION: priced optional does NOT enter the subtotal (1200, not 1400)", () => {
    // if the optional CHF 200 were included min would be 1400 — it must not be
    expect(computeItemsSubtotal(mixed, "min")).not.toBe(1400);
    expect(computeItemsSubtotal(mixed, "min")).toBe(1200);
  });

  it("CREATE == EDIT: both form shapes map to the same SubtotalItem → same number (excluding optional)", () => {
    // create-form item (priceType camelCase) — priced optional, the trigger of the old edit bug
    const createForm = [
      { priceType: "pauschale", quantity: 1, unit_price: 1000, timeEstimate: null },
      { priceType: "optional", quantity: 1, unit_price: 200, timeEstimate: null },
    ];
    // edit-form item (price_type snake) — same content
    const editForm = [
      { price_type: "pauschale", quantity: 1, unit_price: 1000, timeEstimate: null },
      { price_type: "optional", quantity: 1, unit_price: 200, timeEstimate: null },
    ];
    const fromCreate = createForm.map<SubtotalItem>((i) => ({
      priceType: i.priceType,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      timeEstimate: null,
    }));
    const fromEdit = editForm.map<SubtotalItem>((i) => ({
      priceType: i.price_type,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      timeEstimate: null,
    }));
    // In the old bug edit was 1200 (optional included), create 1000 → diverge. Now both are 1000.
    expect(computeItemsSubtotal(fromCreate, "min")).toBe(computeItemsSubtotal(fromEdit, "min"));
    expect(computeItemsSubtotal(fromEdit, "min")).toBe(1000); // optional CHF 200 EXCLUDED
  });

  it("DB mirroring: subtotal 1200 → total = 1200*(1+8.1/100) = 1297.20 cent", () => {
    const subtotal = computeItemsSubtotal(mixed, "min"); // 1200
    const vatRate = 8.1;
    const total = subtotal + (subtotal * vatRate) / 100; // DB generated formula
    expect(Number(total.toFixed(2))).toBe(1297.2);
  });
});

describe("computeTotalsFromSubtotal", () => {
  it("surcharge 0, VAT 8.1: 1000 → total 1081", () => {
    expect(computeTotalsFromSubtotal(1000, 0, 8.1)).toEqual({
      taxableBase: 1000,
      vatAmount: 81,
      total: 1081,
    });
  });

  it("fixed surcharge 100, VAT 8.1: taxableBase 1100, total 1189.1", () => {
    const r = computeTotalsFromSubtotal(1000, 100, 8.1);
    expect(r.taxableBase).toBe(1100);
    expect(Number(r.vatAmount.toFixed(2))).toBe(89.1);
    expect(Number(r.total.toFixed(2))).toBe(1189.1);
  });

  it("VAT 0 → vatAmount 0, total = base", () => {
    expect(computeTotalsFromSubtotal(1200, 0, 0)).toEqual({
      taxableBase: 1200,
      vatAmount: 0,
      total: 1200,
    });
  });

  it("BLIND RANGE — optional excluded on BOTH sides + total range", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", quantity: 1, unitPrice: 1000, timeEstimate: null },
      { priceType: "optional", quantity: 1, unitPrice: 300, timeEstimate: null },
      { priceType: "pauschale", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 2, maxHours: 4, hourlyRate: 100 } },
    ];
    const minItems = computeItemsSubtotal(items, "min"); // 1000 + 200 = 1200 (optional excluded)
    const maxItems = computeItemsSubtotal(items, "max"); // 1000 + 400 = 1400 (optional excluded)
    expect(minItems).toBe(1200);
    expect(maxItems).toBe(1400);
    // VAT 0, surcharge 0 → total range 1200 – 1400
    expect(computeTotalsFromSubtotal(minItems, 0, 0).total).toBe(1200);
    expect(computeTotalsFromSubtotal(maxItems, 0, 0).total).toBe(1400);
  });
});

describe("blind disclaimer constants", () => {
  it("text constants are defined and non-empty", () => {
    expect(BLIND_DISCLAIMER_LABEL).toBe("Wichtiger Hinweis");
    expect(BLIND_DISCLAIMER_TEXT).toContain("ohne persönliche Besichtigung");
  });
});

describe("applyDiscount / computeDiscountAmount (P3a)", () => {
  it("applies the percent discount, rounded to Rappen", () => {
    expect(applyDiscount(1000, 10)).toBe(900);
    expect(computeDiscountAmount(1000, 10)).toBe(100);
  });

  it("null/undefined/0/negative percent → no-op", () => {
    expect(applyDiscount(1000, null)).toBe(1000);
    expect(applyDiscount(1000, undefined)).toBe(1000);
    expect(applyDiscount(1000, 0)).toBe(1000);
    expect(applyDiscount(1000, -5)).toBe(1000);
    expect(computeDiscountAmount(1000, null)).toBe(0);
    expect(computeDiscountAmount(1000, 0)).toBe(0);
  });

  it("matches the new_offer.png reference range (Zwischensumme 3080\u20133640, Rabatt 10 %)", () => {
    // Total exkl. MwSt: 2'772 \u2013 3'276
    expect(applyDiscount(3080, 10)).toBe(2772);
    expect(applyDiscount(3640, 10)).toBe(3276);
    // Rabatt row: \u2212308 \u2013 \u2212364
    expect(computeDiscountAmount(3080, 10)).toBe(308);
    expect(computeDiscountAmount(3640, 10)).toBe(364);
    // Downstream MwSt 8.1 % on the discounted base (same chain as generated columns)
    expect(computeTotalsFromSubtotal(applyDiscount(3080, 10), 0, 8.1).vatAmount).toBeCloseTo(224.53, 2);
    expect(computeTotalsFromSubtotal(applyDiscount(3640, 10), 0, 8.1).vatAmount).toBeCloseTo(265.36, 2);
  });

  it("fractional results round to 2 decimals", () => {
    expect(applyDiscount(999.99, 7.5)).toBe(924.99);
    expect(computeDiscountAmount(999.99, 7.5)).toBe(75);
  });

  it("min and max sides take the same percent independently (mode-agnostic)", () => {
    const pct = 12.5;
    expect(applyDiscount(2000, pct)).toBe(1750);
    expect(applyDiscount(2800, pct)).toBe(2450);
  });
});

describe("computeDisplayTotals (P3b-2a, consolidated read chain)", () => {
  const items: SubtotalItem[] = [
    { priceType: "pauschale", quantity: 1, unitPrice: 1000, timeEstimate: null },
    { priceType: "per_unit", quantity: 4, unitPrice: 20, timeEstimate: null },
  ];

  it("no discount → identical to the old chain (regression guard)", () => {
    const dt = computeDisplayTotals(items, 100, 8.1, null, "min");
    const old = computeTotalsFromSubtotal(computeItemsSubtotal(items, "min"), 100, 8.1);
    expect(dt.subtotal).toBe(1080);
    expect(dt.discountAmount).toBe(0);
    expect(dt.taxableBase).toBe(old.taxableBase);
    expect(dt.vatAmount).toBeCloseTo(old.vatAmount, 10);
    expect(dt.total).toBeCloseTo(old.total, 10);
  });

  it("discount: subtotal stays RAW, base/vat/total are discounted (new_offer.png chain)", () => {
    const refItems: SubtotalItem[] = [
      { priceType: "pauschale", quantity: 1, unitPrice: 3080, timeEstimate: null },
    ];
    const dt = computeDisplayTotals(refItems, 0, 8.1, 10, "min");
    expect(dt.subtotal).toBe(3080); // Zwischensumme HAM — kural
    expect(dt.discountAmount).toBe(308);
    expect(dt.taxableBase).toBe(2772); // = what P3b-1 writes to offers.subtotal
    expect(dt.vatAmount).toBe(224.53); // = DB generated (2772*8.1%)
    expect(dt.total).toBe(2996.53);
  });

  it("max mode excludes optional/inkl — TODO(3b) fixed (documented case)", () => {
    // Documented divergence case: blind te{19,25,100} + optional 500
    // old PDF inline max = 3000 (optional wrongly summed) / correct = 2500.
    const blindItems: SubtotalItem[] = [
      { priceType: "per_hour", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 19, maxHours: 25, hourlyRate: 100 } },
      { priceType: "optional", quantity: 1, unitPrice: 500, timeEstimate: null },
    ];
    const dtMax = computeDisplayTotals(blindItems, 0, 0, null, "max");
    expect(dtMax.subtotal).toBe(2500); // NOT 3000
  });

  it("discount caps the max side of a blind range too", () => {
    const blindItems: SubtotalItem[] = [
      { priceType: "per_hour", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 10, maxHours: 20, hourlyRate: 100 } },
    ];
    const dtMax = computeDisplayTotals(blindItems, 0, 8.1, 10, "max");
    expect(dtMax.subtotal).toBe(2000); // raw Zwischensumme upper bound
    expect(dtMax.taxableBase).toBe(1800);
    expect(dtMax.total).toBe(1945.8);
  });
});
