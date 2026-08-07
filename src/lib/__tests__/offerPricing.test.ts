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
  resolveAmountBasis,
  toAmountBasis,
  defaultAmountBasisForPriceType,
  itemAmountDisplay,
  offerHasRateItem,
  priceTypeShape,
  priceTypeForRateUnit,
  rateUnitForService,
  istStundenEinheit,
  derivePriceModel,
  type SubtotalItem,
  type PriceModelItem,
  type AmountDisplayItem,
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

describe("toAmountBasis (DB string normalizer)", () => {
  it("valid values pass through", () => {
    expect(toAmountBasis("fixed")).toBe("fixed");
    expect(toAmountBasis("rate")).toBe("rate");
    expect(toAmountBasis("range")).toBe("range");
  });

  it("unknown/empty/null/undefined → null (→ legacy derivation)", () => {
    expect(toAmountBasis("pauschal")).toBeNull();
    expect(toAmountBasis("")).toBeNull();
    expect(toAmountBasis(null)).toBeNull();
    expect(toAmountBasis(undefined)).toBeNull();
  });
});

describe("defaultAmountBasisForPriceType (Item-Erstellung)", () => {
  it("per_hour → rate (Stundenansatz)", () => {
    expect(defaultAmountBasisForPriceType("per_hour")).toBe("rate");
  });
  it("alle anderen → fixed", () => {
    expect(defaultAmountBasisForPriceType("pauschale")).toBe("fixed");
    expect(defaultAmountBasisForPriceType("per_unit")).toBe("fixed");
    expect(defaultAmountBasisForPriceType("inkl")).toBe("fixed");
    expect(defaultAmountBasisForPriceType("optional")).toBe("fixed");
    expect(defaultAmountBasisForPriceType(null)).toBe("fixed");
    expect(defaultAmountBasisForPriceType(undefined)).toBe("fixed");
  });
});

describe("resolveAmountBasis (amount_basis axis)", () => {
  it("explicit basis wins (fixed/rate/range)", () => {
    expect(resolveAmountBasis({ amountBasis: "fixed", timeEstimate: null })).toBe("fixed");
    expect(resolveAmountBasis({ amountBasis: "rate", timeEstimate: null })).toBe("rate");
    expect(resolveAmountBasis({ amountBasis: "range", timeEstimate: null })).toBe("range");
  });

  it("explicit basis wins even against a present timeEstimate", () => {
    const te = { minHours: 2, maxHours: 4, hourlyRate: 100 };
    expect(resolveAmountBasis({ amountBasis: "fixed", timeEstimate: te })).toBe("fixed");
    expect(resolveAmountBasis({ amountBasis: "rate", timeEstimate: te })).toBe("rate");
  });

  it("no basis + valid timeEstimate → range (legacy behaviour)", () => {
    expect(resolveAmountBasis({ timeEstimate: { minHours: 2, maxHours: 4, hourlyRate: 100 } })).toBe("range");
  });

  it("no basis + no/invalid timeEstimate → fixed (legacy behaviour)", () => {
    expect(resolveAmountBasis({ timeEstimate: null })).toBe("fixed");
    expect(resolveAmountBasis({ timeEstimate: { minHours: 0, maxHours: 4, hourlyRate: 100 } })).toBe("fixed");
  });

  it("never infers 'rate' — it is an explicit-only state", () => {
    expect(resolveAmountBasis({ timeEstimate: null })).not.toBe("rate");
    expect(resolveAmountBasis({ amountBasis: null, timeEstimate: null })).not.toBe("rate");
  });
});

