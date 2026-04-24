import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod Schema für Input-Validierung
const LeadDataSchema = z.object({
  service_type: z.string().min(1, "Service-Typ erforderlich").max(50),
  from_plz: z.string().regex(/^\d{4}$/, "PLZ muss 4 Ziffern haben"),
  to_plz: z.string().regex(/^\d{4}$/, "PLZ muss 4 Ziffern haben").optional(),
  from_rooms: z.number().int().min(1).max(20).optional(),
  from_living_space_m2: z.number().min(1).max(2000).optional(),
  preferred_date: z.string().optional(),
  packing_service_needed: z.boolean().optional(),
  cleaning_service_needed: z.boolean().optional(),
  storage_needed: z.boolean().optional(),
});

type LeadData = z.infer<typeof LeadDataSchema>;

interface PricingRule {
  base_price: number;
  service_multipliers: Record<string, number>;
  urgency_multipliers: Record<string, number>;
  room_tiers: Record<string, number>;
  distance_tiers: Record<string, number>;
  extra_services: Record<string, number>;
  living_space_tiers: Record<string, number>;
}

interface PricingSettings {
  token_value_chf: number;
  min_lead_price_tokens: number;
  max_lead_price_tokens: number;
}

interface PriceBreakdown {
  base_price: number;
  service_multiplier?: number;
  room_multiplier?: number;
  rooms?: number;
  space_multiplier?: number;
  living_space_m2?: number;
  distance_km?: number;
  distance_multiplier?: number;
  urgency?: string;
  urgency_multiplier?: number;
  packing_extra?: number;
  cleaning_extra?: number;
  storage_extra?: number;
  extra_services_total?: number;
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[calculate-lead-price] ${step}${detailsStr}`);
};

// Calculate distance between two PLZs using direct query
// deno-lint-ignore no-explicit-any
const calculateDistance = async (
  supabase: any,
  fromPlz: string,
  toPlz?: string
): Promise<number | null> => {
  if (!toPlz) return null;
  
  const { data, error } = await supabase
    .rpc("get_plz_distance_km", { plz1: fromPlz, plz2: toPlz });
  
  if (error) {
    logStep("Error calculating distance", error);
    return null;
  }
  
  return data as number | null;
};

// Get the appropriate tier multiplier based on value
const getTierMultiplier = (tiers: Record<string, number>, value: number): number => {
  for (const [key, multiplier] of Object.entries(tiers)) {
    if (key.includes("+")) {
      const min = parseInt(key.replace("+", ""));
      if (value >= min) return multiplier;
    } else if (key.includes("-")) {
      const [min, max] = key.split("-").map(Number);
      if (value >= min && value < max) return multiplier;
    } else {
      if (value === parseInt(key)) return multiplier;
    }
  }
  const values = Object.values(tiers);
  return values[values.length - 1] || 1.0;
};

// Calculate urgency based on preferred date
const calculateUrgency = (preferredDate?: string): string => {
  if (!preferredDate) return "normal";
  
  const preferred = new Date(preferredDate);
  const today = new Date();
  const diffDays = Math.ceil((preferred.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 7) return "urgent";
  if (diffDays <= 3) return "very_urgent";
  
  return "normal";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Validiere Input mit Zod
    const parseResult = LeadDataSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("[calculate-lead-price] Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leadData = parseResult.data;
    logStep("Calculating price for lead", leadData);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active pricing rule
    const { data: pricingRule, error: prError } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (prError) {
      logStep("Error fetching pricing rule", prError);
      throw new Error("Could not fetch pricing rules");
    }

    // Use defaults if no pricing rule exists
    const rule: PricingRule = {
      base_price: pricingRule?.base_price || 20,
      service_multipliers: (pricingRule?.service_multipliers as Record<string, number>) || {},
      urgency_multipliers: (pricingRule?.urgency_multipliers as Record<string, number>) || { normal: 1.0, urgent: 1.5 },
      room_tiers: (pricingRule?.room_tiers as Record<string, number>) || { "1": 0.6, "2": 0.8, "3": 1.0, "4": 1.2, "5": 1.4, "6": 1.6 },
      distance_tiers: (pricingRule?.distance_tiers as Record<string, number>) || { "0-10": 1.0, "10-25": 1.2, "25-50": 1.4, "50-100": 1.6, "100+": 2.0 },
      extra_services: (pricingRule?.extra_services as Record<string, number>) || { packing: 0.3, cleaning: 0.2, storage: 0.25 },
      living_space_tiers: (pricingRule?.living_space_tiers as Record<string, number>) || { "0-50": 0.8, "50-80": 1.0, "80-120": 1.2, "120-180": 1.5, "180+": 2.0 },
    };

    // Fetch pricing settings
    const { data: settings } = await supabase
      .from("pricing_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const pricingSettings: PricingSettings = {
      token_value_chf: settings?.token_value_chf || 1.0,
      min_lead_price_tokens: settings?.min_lead_price_tokens || 5,
      max_lead_price_tokens: settings?.max_lead_price_tokens || 200,
    };

    logStep("Using pricing rule", rule);
    logStep("Using pricing settings", pricingSettings);

    // Start with base price
    let totalPrice = rule.base_price;
    const breakdown: PriceBreakdown = { base_price: rule.base_price };

    // 1. Service type multiplier
    const serviceMultiplier = rule.service_multipliers[leadData.service_type] || 1.0;
    totalPrice *= serviceMultiplier;
    breakdown.service_multiplier = serviceMultiplier;
    logStep("After service multiplier", { totalPrice, serviceMultiplier });

    // 2. Room tier multiplier
    if (leadData.from_rooms && ["umzug", "reinigung", "renovation"].includes(leadData.service_type)) {
      const roomMultiplier = getTierMultiplier(rule.room_tiers, leadData.from_rooms);
      totalPrice *= roomMultiplier;
      breakdown.room_multiplier = roomMultiplier;
      breakdown.rooms = leadData.from_rooms;
      logStep("After room multiplier", { totalPrice, roomMultiplier, rooms: leadData.from_rooms });
    }

    // 3. Living space multiplier
    if (leadData.from_living_space_m2) {
      const spaceMultiplier = getTierMultiplier(rule.living_space_tiers, leadData.from_living_space_m2);
      totalPrice *= spaceMultiplier;
      breakdown.space_multiplier = spaceMultiplier;
      breakdown.living_space_m2 = leadData.from_living_space_m2;
      logStep("After space multiplier", { totalPrice, spaceMultiplier, space: leadData.from_living_space_m2 });
    }

    // 4. Distance multiplier
    if (leadData.to_plz && leadData.service_type === "umzug") {
      const distance = await calculateDistance(supabase, leadData.from_plz, leadData.to_plz);
      if (distance !== null) {
        const distanceMultiplier = getTierMultiplier(rule.distance_tiers, distance);
        totalPrice *= distanceMultiplier;
        breakdown.distance_km = distance;
        breakdown.distance_multiplier = distanceMultiplier;
        logStep("After distance multiplier", { totalPrice, distanceMultiplier, distance });
      }
    }

    // 5. Urgency multiplier
    const urgency = calculateUrgency(leadData.preferred_date);
    const urgencyMultiplier = rule.urgency_multipliers[urgency] || 1.0;
    totalPrice *= urgencyMultiplier;
    breakdown.urgency = urgency;
    breakdown.urgency_multiplier = urgencyMultiplier;
    logStep("After urgency multiplier", { totalPrice, urgencyMultiplier, urgency });

    // 6. Extra services (additive)
    let extraServicesTotal = 0;
    if (leadData.packing_service_needed) {
      const packingExtra = rule.base_price * (rule.extra_services.packing || 0);
      extraServicesTotal += packingExtra;
      breakdown.packing_extra = packingExtra;
    }
    if (leadData.cleaning_service_needed) {
      const cleaningExtra = rule.base_price * (rule.extra_services.cleaning || 0);
      extraServicesTotal += cleaningExtra;
      breakdown.cleaning_extra = cleaningExtra;
    }
    if (leadData.storage_needed) {
      const storageExtra = rule.base_price * (rule.extra_services.storage || 0);
      extraServicesTotal += storageExtra;
      breakdown.storage_extra = storageExtra;
    }
    totalPrice += extraServicesTotal;
    breakdown.extra_services_total = extraServicesTotal;
    logStep("After extra services", { totalPrice, extraServicesTotal });

    // Apply min/max limits
    let finalTokenPrice = Math.round(totalPrice);
    finalTokenPrice = Math.max(finalTokenPrice, pricingSettings.min_lead_price_tokens);
    finalTokenPrice = Math.min(finalTokenPrice, pricingSettings.max_lead_price_tokens);
    
    // Calculate CHF value
    const chfValue = finalTokenPrice * pricingSettings.token_value_chf;

    const result = {
      token_cost: finalTokenPrice,
      chf_value: chfValue,
      token_to_chf_rate: pricingSettings.token_value_chf,
      breakdown: breakdown,
      calculated_at: new Date().toISOString(),
    };

    logStep("Final price calculated", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
