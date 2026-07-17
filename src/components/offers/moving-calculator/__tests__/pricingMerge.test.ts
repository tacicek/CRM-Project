import { describe, it, expect } from "vitest";
import { mergePricingConfig, type PricingConfigPatch } from "@/components/offers/moving-calculator/pricingMerge";
import { DEFAULT_PRICING_CONFIG } from "@/components/offers/moving-calculator/inventory-data";
import type { PricingConfig } from "@/components/offers/moving-calculator/types";

// A distinct base so we can tell "preserved from current" apart from "DEFAULT filled".
const base = (): PricingConfig => ({
  ...structuredClone(DEFAULT_PRICING_CONFIG),
  surcharges: { heavyItemOver100kg: 80, pianoUpright: 100, pianoGrand: 250, safeSmall: 40, safeLarge: 90, aquarium: 60, poolTable: 70 },
  floorSurcharges: { perFloorWithoutElevator: 30, perFloorWithElevator: 10, groundFloorBase: 5 },
  equipment: { moebelliftSingleLocation: 200, moebelliftBothLocations: 350, packingMaterialPerM3: 15 },
  multipliers: { weekend: 1.2, evening: 1.1, holiday: 1.5, express: 1.3 },
  vatRate: 8.1,
  minimumCharge: 480,
});

describe("mergePricingConfig — pure patch merge (mirrors the writer)", () => {
  it("single surcharge patch preserves all sibling surcharges", () => {
    const out = mergePricingConfig(base(), { surcharges: { pianoUpright: 120 } });
    expect(out.surcharges.pianoUpright).toBe(120);
    expect(out.surcharges.pianoGrand).toBe(250);
    expect(out.surcharges.heavyItemOver100kg).toBe(80);
    expect(out.surcharges.poolTable).toBe(70);
  });

  it("two sequential surcharge patches both survive (rapid functional-update parity)", () => {
    const step1 = mergePricingConfig(base(), { surcharges: { pianoUpright: 120 } });
    const step2 = mergePricingConfig(step1, { surcharges: { pianoGrand: 300 } });
    expect(step2.surcharges.pianoUpright).toBe(120);
    expect(step2.surcharges.pianoGrand).toBe(300);
    expect(step2.surcharges.safeSmall).toBe(40);
  });

  it("floor / equipment / multiplier / vehicle patches each preserve siblings", () => {
    expect(mergePricingConfig(base(), { floorSurcharges: { perFloorWithoutElevator: 40 } }).floorSurcharges)
      .toMatchObject({ perFloorWithoutElevator: 40, perFloorWithElevator: 10, groundFloorBase: 5 });
    expect(mergePricingConfig(base(), { equipment: { moebelliftSingleLocation: 210 } }).equipment)
      .toMatchObject({ moebelliftSingleLocation: 210, moebelliftBothLocations: 350, packingMaterialPerM3: 15 });
    expect(mergePricingConfig(base(), { multipliers: { weekend: 1.25 } }).multipliers)
      .toMatchObject({ weekend: 1.25, evening: 1.1, holiday: 1.5, express: 1.3 });
    const b = base();
    const firstVehicleKey = Object.keys(b.vehiclePrices)[0];
    const out = mergePricingConfig(b, { vehiclePrices: { [firstVehicleKey]: 999 } });
    expect(out.vehiclePrices[firstVehicleKey as keyof typeof out.vehiclePrices]).toBe(999);
  });

  it("scalar fields are replaced directly", () => {
    expect(mergePricingConfig(base(), { vatRate: 7.7 }).vatRate).toBe(7.7);
    expect(mergePricingConfig(base(), { minimumCharge: 500 }).minimumCharge).toBe(500);
  });

  it("undefined patch fields leave the current value untouched", () => {
    const out = mergePricingConfig(base(), { vatRate: undefined, surcharges: undefined });
    expect(out.vatRate).toBe(8.1);
    expect(out.surcharges.pianoUpright).toBe(100);
  });

  it("teamRates is a full array replacement", () => {
    const rates = [{ trucks: 2, workers: 3, hourlyRate: 220, label: "2+3" }];
    expect(mergePricingConfig(base(), { teamRates: rates }).teamRates).toEqual(rates);
  });

  it("empty patch returns an equivalent config", () => {
    const b = base();
    expect(mergePricingConfig(b, {})).toEqual(b);
  });

  it("does not mutate current or patch, and returns fresh nested references", () => {
    const current = base();
    const currentSnapshot = structuredClone(current);
    const patch: PricingConfigPatch = { surcharges: { pianoUpright: 120 } };
    const patchSnapshot = structuredClone(patch);
    const out = mergePricingConfig(current, patch);
    expect(current).toEqual(currentSnapshot); // current untouched
    expect(patch).toEqual(patchSnapshot); // patch untouched
    expect(out.surcharges).not.toBe(current.surcharges); // new reference for the patched group
  });

  it("precedence is DEFAULT → current → patch (patch wins, current beats default)", () => {
    const out = mergePricingConfig(base(), { surcharges: { pianoUpright: 130 } });
    expect(out.surcharges.pianoUpright).toBe(130); // patch wins
    expect(out.surcharges.pianoGrand).toBe(250); // current (250) beats DEFAULT
  });
});
