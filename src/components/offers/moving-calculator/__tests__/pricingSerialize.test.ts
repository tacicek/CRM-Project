import { describe, it, expect } from "vitest";
import { serializePricingConfig } from "@/components/offers/moving-calculator/pricingSerialize";
import { DEFAULT_PRICING_CONFIG } from "@/components/offers/moving-calculator/inventory-data";
import type { PricingConfig } from "@/components/offers/moving-calculator/types";

const base = (): PricingConfig => structuredClone(DEFAULT_PRICING_CONFIG);

describe("serializePricingConfig — fail-closed JSON payload", () => {
  it("serializes a valid config without changing any financial value", () => {
    const config = base();
    const res = serializePricingConfig(config);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const v = res.value as Record<string, unknown>;
      expect(v.vatRate).toBe(config.vatRate);
      expect(v.minimumCharge).toBe(config.minimumCharge);
      expect(v.currency).toBe(config.currency);
      // nested groups preserved key-for-key
      expect(v.surcharges).toEqual({ ...config.surcharges });
      expect(v.multipliers).toEqual({ ...config.multipliers });
      // teamRates preserved value-for-value
      expect(v.teamRates).toEqual(
        config.teamRates.map((r) => ({ trucks: r.trucks, workers: r.workers, hourlyRate: r.hourlyRate, label: r.label })),
      );
    }
  });

  it("rejects a NaN scalar (never persists a non-finite number)", () => {
    const config = base();
    config.vatRate = NaN;
    expect(serializePricingConfig(config)).toEqual({ ok: false, reason: "invalid_number" });
  });

  it("rejects an Infinity inside a nested group", () => {
    const config = base();
    config.surcharges = { ...config.surcharges, pianoUpright: Infinity };
    expect(serializePricingConfig(config)).toEqual({ ok: false, reason: "invalid_number" });
  });

  it("rejects a non-finite team-rate value", () => {
    const config = base();
    config.teamRates = [{ ...config.teamRates[0], hourlyRate: NaN }];
    expect(serializePricingConfig(config)).toEqual({ ok: false, reason: "invalid_number" });
  });

  it("does not mutate the input config", () => {
    const config = base();
    const snapshot = structuredClone(config);
    serializePricingConfig(config);
    expect(config).toEqual(snapshot);
  });

  it("round-trips every scalar field unchanged", () => {
    const config = base();
    const res = serializePricingConfig(config);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const v = res.value as Record<string, number>;
      for (const key of ["hourlyRate", "packingServiceRate", "disposalCost", "storageCostPerM3"] as const) {
        expect(v[key]).toBe(config[key]);
      }
    }
  });
});
