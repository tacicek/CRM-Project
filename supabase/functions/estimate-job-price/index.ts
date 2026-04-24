import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Lead {
  id: string;
  service_type: string;
  from_plz: string;
  from_city: string;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
  from_rooms?: number | null;
  from_living_space_m2?: number | null;
  from_distance_to_parking?: number | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_lift?: boolean | null;
  to_distance_to_parking?: number | null;
  preferred_date?: string | null;
  distance_km?: number | null;
  estimated_duration_minutes?: number | null;
  packing_service_needed?: boolean | null;
  cleaning_service_needed?: boolean | null;
  storage_needed?: boolean | null;
  piano_transport_needed?: boolean | null;
  piano_type?: string | null;
  piano_weight_kg?: number | null;
  moebellift_floor?: number | null;
  clearing_type?: string | null;
  estimated_volume?: string | null;
  bathroom_count?: number | null;
  property_type?: string | null;
  has_heavy_items?: boolean | null;
  // Detailed form data from wizard
  detailed_form_data?: DetailedFormData | null;
}

// Detailed form data types
interface DetailedFormData {
  inventar?: {
    items?: { name: string; anzahl: number }[];
    schwere_gegenstaende?: { name: string; anzahl: number; aufpreis_chf?: number }[];
    geschaetzte_kartons?: number;
  };
  zusatzleistungen?: {
    verpackung?: { aktiv: boolean; umfang?: string };
    auspacken?: boolean;
    moebelmontage?: boolean;
    endreinigung?: boolean;
    entsorgung?: { aktiv: boolean; volumen_m3?: number };
    zwischenlagerung?: { aktiv: boolean; dauer_wochen?: number };
    moebellift?: { aktiv: boolean; standort?: string };
  };
  auszug?: {
    stockwerk?: string;
    lift?: { vorhanden: boolean; typ?: string };
    anzahl_zimmer?: number;
    wohnflaeche_m2?: number;
    parkplatz?: {
      distanz_meter?: number;
      stufen?: string;
      weg_beeintraechtigt?: boolean;
    };
  };
  einzug?: {
    stockwerk?: string;
    lift?: { vorhanden: boolean; typ?: string };
    parkplatz?: {
      distanz_meter?: number;
      stufen?: string;
      weg_beeintraechtigt?: boolean;
    };
  };
}

interface PriceEstimate {
  min_price: number;
  max_price: number;
  recommended_price: number;
  estimated_hours: number;
  breakdown: { item: string; price: number }[];
  factors: string[];
  confidence: "high" | "medium" | "low";
}

// Swiss market base prices (2024)
const MARKET_PRICES = {
  // Umzug
  umzug_per_hour_2_men: { min: 120, max: 180 },
  umzug_per_room: { min: 300, max: 500 },
  
  // Reinigung
  reinigung_per_m2: { min: 3, max: 5 },
  endreinigung_per_room: { min: 80, max: 150 },
  
  // Räumung/Entsorgung
  raeumung_per_m3: { min: 80, max: 150 },
  entsorgung_pauschale: { min: 200, max: 500 },
  
  // Lagerung
  lagerung_per_m3_month: { min: 30, max: 50 },
  
  // Spezial
  klaviertransport_base: { min: 400, max: 800 },
  moebellift_per_hour: { min: 150, max: 250 },
  
  // Extras
  packing_per_m2: { min: 8, max: 15 },
  furniture_assembly: { min: 50, max: 100 },
};

// Floor multipliers (without lift)
const FLOOR_MULTIPLIER = {
  0: 1.0,
  1: 1.1,
  2: 1.2,
  3: 1.35,
  4: 1.5,
  5: 1.7,
};

// Calculate urgency based on date
const getUrgencyFactor = (preferredDate: string | null | undefined): { factor: number; label: string } => {
  if (!preferredDate) return { factor: 1.0, label: "normal" };
  
  const date = new Date(preferredDate);
  const today = new Date();
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 2) return { factor: 1.5, label: "sehr dringend (+50%)" };
  if (diffDays <= 7) return { factor: 1.25, label: "dringend (+25%)" };
  if (diffDays <= 14) return { factor: 1.1, label: "kurzfristig (+10%)" };
  
  return { factor: 1.0, label: "normal" };
};

