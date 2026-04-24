/**
 * Simplified pricing: base_token_cost × size_multiplier, clamped to min/max.
 *
 * Data sources:
 *   - service_catalog.base_token_cost  → per-service base price
 *   - pricing_settings.size_multipliers → room-based multiplier (editable by admin)
 *   - pricing_settings.min/max         → clamp range
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Lead, PricingSettings } from "./types.ts";

type SupabaseClient = ReturnType<typeof createClient>;

const DEFAULT_SIZE_MULTIPLIERS: Record<string, number> = {
  "1-2": 1.0,
  "3": 1.2,
  "4-5": 1.4,
  "6+": 1.6,
};

const DEFAULT_OFFERTEN_MULTIPLIERS: Record<string, number> = {
  "3": 1.3,
  "4": 1.15,
  "5": 1.0,
};

/**
 * Look up the size multiplier for a given room count.
 */
export function getSizeMultiplier(
  multipliers: Record<string, number>,
  rooms: number | undefined | null,
): number {
  if (!rooms || rooms <= 0) return 1.0;

  for (const [key, mult] of Object.entries(multipliers)) {
    if (key.includes("+")) {
      const min = parseInt(key.replace("+", ""));
      if (rooms >= min) return mult;
    } else if (key.includes("-")) {
      const [min, max] = key.split("-").map(Number);
      if (rooms >= min && rooms <= max) return mult;
    } else {
      if (rooms === parseFloat(key) || (rooms > parseFloat(key) - 0.5 && rooms < parseFloat(key) + 0.5)) return mult;
    }
  }
  return 1.0;
}

/**
 * Calculate urgency level based on preferred date.
 */
export function calculateUrgency(preferredDate?: string): "very_urgent" | "urgent" | "normal" {
  if (!preferredDate) return "normal";

  const preferred = new Date(preferredDate);
  const today = new Date();
  const diffDays = Math.ceil((preferred.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 3) return "very_urgent";
  if (diffDays <= 7) return "urgent";

  return "normal";
}

/**
 * Calculate distance between two PLZ codes via DB RPC.
 */
export async function calculateDistance(
  supabase: SupabaseClient,
  fromPlz: string,
  toPlz?: string,
): Promise<number | null> {
  if (!toPlz) return null;

  const { data, error } = await supabase.rpc("get_plz_distance_km", {
    plz1: fromPlz,
    plz2: toPlz,
  });

  if (error) {
    console.error("[pricing] Error calculating distance", error);
    return null;
  }

  return data as number | null;
}

/**
 * Resolve the base_token_cost from service_catalog for a given service_type.
 * Tries exact match first, then prefix-based fallback.
 */
async function resolveBaseTokenCost(
  supabase: SupabaseClient,
  serviceType: string,
  log: (step: string, details?: unknown) => void,
): Promise<number> {
  // Exact match
  const { data: exact } = await supabase
    .from("service_catalog")
    .select("base_token_cost")
    .eq("service_type", serviceType)
    .eq("is_active", true)
    .maybeSingle();

  if (exact?.base_token_cost) {
    log("Found exact base_token_cost", { serviceType, cost: exact.base_token_cost });
    return Number(exact.base_token_cost);
  }

  // Prefix fallback: "umzug_privat" → try "umzug_", then category
  const prefix = serviceType.split("_")[0];
  if (prefix !== serviceType) {
    const { data: prefixMatch } = await supabase
      .from("service_catalog")
      .select("base_token_cost")
      .ilike("service_type", `${prefix}%`)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (prefixMatch?.base_token_cost) {
      log("Found prefix-based base_token_cost", { prefix, cost: prefixMatch.base_token_cost });
      return Number(prefixMatch.base_token_cost);
    }
  }

  log("No catalog match, using default 15", { serviceType });
  return 15;
}

/**
 * Calculate dynamic price for a lead.
 *
 * Formula: base_token_cost × size_multiplier × offerten_multiplier
 * Clamped to min/max token limits from pricing_settings.
 */
export async function calculateLeadPrice(
  supabase: SupabaseClient,
  lead: Lead,
  logStep?: (step: string, details?: unknown) => void,
): Promise<number> {
  const log = logStep || ((step: string, _details?: unknown) => {
    console.log(`[pricing] ${step}`);
  });

  log("Calculating price", {
    service_type: lead.service_type,
    rooms: lead.from_rooms,
    space: lead.from_living_space_m2,
    max_companies: lead.max_companies,
  });

  // 1. Load pricing_settings
  const { data: settings } = await supabase
    .from("pricing_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const pricingSettings: PricingSettings = {
    token_value_chf: settings?.token_value_chf || 1.0,
    min_lead_price_tokens: settings?.min_lead_price_tokens || 10,
    max_lead_price_tokens: settings?.max_lead_price_tokens || 200,
    size_multipliers: settings?.size_multipliers || DEFAULT_SIZE_MULTIPLIERS,
    offerten_multipliers: settings?.offerten_multipliers || DEFAULT_OFFERTEN_MULTIPLIERS,
  };

  // 2. Resolve base token cost from service_catalog
  const baseCost = await resolveBaseTokenCost(supabase, lead.service_type, log);

  // 3. Determine size multiplier from rooms (or m² fallback)
  let effectiveRooms = lead.from_rooms;
  if (!effectiveRooms && lead.from_living_space_m2) {
    if (lead.from_living_space_m2 >= 150) effectiveRooms = 6;
    else if (lead.from_living_space_m2 >= 100) effectiveRooms = 4;
    else if (lead.from_living_space_m2 >= 60) effectiveRooms = 3;
    else effectiveRooms = 2;
  }

  const sizeMult = getSizeMultiplier(pricingSettings.size_multipliers, effectiveRooms);
  log("Size multiplier", { effectiveRooms, sizeMult });

  // 4. Offerten multiplier (fewer companies = higher price)
  const maxCo = lead.max_companies || 5;
  const offertenMult = pricingSettings.offerten_multipliers[String(maxCo)] ?? 1.0;
  log("Offerten multiplier", { max_companies: maxCo, offertenMult });

  // 5. Calculate
  const rawPrice = baseCost * sizeMult * offertenMult;
  let finalPrice = Math.round(rawPrice);
  finalPrice = Math.max(finalPrice, pricingSettings.min_lead_price_tokens);
  finalPrice = Math.min(finalPrice, pricingSettings.max_lead_price_tokens);

  log("Final price", {
    formula: `${baseCost} × ${sizeMult} × ${offertenMult} = ${rawPrice} → ${finalPrice}`,
    baseCost,
    sizeMult,
    offertenMult,
    finalPrice,
  });

  return finalPrice;
}
