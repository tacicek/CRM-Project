/**
 * Pure contract for pricing-config patches.
 *
 * `PricingConfig` stays the full persisted/domain type. `PricingConfigPatch` is the
 * SEPARATE update contract: it expresses exactly the operations the existing runtime
 * writer (`useCompanyPricing.updateConfig`) supports — no more:
 *   - scalars: direct replacement
 *   - teamRates: FULL array replacement (single-rate edits go through updateTeamRate)
 *   - the five nested groups: single-key patch, deep-merged with siblings preserved
 *
 * This replaces the old `Partial<PricingConfig>` signature, which forced callers to
 * pass a *full* `Surcharges`/`FloorSurcharges`/… object for a one-field change (TS2739/
 * TS2740) even though the writer only ever needed a partial. It is deliberately
 * explicit (not a global recursive DeepPartial) so it can never claim an operation the
 * writer doesn't actually perform.
 *
 * `mergePricingConfig` is the extracted, framework-free version of the writer's merge —
 * byte-for-byte the same precedence (DEFAULT → current → patch) and the same allowlist
 * of deep-merged groups — so it can be unit-tested without React and reused by the hook.
 */

import type {
  PricingConfig,
  Surcharges,
  FloorSurcharges,
  EquipmentCosts,
  TimeMultipliers,
  TeamRate,
} from "./types";
import { DEFAULT_PRICING_CONFIG } from "./inventory-data";

export type PricingConfigPatch = {
  currency?: PricingConfig["currency"];
  vatRate?: number;
  minimumHours?: number;
  minimumCharge?: number;
  /** Full array replacement — single-rate edits use updateTeamRate. */
  teamRates?: TeamRate[];
  hourlyRate?: number;
  distanceSurchargeRate?: number;
  distanceSurchargeThreshold?: number;
  packingServiceRate?: number;
  externalLiftCost?: number;
  disposalCost?: number;
  pianoTransportCost?: number;
  storageCostPerM3?: number;
  /** Nested groups: single-key patch, deep-merged (siblings preserved). */
  vehiclePrices?: Partial<PricingConfig["vehiclePrices"]>;
  surcharges?: Partial<Surcharges>;
  floorSurcharges?: Partial<FloorSurcharges>;
  equipment?: Partial<EquipmentCosts>;
  multipliers?: Partial<TimeMultipliers>;
};

/**
 * Apply a patch to a config. Pure: never mutates `current` or `patch`; `undefined`
 * patch fields leave the current value untouched. Deep-merged groups follow the exact
 * DEFAULT → current → patch precedence of the original writer, so a single-key patch
 * preserves every sibling field.
 */
export const mergePricingConfig = (
  current: PricingConfig,
  patch: PricingConfigPatch,
): PricingConfig => {
  const next: PricingConfig = { ...current };

  // Scalars & full-array replacement (undefined = no change).
  if (patch.currency !== undefined) next.currency = patch.currency;
  if (patch.vatRate !== undefined) next.vatRate = patch.vatRate;
  if (patch.minimumHours !== undefined) next.minimumHours = patch.minimumHours;
  if (patch.minimumCharge !== undefined) next.minimumCharge = patch.minimumCharge;
  if (patch.teamRates !== undefined) next.teamRates = patch.teamRates;
  if (patch.hourlyRate !== undefined) next.hourlyRate = patch.hourlyRate;
  if (patch.distanceSurchargeRate !== undefined) next.distanceSurchargeRate = patch.distanceSurchargeRate;
  if (patch.distanceSurchargeThreshold !== undefined) next.distanceSurchargeThreshold = patch.distanceSurchargeThreshold;
  if (patch.packingServiceRate !== undefined) next.packingServiceRate = patch.packingServiceRate;
  if (patch.externalLiftCost !== undefined) next.externalLiftCost = patch.externalLiftCost;
  if (patch.disposalCost !== undefined) next.disposalCost = patch.disposalCost;
  if (patch.pianoTransportCost !== undefined) next.pianoTransportCost = patch.pianoTransportCost;
  if (patch.storageCostPerM3 !== undefined) next.storageCostPerM3 = patch.storageCostPerM3;

  // Nested groups: DEFAULT → current → patch (siblings preserved). Same allowlist as the writer.
  if (patch.vehiclePrices !== undefined)
    next.vehiclePrices = { ...DEFAULT_PRICING_CONFIG.vehiclePrices, ...current.vehiclePrices, ...patch.vehiclePrices };
  if (patch.surcharges !== undefined)
    next.surcharges = { ...DEFAULT_PRICING_CONFIG.surcharges, ...current.surcharges, ...patch.surcharges };
  if (patch.floorSurcharges !== undefined)
    next.floorSurcharges = { ...DEFAULT_PRICING_CONFIG.floorSurcharges, ...current.floorSurcharges, ...patch.floorSurcharges };
  if (patch.equipment !== undefined)
    next.equipment = { ...DEFAULT_PRICING_CONFIG.equipment, ...current.equipment, ...patch.equipment };
  if (patch.multipliers !== undefined)
    next.multipliers = { ...DEFAULT_PRICING_CONFIG.multipliers, ...current.multipliers, ...patch.multipliers };

  return next;
};