// Check if weekend
const isWeekend = (preferredDate: string | null | undefined): boolean => {
  if (!preferredDate) return false;
  const day = new Date(preferredDate).getDay();
  return day === 0 || day === 6;
};

// Estimate Umzug price
const estimateUmzugPrice = (lead: Lead): PriceEstimate => {
  const breakdown: { item: string; price: number }[] = [];
  const factors: string[] = [];
  
  // Get rooms and m2 from detailed_form_data if available
  // IMPORTANT: Only use FROM (Auszug) property for rooms/m2 - this determines furniture volume
  // TO (Einzug) property only matters for: floor, lift, parking distance
  const detailedData = lead.detailed_form_data;
  const rooms = detailedData?.auszug?.anzahl_zimmer || lead.from_rooms || 3;
  const m2 = detailedData?.auszug?.wohnflaeche_m2 || lead.from_living_space_m2 || (rooms * 25);
  const distance = lead.distance_km || 10;
  
  // Base: Hours estimation (rooms * 1.5 hours + travel time)
  // Based on furniture volume from FROM property
  const estimatedHours = Math.max(2, rooms * 1.5 + (distance / 30));
  
  // Base price per hour
  let minBase = MARKET_PRICES.umzug_per_hour_2_men.min * estimatedHours;
  let maxBase = MARKET_PRICES.umzug_per_hour_2_men.max * estimatedHours;
  
  breakdown.push({ item: `Transport (${estimatedHours.toFixed(1)} Std.)`, price: (minBase + maxBase) / 2 });
  
  // Floor factor (FROM) - check detailed_form_data first
  const fromFloor = detailedData?.auszug?.stockwerk ? parseFloor(detailedData.auszug.stockwerk) : (lead.from_floor || 0);
  const fromHasLift = detailedData?.auszug?.lift?.vorhanden ?? lead.from_has_lift ?? false;
  
  if (fromFloor > 0 && !fromHasLift) {
    const floorMult = FLOOR_MULTIPLIER[Math.min(fromFloor, 5) as keyof typeof FLOOR_MULTIPLIER] || 1.7;
    minBase *= floorMult;
    maxBase *= floorMult;
    factors.push(`Auszug: ${fromFloor}. Stock ohne Lift (+${((floorMult - 1) * 100).toFixed(0)}%)`);
  }
  
  // Floor factor (TO) - check detailed_form_data first
  const toFloor = detailedData?.einzug?.stockwerk ? parseFloor(detailedData.einzug.stockwerk) : (lead.to_floor || 0);
  const toHasLift = detailedData?.einzug?.lift?.vorhanden ?? lead.to_has_lift ?? false;
  
  if (toFloor > 0 && !toHasLift) {
    const floorMult = FLOOR_MULTIPLIER[Math.min(toFloor, 5) as keyof typeof FLOOR_MULTIPLIER] || 1.7;
    minBase *= floorMult;
    maxBase *= floorMult;
    factors.push(`Einzug: ${toFloor}. Stock ohne Lift (+${((floorMult - 1) * 100).toFixed(0)}%)`);
  }
  
  // Parking distance factor (TO/Einzug) - longer distance = more time
  const toParkingDistance = detailedData?.einzug?.parkplatz?.distanz_meter || lead.to_distance_to_parking || 0;
  if (toParkingDistance > 50) {
    // Add extra time for long parking distance: ~1 minute per 10 meters over 50m
    const extraMinutes = Math.ceil((toParkingDistance - 50) / 10);
    const extraHours = extraMinutes / 60;
    const extraCost = extraHours * ((MARKET_PRICES.umzug_per_hour_2_men.min + MARKET_PRICES.umzug_per_hour_2_men.max) / 2);
    minBase += extraCost * 0.8;
    maxBase += extraCost * 1.2;
    factors.push(`Einzug: Parkplatz ${toParkingDistance}m entfernt (+${extraMinutes} Min.)`);
    breakdown.push({ item: `Parkplatz-Distanz Einzug (${toParkingDistance}m)`, price: extraCost });
  }
  
  // Parking distance factor (FROM/Auszug) - also important
  const fromParkingDistance = detailedData?.auszug?.parkplatz?.distanz_meter || lead.from_distance_to_parking || 0;
  if (fromParkingDistance > 50) {
    const extraMinutes = Math.ceil((fromParkingDistance - 50) / 10);
    const extraHours = extraMinutes / 60;
    const extraCost = extraHours * ((MARKET_PRICES.umzug_per_hour_2_men.min + MARKET_PRICES.umzug_per_hour_2_men.max) / 2);
    minBase += extraCost * 0.8;
    maxBase += extraCost * 1.2;
    factors.push(`Auszug: Parkplatz ${fromParkingDistance}m entfernt (+${extraMinutes} Min.)`);
    breakdown.push({ item: `Parkplatz-Distanz Auszug (${fromParkingDistance}m)`, price: extraCost });
  }
  
  // Distance factor
  if (distance > 50) {
    const distanceCost = (distance - 50) * 2; // CHF 2 per km over 50km
    minBase += distanceCost;
    maxBase += distanceCost;
    factors.push(`Lange Strecke: ${distance.toFixed(0)} km`);
    breakdown.push({ item: "Entfernungszuschlag", price: distanceCost });
  }
  
  // ========== DETAILED FORM DATA EXTRAS ==========
  
  // Heavy items from detailed_form_data (Flügel, Tresor, etc.)
  if (detailedData?.inventar?.schwere_gegenstaende) {
    const heavyItems = detailedData.inventar.schwere_gegenstaende.filter(i => i.anzahl > 0);
    for (const item of heavyItems) {
      const itemTotal = item.anzahl * (item.aufpreis_chf || 0);
      if (itemTotal > 0) {
        minBase += itemTotal * 0.8; // 20% discount for min
        maxBase += itemTotal * 1.2; // 20% buffer for max
        factors.push(`${item.anzahl}x ${item.name}`);
        breakdown.push({ item: `${item.anzahl}x ${item.name}`, price: itemTotal });
      }
    }
  }
  
  // Möbellift from detailed_form_data
  if (detailedData?.zusatzleistungen?.moebellift?.aktiv) {
    const standort = detailedData.zusatzleistungen.moebellift.standort;
    const moebelliftCost = standort === 'beide' ? 800 : 400;
    minBase += moebelliftCost * 0.8;
    maxBase += moebelliftCost * 1.3;
    factors.push(`Möbellift (${standort === 'beide' ? 'beide Seiten' : standort === 'auszug' ? 'Auszug' : 'Einzug'})`);
    breakdown.push({ item: "Möbellift", price: moebelliftCost });
  }
  
  // Packing service (from detailed_form_data or lead flags)
  const packingActive = detailedData?.zusatzleistungen?.verpackung?.aktiv || lead.packing_service_needed;
  if (packingActive) {
    const packingMin = m2 * MARKET_PRICES.packing_per_m2.min;
    const packingMax = m2 * MARKET_PRICES.packing_per_m2.max;
    minBase += packingMin;
    maxBase += packingMax;
    factors.push("Einpackservice");
    breakdown.push({ item: "Einpackservice", price: (packingMin + packingMax) / 2 });
  }
  
  // Cleaning service (from detailed_form_data or lead flags)
  const cleaningActive = detailedData?.zusatzleistungen?.endreinigung || lead.cleaning_service_needed;
  if (cleaningActive) {
    const cleaningMin = m2 * MARKET_PRICES.reinigung_per_m2.min;
    const cleaningMax = m2 * MARKET_PRICES.reinigung_per_m2.max;
    minBase += cleaningMin;
    maxBase += cleaningMax;
    factors.push("Endreinigung");
    breakdown.push({ item: "Endreinigung", price: (cleaningMin + cleaningMax) / 2 });
  }
  
  // Furniture assembly from detailed_form_data
  if (detailedData?.zusatzleistungen?.moebelmontage) {
    const montageMin = MARKET_PRICES.furniture_assembly.min * rooms;
    const montageMax = MARKET_PRICES.furniture_assembly.max * rooms;
    minBase += montageMin;
    maxBase += montageMax;
    factors.push("Möbelmontage");
    breakdown.push({ item: "Möbelmontage", price: (montageMin + montageMax) / 2 });
  }
  
  // Entsorgung from detailed_form_data
  if (detailedData?.zusatzleistungen?.entsorgung?.aktiv) {
    const volumen = detailedData.zusatzleistungen.entsorgung.volumen_m3 || 5;
    const entsorgungCost = volumen * 80; // ~80 CHF per m³
    minBase += entsorgungCost * 0.8;
    maxBase += entsorgungCost * 1.2;
    factors.push(`Entsorgung (${volumen} m³)`);
    breakdown.push({ item: "Entsorgung", price: entsorgungCost });
  }
  
  // Storage (from detailed_form_data or lead flags)
  const storageActive = detailedData?.zusatzleistungen?.zwischenlagerung?.aktiv || lead.storage_needed;
  if (storageActive) {
    const weeks = detailedData?.zusatzleistungen?.zwischenlagerung?.dauer_wochen || 4;
    const storageCost = weeks * 50 + 150; // ~50 CHF/week + handling
    minBase += storageCost * 0.8;
    maxBase += storageCost * 1.2;
    factors.push(`Zwischenlagerung (${weeks} Wochen)`);
    breakdown.push({ item: "Lagerung", price: storageCost });
  }
  
  // ========== END DETAILED FORM DATA ==========
  
  // Urgency
  const urgency = getUrgencyFactor(lead.preferred_date);
  if (urgency.factor > 1.0) {
    minBase *= urgency.factor;
    maxBase *= urgency.factor;
    factors.push(urgency.label);
  }
  
  // Weekend
  if (isWeekend(lead.preferred_date)) {
    minBase *= 1.2;
    maxBase *= 1.2;
    factors.push("Wochenende (+20%)");
  }
  
  return {
    min_price: Math.round(minBase / 10) * 10,
    max_price: Math.round(maxBase / 10) * 10,
    recommended_price: Math.round(((minBase + maxBase) / 2) / 10) * 10,
    estimated_hours: Math.round(estimatedHours * 10) / 10,
    breakdown,
    factors,
    confidence: (rooms && m2) ? "high" : "medium",
  };
};

