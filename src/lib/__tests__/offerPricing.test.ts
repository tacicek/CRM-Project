import { describe, it, expect } from "vitest";
import {
  hourlyRange,
  isFreeItem,
  computeItemsSubtotal,
  computeTotalsFromSubtotal,
  type SubtotalItem,
  BLIND_DISCLAIMER_LABEL,
  BLIND_DISCLAIMER_TEXT,
} from "@/lib/offerPricing";

describe("hourlyRange", () => {
  it("normal: min*rate ve max*rate döndürür", () => {
    expect(hourlyRange({ minHours: 2, maxHours: 4, hourlyRate: 100 })).toEqual({
      min: 200,
      max: 400,
    });
  });

  it("null/undefined → null", () => {
    expect(hourlyRange(null)).toBeNull();
    expect(hourlyRange(undefined)).toBeNull();
  });

  it("minHours=0 veya hourlyRate=0 → null (ServiceTable guard'ıyla birebir)", () => {
    expect(hourlyRange({ minHours: 0, maxHours: 4, hourlyRate: 100 })).toBeNull();
    expect(hourlyRange({ minHours: 2, maxHours: 4, hourlyRate: 0 })).toBeNull();
  });

  it("defensive: yanlış şekil / yanlış tip → null (patlamadan)", () => {
    // as cast tuzağı: DB jsonb beklenmedik şekil taşıyabilir
    expect(hourlyRange({ min: 2, max: 4 } as unknown as Parameters<typeof hourlyRange>[0])).toBeNull();
    expect(
      hourlyRange({ minHours: "2", maxHours: "4", hourlyRate: "100" } as unknown as Parameters<typeof hourlyRange>[0]),
    ).toBeNull();
    expect(hourlyRange({} as unknown as Parameters<typeof hourlyRange>[0])).toBeNull();
  });
});

describe("isFreeItem", () => {
  it("ücretsiz (çip) tipleri → true", () => {
    expect(isFreeItem("inkl")).toBe(true);
    expect(isFreeItem("optional")).toBe(true);
  });

  it("ücretli (kutu) tipleri → false", () => {
    expect(isFreeItem("pauschale")).toBe(false);
    expect(isFreeItem("per_unit")).toBe(false);
    expect(isFreeItem("per_hour")).toBe(false);
  });

  it("null/undefined/boş → false (defensive)", () => {
    expect(isFreeItem(null)).toBe(false);
    expect(isFreeItem(undefined)).toBe(false);
    expect(isFreeItem("")).toBe(false);
  });
});

describe("computeItemsSubtotal", () => {
  // Karışık fixture: pauschale + fiyatlı optional + inkl + blind
  const mixed: SubtotalItem[] = [
    { priceType: "pauschale", quantity: 1, unitPrice: 1000, timeEstimate: null },
    { priceType: "optional", quantity: 1, unitPrice: 200, timeEstimate: null },
    { priceType: "inkl", quantity: 1, unitPrice: 50, timeEstimate: null },
    { priceType: "pauschale", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 2, maxHours: 4, hourlyRate: 100 } },
  ];

  it("min: optional+inkl hariç, blind alt sınır (1000 + 2*100) = 1200", () => {
    expect(computeItemsSubtotal(mixed, "min")).toBe(1200);
  });

  it("max: blind üst sınır (1000 + 4*100) = 1400", () => {
    expect(computeItemsSubtotal(mixed, "max")).toBe(1400);
  });

  it("REGRESYON: fiyatlı optional subtotal'a GİRMEZ (1200, 1400 değil)", () => {
    // optional CHF 200 dahil olsaydı min=1400 olurdu — olmamalı
    expect(computeItemsSubtotal(mixed, "min")).not.toBe(1400);
    expect(computeItemsSubtotal(mixed, "min")).toBe(1200);
  });

  it("CREATE == EDIT: iki form-şekli aynı SubtotalItem'a map → aynı sayı (optional hariç)", () => {
    // create-form item (priceType camelCase) — fiyatlı optional, eski edit bug'ının tetikleyicisi
    const createForm = [
      { priceType: "pauschale", quantity: 1, unit_price: 1000, timeEstimate: null },
      { priceType: "optional", quantity: 1, unit_price: 200, timeEstimate: null },
    ];
    // edit-form item (price_type snake) — aynı içerik
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
    // Eski bug'da edit 1200 (optional dahil), create 1000 → diverge. Artık ikisi de 1000.
    expect(computeItemsSubtotal(fromCreate, "min")).toBe(computeItemsSubtotal(fromEdit, "min"));
    expect(computeItemsSubtotal(fromEdit, "min")).toBe(1000); // optional CHF 200 HARİÇ
  });

  it("DB aynalama: subtotal 1200 → total = 1200*(1+8.1/100) = 1297.20 cent", () => {
    const subtotal = computeItemsSubtotal(mixed, "min"); // 1200
    const vatRate = 8.1;
    const total = subtotal + (subtotal * vatRate) / 100; // DB generated formülü
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

  it("sabit surcharge 100, VAT 8.1: taxableBase 1100, total 1189.1", () => {
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

  it("BLIND RANGE — optional HER İKİ tarafta hariç + total aralığı", () => {
    const items: SubtotalItem[] = [
      { priceType: "pauschale", quantity: 1, unitPrice: 1000, timeEstimate: null },
      { priceType: "optional", quantity: 1, unitPrice: 300, timeEstimate: null },
      { priceType: "pauschale", quantity: 1, unitPrice: 0, timeEstimate: { minHours: 2, maxHours: 4, hourlyRate: 100 } },
    ];
    const minItems = computeItemsSubtotal(items, "min"); // 1000 + 200 = 1200 (optional hariç)
    const maxItems = computeItemsSubtotal(items, "max"); // 1000 + 400 = 1400 (optional hariç)
    expect(minItems).toBe(1200);
    expect(maxItems).toBe(1400);
    // VAT 0, surcharge 0 → total aralığı 1200 – 1400
    expect(computeTotalsFromSubtotal(minItems, 0, 0).total).toBe(1200);
    expect(computeTotalsFromSubtotal(maxItems, 0, 0).total).toBe(1400);
  });
});

describe("blind disclaimer sabitleri", () => {
  it("metin sabitleri tanımlı ve dolu", () => {
    expect(BLIND_DISCLAIMER_LABEL).toBe("Wichtiger Hinweis");
    expect(BLIND_DISCLAIMER_TEXT).toContain("ohne persönliche Besichtigung");
  });
});