describe("computeItemsSubtotal — amount_basis", () => {
  it("BACKWARD COMPAT: items without amountBasis behave exactly like before", () => {
    // identical fixture/expectations as the legacy 'mixed' suite above
    const legacy: SubtotalItem[] = [
      { priceType: "pauschale", quantity: 1, unitPrice: 1000, timeEstimate: null },
      { priceType: "optional", quantity: 1, unitPrice: 200, timeEstimate: null },
      { priceType: "inkl", quantity: 1, unitPrice: 50, timeEstimate: null },
      { priceType: "per_hour", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 2, maxHours: 4, hourlyRate: 100 } },
    ];
    expect(computeItemsSubtotal(legacy, "min")).toBe(1200);
    expect(computeItemsSubtotal(legacy, "max")).toBe(1400);
  });

  it("rate item is NEVER summed (the CHF 0.00 root-cause fix)", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", quantity: 1, unitPrice: 800, timeEstimate: null },
      // rate: crew/hours indeterminate — unitPrice is the Stundenansatz, must not enter the sum
      { priceType: "per_hour", amountBasis: "rate", quantity: 1, unitPrice: 350, timeEstimate: null },
    ];
    expect(computeItemsSubtotal(items, "min")).toBe(800);
    expect(computeItemsSubtotal(items, "max")).toBe(800);
  });

  it("range item is summed as min/max even when explicitly flagged", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", quantity: 1, unitPrice: 800, timeEstimate: null },
      { priceType: "per_hour", amountBasis: "range", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 3, maxHours: 5, hourlyRate: 100 } },
    ];
    expect(computeItemsSubtotal(items, "min")).toBe(1100); // 800 + 3*100
    expect(computeItemsSubtotal(items, "max")).toBe(1300); // 800 + 5*100
  });

  it("explicit fixed with a timeEstimate uses quantity*unitPrice, not the range", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", amountBasis: "fixed", quantity: 2, unitPrice: 100, timeEstimate: { minHours: 3, maxHours: 5, hourlyRate: 100 } },
    ];
    expect(computeItemsSubtotal(items, "min")).toBe(200);
    expect(computeItemsSubtotal(items, "max")).toBe(200);
  });

  it("range flagged but no computable estimate → fixed fallback (matches display helper)", () => {
    const items: SubtotalItem[] = [
      { priceType: "per_hour", amountBasis: "range", quantity: 2, unitPrice: 150, timeEstimate: null },
    ];
    expect(computeItemsSubtotal(items, "min")).toBe(300);
  });

  it("SUMMARY RULE: Gesamtbetrag = fixed + range only (rate excluded)", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", amountBasis: "fixed", quantity: 1, unitPrice: 800, timeEstimate: null },
      { priceType: "per_hour", amountBasis: "rate", quantity: 1, unitPrice: 350, timeEstimate: null },
      { priceType: "per_hour", amountBasis: "range", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 3, maxHours: 5, hourlyRate: 90 } },
      { priceType: "optional", quantity: 1, unitPrice: 200, timeEstimate: null },
    ];
    expect(computeItemsSubtotal(items, "min")).toBe(1070); // 800 + 270 (rate & optional excluded)
    expect(computeItemsSubtotal(items, "max")).toBe(1250); // 800 + 450
  });
});

describe("computeItemsSubtotal — rate is ALWAYS excluded (Kostendach irrelevant)", () => {
  it("rate WITH cap is still excluded in both modes (no cap-based range)", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", quantity: 1, unitPrice: 800, timeEstimate: null },
      { priceType: "per_hour", amountBasis: "rate", quantity: 1, unitPrice: 350, timeEstimate: null },
    ];
    expect(computeItemsSubtotal(items, "min")).toBe(800);
    expect(computeItemsSubtotal(items, "max")).toBe(800); // cap never re-enters the sum
  });

  it("MIXED fixed + range + rate: rate never counts, range still min/max", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", amountBasis: "fixed", quantity: 1, unitPrice: 800, timeEstimate: null },
      { priceType: "per_hour", amountBasis: "range", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 3, maxHours: 5, hourlyRate: 90 } },
      { priceType: "per_hour", amountBasis: "rate", quantity: 1, unitPrice: 350, timeEstimate: null },
    ];
    expect(computeItemsSubtotal(items, "min")).toBe(1070); // 800 + 270
    expect(computeItemsSubtotal(items, "max")).toBe(1250); // 800 + 450 (rate excluded)
  });
});