// Helper to parse floor from string (e.g., "floor_3" → 3)
const parseFloor = (stockwerk: string): number => {
  if (stockwerk.includes('basement') || stockwerk.includes('under')) return -1;
  if (stockwerk.includes('ground') || stockwerk === 'eg') return 0;
  const match = stockwerk.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
};

// Estimate Reinigung price
const estimateReinigungPrice = (lead: Lead): PriceEstimate => {
  const breakdown: { item: string; price: number }[] = [];
  const factors: string[] = [];
  
  const rooms = lead.from_rooms || 3;
  const m2 = lead.from_living_space_m2 || (rooms * 25);
  const bathrooms = lead.bathroom_count || 1;
  
  // Base: per m2
  let minBase = m2 * MARKET_PRICES.reinigung_per_m2.min;
  let maxBase = m2 * MARKET_PRICES.reinigung_per_m2.max;
  
  breakdown.push({ item: `Grundreinigung (${m2} m²)`, price: (minBase + maxBase) / 2 });
  
  // Additional bathroom cost
  if (bathrooms > 1) {
    const extraBathCost = (bathrooms - 1) * 50;
    minBase += extraBathCost;
    maxBase += extraBathCost;
    factors.push(`${bathrooms} Badezimmer`);
    breakdown.push({ item: "Zusätzliche Badezimmer", price: extraBathCost });
  }
  
  // Property type factor
  if (lead.property_type === "haus" || lead.property_type === "Haus") {
    minBase *= 1.3;
    maxBase *= 1.3;
    factors.push("Haus (+30%)");
  }
  
  // Estimated hours
  const estimatedHours = m2 / 15; // ~15 m² per hour
  
  // Urgency
  const urgency = getUrgencyFactor(lead.preferred_date);
  if (urgency.factor > 1.0) {
    minBase *= urgency.factor;
    maxBase *= urgency.factor;
    factors.push(urgency.label);
  }
  
  return {
    min_price: Math.round(minBase / 10) * 10,
    max_price: Math.round(maxBase / 10) * 10,
    recommended_price: Math.round(((minBase + maxBase) / 2) / 10) * 10,
    estimated_hours: Math.round(estimatedHours * 10) / 10,
    breakdown,
    factors,
    confidence: lead.from_living_space_m2 ? "high" : "medium",
  };
};

