/**
 * Type-safe, fail-closed serialization of a `PricingConfig` into a Supabase `Json`
 * value for `upsert_company_pricing_config`.
 *
 * Why this exists: the old `mapConfigToDb` returned `Record<string, unknown>`, which the
 * generated `Json` type rejects (unknown values). The runtime object was already valid
 * JSON, but the boundary was untyped. This maps every field explicitly (same field set
 * and same values as before — no rounding, no conversion) and, as a guard, refuses to
 * produce a payload containing a non-finite number (NaN/Infinity) so such a config can
 * never be persisted. No cast, no JSON.stringify/parse, no mutation.
 */

import type { Json } from "@/integrations/supabase/types";
import type { PricingConfig, TeamRate } from "./types";

export type PricingJsonResult =
  | { ok: true; value: Json }
  | { ok: false; reason: "invalid_number" };

/** Rebuild a `{ [key]: number }` group as JSON, rejecting any non-finite value. */
const numbersToJson = (entries: [string, number][]): { [key: string]: number } | null => {
  const out: { [key: string]: number } = {};
  for (const [key, value] of entries) {
    if (!Number.isFinite(value)) return null;
    out[key] = value;
  }
  return out;
};

const teamRatesToJson = (rates: TeamRate[]): Json[] | null => {
  const out: Json[] = [];
  for (const r of rates) {
    if (!Number.isFinite(r.trucks) || !Number.isFinite(r.workers) || !Number.isFinite(r.hourlyRate)) {
      return null;
    }
    out.push({ trucks: r.trucks, workers: r.workers, hourlyRate: r.hourlyRate, label: r.label });
  }
  return out;
};

export const serializePricingConfig = (config: PricingConfig): PricingJsonResult => {
  const scalars = [
    config.vatRate,
    config.minimumHours,
    config.minimumCharge,
    config.hourlyRate,
    config.distanceSurchargeRate,
    config.distanceSurchargeThreshold,
    config.packingServiceRate,
    config.externalLiftCost,
    config.disposalCost,
    config.pianoTransportCost,
    config.storageCostPerM3,
  ];
  if (scalars.some((n) => !Number.isFinite(n))) return { ok: false, reason: "invalid_number" };

  const teamRates = teamRatesToJson(config.teamRates);
  const vehiclePrices = numbersToJson(Object.entries(config.vehiclePrices));
  const surcharges = numbersToJson(Object.entries(config.surcharges));
  const floorSurcharges = numbersToJson(Object.entries(config.floorSurcharges));
  const equipment = numbersToJson(Object.entries(config.equipment));
  const multipliers = numbersToJson(Object.entries(config.multipliers));
  if (!teamRates || !vehiclePrices || !surcharges || !floorSurcharges || !equipment || !multipliers) {
    return { ok: false, reason: "invalid_number" };
  }

  // Same field set and order as the previous mapConfigToDb — values unchanged.
  const value: Json = {
    currency: config.currency,
    vatRate: config.vatRate,
    minimumHours: config.minimumHours,
    minimumCharge: config.minimumCharge,
    teamRates,
    hourlyRate: config.hourlyRate,
    vehiclePrices,
    distanceSurchargeRate: config.distanceSurchargeRate,
    distanceSurchargeThreshold: config.distanceSurchargeThreshold,
    surcharges,
    floorSurcharges,
    equipment,
    packingServiceRate: config.packingServiceRate,
    externalLiftCost: config.externalLiftCost,
    disposalCost: config.disposalCost,
    pianoTransportCost: config.pianoTransportCost,
    storageCostPerM3: config.storageCostPerM3,
    multipliers,
  };
  return { ok: true, value };
};