describe("offerHasRateItem (aggregate-box hide decision — single source)", () => {
  it("no rate → false", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", quantity: 1, unitPrice: 800, timeEstimate: null },
      { priceType: "per_hour", amountBasis: "range", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 3, maxHours: 5, hourlyRate: 90 } },
    ];
    expect(offerHasRateItem(items)).toBe(false);
  });

  it("rate WITH cap → true (Kostendach irrelevant)", () => {
    const items: SubtotalItem[] = [
      { priceType: "per_hour", amountBasis: "rate", quantity: 1, unitPrice: 350, timeEstimate: null },
    ];
    expect(offerHasRateItem(items)).toBe(true);
  });

  it("rate WITHOUT cap → true", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", quantity: 1, unitPrice: 800, timeEstimate: null },
      { priceType: "per_hour", amountBasis: "rate", quantity: 1, unitPrice: 200, timeEstimate: null },
    ];
    expect(offerHasRateItem(items)).toBe(true);
  });

  it("free (optional/inkl) rate items are ignored", () => {
    const items: SubtotalItem[] = [
      { priceType: "optional", amountBasis: "rate", quantity: 1, unitPrice: 350, timeEstimate: null },
      { priceType: "inkl", quantity: 1, unitPrice: 50, timeEstimate: null },
    ];
    expect(offerHasRateItem(items)).toBe(false);
  });
});