// Estimate Räumung/Entsorgung price
const estimateRaeumungPrice = (lead: Lead): PriceEstimate => {
  const breakdown: { item: string; price: number }[] = [];
  const factors: string[] = [];
  
  // Parse volume
  let volume = 20; // default m³
  if (lead.estimated_volume) {
    const match = lead.estimated_volume.match(/\d+/);
    if (match) volume = parseInt(match[0]);
  }
  
  // Base: per m³
  let minBase = volume * MARKET_PRICES.raeumung_per_m3.min;
  let maxBase = volume * MARKET_PRICES.raeumung_per_m3.max;
  
  breakdown.push({ item: `Räumung (${volume} m³)`, price: (minBase + maxBase) / 2 });
  
  // Heavy items
  if (lead.has_heavy_items) {
    minBase += 200;
    maxBase += 400;
    factors.push("Schwere Gegenstände");
    breakdown.push({ item: "Schwerelastzuschlag", price: 300 });
  }
  
  // Floor without lift
  if (lead.from_floor && !lead.from_has_lift && lead.from_floor > 0) {
    const floorMult = FLOOR_MULTIPLIER[Math.min(lead.from_floor, 5) as keyof typeof FLOOR_MULTIPLIER] || 1.7;
    minBase *= floorMult;
    maxBase *= floorMult;
    factors.push(`${lead.from_floor}. Stock ohne Lift`);
  }
  
  const estimatedHours = volume / 5; // ~5 m³ per hour
  
  return {
    min_price: Math.round(minBase / 10) * 10,
    max_price: Math.round(maxBase / 10) * 10,
    recommended_price: Math.round(((minBase + maxBase) / 2) / 10) * 10,
    estimated_hours: Math.round(estimatedHours * 10) / 10,
    breakdown,
    factors,
    confidence: lead.estimated_volume ? "high" : "low",
  };
};

// Estimate Klaviertransport price
const estimateKlaviertransportPrice = (lead: Lead): PriceEstimate => {
  const breakdown: { item: string; price: number }[] = [];
  const factors: string[] = [];
  
  // Base price
  let minBase = MARKET_PRICES.klaviertransport_base.min;
  let maxBase = MARKET_PRICES.klaviertransport_base.max;
  
  breakdown.push({ item: "Klaviertransport Basis", price: (minBase + maxBase) / 2 });
  
  // Weight factor
  if (lead.piano_weight_kg) {
    if (lead.piano_weight_kg > 400) {
      minBase *= 1.5;
      maxBase *= 1.5;
      factors.push(`Schweres Klavier (${lead.piano_weight_kg} kg)`);
    } else if (lead.piano_weight_kg > 250) {
      minBase *= 1.3;
      maxBase *= 1.3;
      factors.push(`Mittelschweres Klavier (${lead.piano_weight_kg} kg)`);
    }
  }
  
  // Piano type
  if (lead.piano_type === "flugel" || lead.piano_type === "Flügel") {
    minBase *= 1.4;
    maxBase *= 1.4;
    factors.push("Flügel (+40%)");
  }
  
  // Distance
  if (lead.distance_km && lead.distance_km > 30) {
    const distanceCost = (lead.distance_km - 30) * 3;
    minBase += distanceCost;
    maxBase += distanceCost;
    factors.push(`Entfernung: ${lead.distance_km.toFixed(0)} km`);
  }
  
  return {
    min_price: Math.round(minBase / 10) * 10,
    max_price: Math.round(maxBase / 10) * 10,
    recommended_price: Math.round(((minBase + maxBase) / 2) / 10) * 10,
    estimated_hours: 3,
    breakdown,
    factors,
    confidence: lead.piano_type ? "high" : "medium",
  };
};