describe("itemAmountDisplay", () => {
  const base = { quantity: 1, unitPrice: 0, timeEstimate: null } as const;

  it("free (inkl/optional) → kind 'free' with priceType", () => {
    expect(itemAmountDisplay({ ...base, priceType: "inkl" })).toEqual({ kind: "free", priceType: "inkl" });
    expect(itemAmountDisplay({ ...base, priceType: "optional" })).toEqual({ kind: "free", priceType: "optional" });
  });

  it("rate → unitPrice + trimmed unit (the '/ Std' / '/ m³' case)", () => {
    const item: AmountDisplayItem = { priceType: "per_hour", amountBasis: "rate", quantity: 1, unitPrice: 350, unit: " Std. ", timeEstimate: null };
    expect(itemAmountDisplay(item)).toEqual({ kind: "rate", unitPrice: 350, unit: "Std." });
  });

  it("range → min/max from timeEstimate", () => {
    const item: AmountDisplayItem = { priceType: "per_hour", amountBasis: "range", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 3, maxHours: 5, hourlyRate: 100 } };
    expect(itemAmountDisplay(item)).toEqual({ kind: "range", min: 300, max: 500 });
  });

  it("fixed → prefers stored total, falls back to quantity*unitPrice", () => {
    expect(itemAmountDisplay({ priceType: "pauschale", quantity: 1, unitPrice: 800, timeEstimate: null, total: 720 })).toEqual({ kind: "fixed", amount: 720 });
    expect(itemAmountDisplay({ priceType: "pauschale", quantity: 3, unitPrice: 50, timeEstimate: null })).toEqual({ kind: "fixed", amount: 150 });
  });

  it("legacy (no amountBasis) + valid timeEstimate → range; else fixed", () => {
    expect(itemAmountDisplay({ priceType: "per_hour", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 2, maxHours: 4, hourlyRate: 100 } })).toEqual({ kind: "range", min: 200, max: 400 });
    expect(itemAmountDisplay({ priceType: "per_unit", quantity: 4, unitPrice: 20, timeEstimate: null })).toEqual({ kind: "fixed", amount: 80 });
  });

  it("range flagged but no estimate → fixed fallback (consistent with subtotal)", () => {
    const item: AmountDisplayItem = { priceType: "per_hour", amountBasis: "range", quantity: 2, unitPrice: 150, timeEstimate: null };
    expect(itemAmountDisplay(item)).toEqual({ kind: "fixed", amount: 300 });
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
// ---------------------------------------------------------------------------
// Preistyp-Wechsel und abgeleitetes Preismodell (Gruppen-Preismodell)
// ---------------------------------------------------------------------------

describe("priceTypeShape", () => {
  it("Pauschale: feste Einheit, Menge auf 1 — sonst multipliziert der Pauschalpreis", () => {
    // Der Befund: Menge 3 blieb beim Wechsel stehen, das Feld war aber ausgeblendet.
    // 400.- Pauschale wurden in der Summe zu 1200.- ohne sichtbaren Grund.
    expect(priceTypeShape("pauschale", { unit: "Stk.", quantity: 3 })).toEqual({
      unit: "Pauschal",
      amountBasis: "fixed",
      quantity: 1,
      kostendachMax: null,
    });
  });

  it("Pro Stunde ohne Zeitschaetzung: 'rate' — identisch zum Katalog-Default", () => {
    // Genau die Abweichung, die zwei sichtbar gleiche Positionen verschieden rechnen liess.
    expect(priceTypeShape("per_hour", { unit: "Pauschal", quantity: 5 })).toEqual({
      unit: "Stunden",
      amountBasis: "rate",
      quantity: 1,
      kostendachMax: null,
    });
    expect(priceTypeShape("per_hour").amountBasis).toBe(
      defaultAmountBasisForPriceType("per_hour"),
    );
  });

  it("Pro Stunde MIT gueltiger Zeitschaetzung: 'range' — die Spanne bleibt erhalten", () => {
    expect(priceTypeShape("per_hour", { hasValidTimeEstimate: true }).amountBasis).toBe("range");
  });

  it("Pro Einheit: die gewaehlte Einheit und die Menge bleiben", () => {
    expect(priceTypeShape("per_unit", { unit: "m³", quantity: 12 })).toEqual({
      unit: "m³",
      amountBasis: "fixed",
      quantity: 12,
      kostendachMax: null,
    });
  });

  it("Pro Einheit nach Pauschale: die vorgegebene Einheit wird nicht mitgeschleppt", () => {
    // "Pauschal" als Einheit einer Stueckposition waere sichtbarer Unsinn.
    expect(priceTypeShape("per_unit", { unit: "Pauschal", quantity: 4 }).unit).toBe("Stk.");
    expect(priceTypeShape("per_unit", { unit: "Stunden" }).unit).toBe("Stk.");
  });

  it("Inklusive: keine Einheit, Menge 1", () => {
    expect(priceTypeShape("inkl", { unit: "m²", quantity: 9 })).toEqual({
      unit: "",
      amountBasis: "fixed",
      quantity: 1,
      kostendachMax: null,
    });
  });

  it("Optional: Einheit und Menge bleiben waehlbar", () => {
    expect(priceTypeShape("optional", { unit: "Person", quantity: 2 })).toEqual({
      unit: "Person",
      amountBasis: "fixed",
      quantity: 2,
      kostendachMax: null,
    });
  });

  it("rate → fixed loescht das Kostendach", () => {
    // F3: sonst druckt der Beleg eine Obergrenze fuer einen bestimmten Betrag.
    expect(priceTypeShape("pauschale", { kostendachMax: 5000 }).kostendachMax).toBeNull();
    expect(priceTypeShape("per_unit", { kostendachMax: 5000 }).kostendachMax).toBeNull();
  });

  it("rate → rate behaelt das Kostendach", () => {
    expect(priceTypeShape("per_hour", { kostendachMax: 5000 }).kostendachMax).toBe(5000);
  });

  it("range behaelt das Kostendach NICHT — der Betrag ist dort bestimmt", () => {
    expect(
      priceTypeShape("per_hour", { kostendachMax: 5000, hasValidTimeEstimate: true }).kostendachMax,
    ).toBeNull();
  });

  it("unbekannter Preistyp faellt auf freie Einheit und 'fixed'", () => {
    expect(priceTypeShape(null, { quantity: 2 })).toEqual({
      unit: "Stk.",
      amountBasis: "fixed",
      quantity: 1,
      kostendachMax: null,
    });
  });

  it("ungueltige Menge wird 1, nicht NaN", () => {
    expect(priceTypeShape("per_unit", { quantity: Number.NaN }).quantity).toBe(1);
    expect(priceTypeShape("per_unit", { quantity: 0 }).quantity).toBe(1);
    expect(priceTypeShape("per_unit", { quantity: -3 }).quantity).toBe(1);
  });
});

describe("derivePriceModel", () => {
  const pos = (over: Partial<PriceModelItem> = {}): PriceModelItem => ({
    priceType: "pauschale",
    quantity: 1,
    unitPrice: 400,
    timeEstimate: null,
    amountBasis: "fixed",
    ...over,
  });

  it("ohne rate-Position: pauschal", () => {
    expect(derivePriceModel([pos(), pos({ priceType: "per_unit", quantity: 3 })])).toEqual({
      model: "pauschal",
      hourlyRate: null,
      kostendachMax: null,
    });
  });

  it("mit rate-Position: stundenansatz samt Ansatz", () => {
    expect(
      derivePriceModel([pos(), pos({ priceType: "per_hour", amountBasis: "rate", unitPrice: 120 })]),
    ).toEqual({ model: "stundenansatz", hourlyRate: 120, kostendachMax: null });
  });

  it("Service-Details-Ansatz schlaegt den Einzelpreis", () => {
    // Der Beleg liest effort_meta.hourly_rate zuerst — die Ableitung muss dasselbe tun.
    expect(
      derivePriceModel([
        pos({ priceType: "per_hour", amountBasis: "rate", unitPrice: 120, metaRate: 135 }),
      ]).hourlyRate,
    ).toBe(135);
  });

  it("verschiedene Ansaetze: kein einzelner Satz", () => {
    // Ein Kaestchen mit einer von drei Zahlen waere schlimmer als keins.
    expect(
      derivePriceModel([
        pos({ priceType: "per_hour", amountBasis: "rate", unitPrice: 120 }),
        pos({ priceType: "per_hour", amountBasis: "rate", unitPrice: 85 }),
      ]),
    ).toEqual({ model: "stundenansatz", hourlyRate: null, kostendachMax: null });
  });

  it("mit Positions-Kostendach: kostendach, Deckel summiert", () => {
    expect(
      derivePriceModel([
        pos({ priceType: "per_hour", amountBasis: "rate", unitPrice: 120, kostendachMax: 5000 }),
        pos({ priceType: "per_hour", amountBasis: "rate", unitPrice: 120, kostendachMax: 1200 }),
      ]),
    ).toEqual({ model: "kostendach", hourlyRate: 120, kostendachMax: 6200 });
  });

  it("freie Positionen zaehlen nicht mit", () => {
    // inkl/optional sind Leistungsumfang, kein Preismodell.
    expect(
      derivePriceModel([
        pos(),
        pos({ priceType: "inkl", amountBasis: "rate" }),
        pos({ priceType: "optional", amountBasis: "rate" }),
      ]).model,
    ).toBe("pauschal");
  });

  it("range ist kein rate — eine Spanne hat einen bestimmten Betrag", () => {
    expect(
      derivePriceModel([
        pos({
          priceType: "per_hour",
          amountBasis: "range",
          timeEstimate: { minHours: 6, maxHours: 8, hourlyRate: 120 },
        }),
      ]).model,
    ).toBe("pauschal");
  });

  it("leere Offerte: pauschal", () => {
    expect(derivePriceModel([]).model).toBe("pauschal");
  });
});

// ---------------------------------------------------------------------------
// Regression an einem ECHTEN Produktionsbeleg: Offerte 10056 (Hirschenumzug).
//
// Ihr PDF ist der Referenzfall für eine Aufwand-Offerte: Zeile "CHF 260.– / Stunden",
// Kostendach-Kasten "Stundenansatz CHF 260.–/Std. — max. CHF 1'560 (6 Std.)", KEINE
// Gesamtbetrag-Box, stattdessen der Aufwand-Hinweis.
//
// Bemerkenswert: offers.price_model steht auf 'pauschal', hourly_rate und kostendach_max
// sind NULL. Das richtige Etikett entsteht also schon heute ausschliesslich aus den
// Positionen — genau die Beobachtung, auf der ADR_offerte_preismodell (Entscheidung A) fusst.
// ---------------------------------------------------------------------------

describe("Produktionsbeleg 10056 — F1 darf ihn nicht verändern", () => {
  const positionen: PriceModelItem[] = [
    {
      priceType: "per_hour",
      amountBasis: "rate",
      quantity: 1,
      unitPrice: 260,
      timeEstimate: null,
      kostendachMax: 1560,
    },
    { priceType: "inkl", amountBasis: "fixed", quantity: 1, unitPrice: 0, timeEstimate: null },
    { priceType: "inkl", amountBasis: "fixed", quantity: 1, unitPrice: 0, timeEstimate: null },
  ];

  it("die Aggregatsumme bleibt ausgeblendet", () => {
    expect(offerHasRateItem(positionen)).toBe(true);
  });

  it("die Positionssumme bleibt 0 — wie offers.subtotal in der Produktion", () => {
    expect(computeItemsSubtotal(positionen, "min")).toBe(0);
  });

  it("das abgeleitete Etikett trifft, was das PDF zeigt", () => {
    expect(derivePriceModel(positionen)).toEqual({
      model: "kostendach",
      hourlyRate: 260,
      kostendachMax: 1560,
    });
  });

  it("die Zeile zeigt weiterhin den Ansatz, keinen bestimmten Betrag", () => {
    expect(itemAmountDisplay({ ...positionen[0], unit: "Stunden" })).toEqual({
      kind: "rate",
      unitPrice: 260,
      unit: "Stunden",
    });
  });

  it("denselben Preistyp erneut zu wählen zerstört das Kostendach NICHT", () => {
    // Der neue Preistyp-Wähler in OfferteBearbeiten darf einen Bestandsbeleg beim
    // blossen Öffnen/Anfassen nicht entwerten.
    expect(priceTypeShape("per_hour", { unit: "Stunden", quantity: 1, kostendachMax: 1560 })).toEqual({
      unit: "Stunden",
      amountBasis: "rate",
      quantity: 1,
      kostendachMax: 1560,
    });
  });
});

describe("istStundenEinheit — die Menge hinter dem Kostendach traegt die Einheit der Position", () => {
  it.each(["Stunden", "Stunde", "Std.", "Std", "h", "STUNDEN", " stunden "])("erkennt %s als Zeit", (u) => {
    expect(istStundenEinheit(u)).toBe(true);
  });

  it.each(["m³", "Monat", "Stk.", "Pauschal", "km", "", null, undefined])("erkennt %s NICHT als Zeit", (u) => {
    expect(istStundenEinheit(u)).toBe(false);
  });

  it("trennt m³-Ansatz von Stundenansatz: 1200 / 60 sind 20 m³, keine 20 Std", () => {
    // Die Rechnung war immer einheitenneutral — nur die Beschriftung war fest verdrahtet.
    expect(istStundenEinheit("m³")).toBe(false);
    expect(1200 / 60).toBe(20);
  });
});

describe("rateUnitForService — die Frage passt sich dem Service an", () => {
  it("Zeit-Services rechnen in Stunden", () => {
    for (const s of ["umzug", "transport", "moebellift", "reinigung", null, "sonstiges"]) {
      expect(rateUnitForService(s)).toBe("Stunden");
    }
  });

  it("Entsorgung und Raeumung rechnen in m³", () => {
    expect(rateUnitForService("entsorgung")).toBe("m³");
    expect(rateUnitForService("raeumung")).toBe("m³");
    expect(rateUnitForService("räumung")).toBe("m³");
  });

  it("Lagerung rechnet pro Monat", () => {
    expect(rateUnitForService("lagerung")).toBe("Monat");
  });

  it("die Einheit bestimmt den Preistyp", () => {
    expect(priceTypeForRateUnit("Stunden")).toBe("per_hour");
    expect(priceTypeForRateUnit("m³")).toBe("per_unit");
    expect(priceTypeForRateUnit("Monat")).toBe("per_unit");
  });
});

describe("priceTypeShape — per_unit als offener Ansatz (m³ / Monat)", () => {
  it("setzt 'rate' und behaelt die Service-Einheit", () => {
    expect(priceTypeShape("per_unit", { unit: "m³", quantity: 20, alsAnsatz: true })).toEqual({
      unit: "m³",
      amountBasis: "rate",
      quantity: 1,
      kostendachMax: null,
    });
  });

  it("behaelt das Kostendach, weil der Betrag offen ist", () => {
    expect(
      priceTypeShape("per_unit", { unit: "m³", kostendachMax: 1200, alsAnsatz: true })
        .kostendachMax,
    ).toBe(1200);
  });

  it("ohne alsAnsatz bleibt per_unit ein fester Betrag mit Menge", () => {
    // Regression: die normale Stueckposition darf sich nicht mitaendern.
    expect(priceTypeShape("per_unit", { unit: "m³", quantity: 20 })).toEqual({
      unit: "m³",
      amountBasis: "fixed",
      quantity: 20,
      kostendachMax: null,
    });
  });

  it("eine m³-Ansatzposition zaehlt NICHT zur Summe und traegt das Etikett", () => {
    const pos: PriceModelItem[] = [
      {
        priceType: "per_unit",
        amountBasis: "rate",
        quantity: 1,
        unitPrice: 60,
        timeEstimate: null,
        kostendachMax: 1200,
      },
    ];
    expect(computeItemsSubtotal(pos, "min")).toBe(0);
    expect(offerHasRateItem(pos)).toBe(true);
    expect(derivePriceModel(pos)).toEqual({
      model: "kostendach",
      hourlyRate: 60,
      kostendachMax: 1200,
    });
  });
});