// Estimate Möbellift price
const estimateMoebelliftPrice = (lead: Lead): PriceEstimate => {
  const breakdown: { item: string; price: number }[] = [];
  const factors: string[] = [];
  
  const floor = lead.moebellift_floor || 3;
  const estimatedHours = Math.max(2, floor * 0.5);
  
  let minBase = MARKET_PRICES.moebellift_per_hour.min * estimatedHours;
  let maxBase = MARKET_PRICES.moebellift_per_hour.max * estimatedHours;
  
  breakdown.push({ item: `Möbellift (${floor}. Stock, ${estimatedHours} Std.)`, price: (minBase + maxBase) / 2 });
  
  if (floor > 5) {
    minBase *= 1.3;
    maxBase *= 1.3;
    factors.push(`Hohes Stockwerk (${floor}. Stock)`);
  }
  
  return {
    min_price: Math.round(minBase / 10) * 10,
    max_price: Math.round(maxBase / 10) * 10,
    recommended_price: Math.round(((minBase + maxBase) / 2) / 10) * 10,
    estimated_hours: estimatedHours,
    breakdown,
    factors,
    confidence: lead.moebellift_floor ? "high" : "medium",
  };
};

// Main estimation function
const estimateJobPrice = (lead: Lead): PriceEstimate => {
  const serviceType = lead.service_type?.toLowerCase() || "";
  
  if (serviceType.includes("umzug") || serviceType.includes("transport")) {
    return estimateUmzugPrice(lead);
  }
  
  if (serviceType.includes("reinigung")) {
    return estimateReinigungPrice(lead);
  }
  
  if (serviceType.includes("räumung") || serviceType.includes("raeumung") || serviceType.includes("entsorgung")) {
    return estimateRaeumungPrice(lead);
  }
  
  if (serviceType.includes("klavier")) {
    return estimateKlaviertransportPrice(lead);
  }
  
  if (serviceType.includes("möbellift") || serviceType.includes("moebellift")) {
    return estimateMoebelliftPrice(lead);
  }
  
  // Default: Basic estimation
  const rooms = lead.from_rooms || 3;
  return {
    min_price: rooms * 200,
    max_price: rooms * 400,
    recommended_price: rooms * 300,
    estimated_hours: rooms * 2,
    breakdown: [{ item: "Pauschalschätzung", price: rooms * 300 }],
    factors: [],
    confidence: "low",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id, lead_data } = await req.json();

    let lead: Lead;

    if (lead_id) {
      // Fetch lead from database
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", lead_id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      lead = data as Lead;
    } else if (lead_data) {
      lead = lead_data as Lead;
    } else {
      return new Response(
        JSON.stringify({ error: "Either lead_id or lead_data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const estimate = estimateJobPrice(lead);

    // Optionally save to database
    if (lead_id) {
      await supabase
        .from("leads")
        .update({
          estimated_job_price_min: estimate.min_price,
          estimated_job_price_max: estimate.max_price,
          estimated_job_price_confidence: estimate.confidence,
        })
        .eq("id", lead_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        estimate,
        service_type: lead.service_type,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error estimating price:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

