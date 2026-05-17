import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createExtractLeadPrompt } from "../_shared/prompts.ts";
import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Base fields for all service types
interface BaseExtractedData {
  detected_service_type: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  special_notes: string | null;
  confidence_score: number;
}

// Umzug-specific fields
interface UmzugFields {
  from_street: string | null;
  from_house_number: string | null;
  from_plz: string | null;
  from_city: string | null;
  from_floor: number | null;
  from_has_elevator: boolean;
  from_rooms: number | null;
  from_living_space_m2: number | null;
  to_street: string | null;
  to_house_number: string | null;
  to_plz: string | null;
  to_city: string | null;
  to_floor: number | null;
  to_has_elevator: boolean;
  packing_service_needed: boolean;
  furniture_assembly_needed: boolean;
  cleaning_service_needed: boolean;
  storage_needed: boolean;
  piano_transport_needed: boolean;
}

// Reinigung-specific fields
interface ReinigungFields {
  address_street: string | null;
  address_house_number: string | null;
  address_plz: string | null;
  address_city: string | null;
  property_type: string | null;
  number_of_rooms: number | null;
  living_space_m2: number | null;
  bathroom_count: number | null;
  kitchen_type: string | null;
  has_balcony: boolean;
  has_garage: boolean;
  has_basement: boolean;
  has_attic: boolean;
  cleaning_type: string | null;
}

// Räumung-specific fields
interface RaeumungFields {
  address_street: string | null;
  address_house_number: string | null;
  address_plz: string | null;
  address_city: string | null;
  property_type: string | null;
  number_of_rooms: number | null;
  clearing_type: string | null;
  estimated_volume: string | null;
  has_heavy_items: boolean;
  heavy_items_description: string | null;
}

// Entsorgung-specific fields
interface EntsorgungFields {
  address_street: string | null;
  address_house_number: string | null;
  address_plz: string | null;
  address_city: string | null;
  disposal_type: string | null;
  items_description: string | null;
  estimated_volume: string | null;
}

// Lagerung-specific fields
interface LagerungFields {
  pickup_street: string | null;
  pickup_house_number: string | null;
  pickup_plz: string | null;
  pickup_city: string | null;
  pickup_floor: number | null;
  pickup_has_elevator: boolean;
  storage_duration: string | null;
  storage_volume: string | null;
  access_frequency: string | null;
  needs_climate_control: boolean;
  storage_items_description: string | null;
}

// Klaviertransport-specific fields
interface KlaviertransportFields {
  from_street: string | null;
  from_house_number: string | null;
  from_plz: string | null;
  from_city: string | null;
  from_floor: number | null;
  from_has_elevator: boolean;
  to_street: string | null;
  to_house_number: string | null;
  to_plz: string | null;
  to_city: string | null;
  to_floor: number | null;
  to_has_elevator: boolean;
  piano_type: string | null;
  piano_brand: string | null;
  piano_weight_kg: number | null;
  staircase_type: string | null;
  staircase_width_cm: number | null;
  window_access_possible: boolean;
}

// Möbellift-specific fields
interface MoebelliftFields {
  address_street: string | null;
  address_house_number: string | null;
  address_plz: string | null;
  address_city: string | null;
  moebellift_floor: number | null;
  moebellift_item_description: string | null;
  moebellift_item_dimensions: string | null;
  direction: string | null;
}

// Union type for all possible extracted data
type ExtractedData = BaseExtractedData & Partial<UmzugFields> & Partial<ReinigungFields> & Partial<RaeumungFields> & Partial<EntsorgungFields> & Partial<LagerungFields> & Partial<KlaviertransportFields> & Partial<MoebelliftFields>;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[extract-anfrage-ai] ${step}${detailsStr}`);
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_REQUESTS = 10; // max requests
const RATE_LIMIT_WINDOW_MS = 60000; // per minute

function checkRateLimit(companyId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = `extract:${companyId}`;
  const entry = rateLimitMap.get(key);
  
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1 };
  }
  
  if (entry.count >= RATE_LIMIT_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_REQUESTS - entry.count };
}

// Maximum text length to prevent abuse
const MAX_TEXT_LENGTH = 15000;

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Require authenticated user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { raw_text, company_id } = await req.json();
    
    logStep("Starting extraction", { textLength: raw_text?.length, company_id });

    if (!raw_text || raw_text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Kein Text zum Extrahieren vorhanden" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FIX: Add text length limit to prevent abuse and timeouts
    if (raw_text.length > MAX_TEXT_LENGTH) {
      logStep("Text too long", { length: raw_text.length, max: MAX_TEXT_LENGTH });
      return new Response(
        JSON.stringify({ error: `Text zu lang (max. ${MAX_TEXT_LENGTH} Zeichen). Bitte kürzen Sie den Text.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FIX: Rate limiting check
    if (company_id) {
      const rateLimit = checkRateLimit(company_id);
      if (!rateLimit.allowed) {
        logStep("Rate limit exceeded", { company_id });
        return new Response(
          JSON.stringify({ error: "Zu viele Anfragen. Bitte warten Sie eine Minute." }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Retry-After": "60"
            } 
          }
        );
      }
      logStep("Rate limit check passed", { remaining: rateLimit.remaining });
    }

    // Check company has manual import enabled
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, company_name, crm_enabled")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      logStep("Company not found", { company_id, error: companyError });
      return new Response(
        JSON.stringify({ error: "Firma nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Verify the authenticated user is a member of this company
    if (company_id) {
      const isMember = await verifyCompanyMembership(supabase, user.id, company_id);
      if (!isMember) {
        logStep("Unauthorized: user is not a member of company", { userId: user.id, company_id });
        return new Response(
          JSON.stringify({ error: "Keine Berechtigung für diese Firma" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check access: crm_enabled flag
    if (!company.crm_enabled) {
      logStep("CRM not enabled for company", { company_id });
      return new Response(
        JSON.stringify({ error: "CRM-Zugang nicht aktiviert" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Access granted", { company_id });

    // Call Claude API
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    
    if (!anthropicApiKey) {
      logStep("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI-Service nicht konfiguriert" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Calling Claude API");
    
    // Use the shared prompt template
    const prompt = createExtractLeadPrompt(raw_text);
    
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5", // Latest Haiku - cheapest current model
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: prompt
        }]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      logStep("Claude API error", { status: claudeResponse.status, error: errorText });
      return new Response(
        JSON.stringify({ error: "AI-Verarbeitung fehlgeschlagen" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeResponse.json();
    logStep("Claude API response received", { contentLength: claudeData.content?.[0]?.text?.length });

    // Parse the JSON response from Claude
    let extractedData: ExtractedData;
    try {
      const responseText = claudeData.content[0].text;
      // Remove any potential markdown code blocks
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanJson);
    } catch (parseError) {
      logStep("Failed to parse Claude response", { error: parseError, response: claudeData.content?.[0]?.text });
      return new Response(
        JSON.stringify({ error: "AI-Antwort konnte nicht verarbeitet werden" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and clean extracted data based on service type
    const validatedData = validateAndCleanData(extractedData);
    
    logStep("Extraction complete", { 
      confidence: validatedData.confidence_score,
      service_type: validatedData.detected_service_type
    });

    return new Response(
      JSON.stringify({
        success: true,
        extracted_data: validatedData
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Unexpected error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: "Unerwarteter Fehler bei der Verarbeitung" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---------------------------------------------------------------------------
// Enum normalization — defense in depth
//
// The prompt tells Claude to use exact enum slugs (e.g. "fluegel"), but the
// model sometimes returns localized / capitalized variants ("Flügel", "groß",
// "Wohnungsräumung" for raeumung etc.) that don't match the UI <Select>
// values. We normalize here so the preview form renders correctly without
// the user having to manually re-select everything.
// ---------------------------------------------------------------------------

const PIANO_TYPE_MAP: Record<string, string> = {
  "klavier": "klavier",
  "piano": "klavier",
  "aufrecht": "klavier",
  "aufrechtes klavier": "klavier",
  "fluegel": "fluegel",
  "flügel": "fluegel",
  "konzertfluegel": "fluegel",
  "konzertflügel": "fluegel",
  "e-piano": "e_piano",
  "e piano": "e_piano",
  "e_piano": "e_piano",
  "epiano": "e_piano",
  "digitalpiano": "e_piano",
  "keyboard": "keyboard",
};

const VOLUME_MAP: Record<string, string> = {
  "klein": "klein",
  "small": "klein",
  "mittel": "mittel",
  "medium": "mittel",
  "gross": "gross",
  "groß": "gross",
  "big": "gross",
  "large": "gross",
  "sehr_gross": "sehr_gross",
  "sehr gross": "sehr_gross",
  "sehr groß": "sehr_gross",
  "sehrgross": "sehr_gross",
  "xl": "sehr_gross",
  "xxl": "sehr_gross",
};

const STAIRCASE_MAP: Record<string, string> = {
  "keine": "keine",
  "keine treppe": "keine",
  "gerade": "gerade",
  "gerade treppe": "gerade",
  "kurvig": "kurvig",
  "kurvige treppe": "kurvig",
  "wendel": "wendel",
  "wendeltreppe": "wendel",
};

const DIRECTION_MAP: Record<string, string> = {
  "hoch": "hoch",
  "rauf": "hoch",
  "hinauf": "hoch",
  "einzug": "hoch",
  "runter": "runter",
  "hinunter": "runter",
  "herunter": "runter",
  "auszug": "runter",
  "beides": "beides",
  "hoch und runter": "beides",
  "beide": "beides",
};

const KITCHEN_MAP: Record<string, string> = {
  "offen": "offen",
  "offene kueche": "offen",
  "offene küche": "offen",
  "geschlossen": "geschlossen",
  "geschlossene kueche": "geschlossen",
  "geschlossene küche": "geschlossen",
  "separat": "geschlossen",
  "kochnische": "kochnische",
  "kitchenette": "kochnische",
};

const STORAGE_DURATION_MAP: Record<string, string> = {
  "kurzfristig": "kurzfristig",
  "kurz": "kurzfristig",
  "wenige tage": "kurzfristig",
  "1-3_monate": "1-3_monate",
  "1 bis 3 monate": "1-3_monate",
  "1-3 monate": "1-3_monate",
  "3-6_monate": "3-6_monate",
  "3-6 monate": "3-6_monate",
  "6-12_monate": "6-12_monate",
  "6-12 monate": "6-12_monate",
  "langfristig": "langfristig",
  "lang": "langfristig",
  "1+ jahr": "langfristig",
  "mehrjaehrig": "langfristig",
  "mehrjährig": "langfristig",
};

const ACCESS_FREQUENCY_MAP: Record<string, string> = {
  "nie": "nie",
  "kein zugriff": "nie",
  "kein zugriff noetig": "nie",
  "kein zugriff nötig": "nie",
  "selten": "selten",
  "monatlich": "monatlich",
  "jeden monat": "monatlich",
  "woechentlich": "wöchentlich",
  "wöchentlich": "wöchentlich",
  "jede woche": "wöchentlich",
};

function normalizeEnum(
  value: string | null | undefined,
  map: Record<string, string>,
): string | null {
  if (!value || typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  return map[key] ?? null;
}

// Clearing type normalizer — match to closest Räumung category by keywords.
// UI <SelectItem> values are capitalized ("Wohnungsräumung"), so we always
// return the capitalized form regardless of the AI's case.
function normalizeClearingType(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const v = value.toLowerCase();
  if (v.includes("wohnung")) return "Wohnungsräumung";
  if (v.includes("haus")) return "Hausräumung";
  if (v.includes("keller")) return "Kellerräumung";
  if (v.includes("dachboden") || v.includes("estrich")) return "Dachbodenräumung";
  if (v.includes("büro") || v.includes("buero") || v.includes("office")) {
    return "Büroräumung";
  }
  return null;
}

function normalizePropertyType(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.includes("wohnung") || v === "apartment") return "Wohnung";
  if (v.includes("haus") || v === "house") return "Haus";
  if (v.includes("studio")) return "Studio";
  if (v.includes("büro") || v.includes("buero") || v.includes("office")) return "Büro";
  if (v.includes("keller")) return "Keller";
  if (v.includes("estrich") || v.includes("dachboden")) return "Estrich";
  return null;
}

function normalizeCleaningType(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.includes("endreinigung") || v.includes("abgabereinigung")) return "Endreinigung";
  if (v.includes("grundreinigung") || v.includes("grund")) return "Grundreinigung";
  if (v.includes("unterhalt") || v.includes("maintenance")) return "Unterhaltsreinigung";
  return null;
}

function normalizeDisposalType(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.includes("sperr")) return "Sperrmüll";
  if (v.includes("elektro") || v.includes("e-schrott") || v.includes("eschrott")) {
    return "Elektroschrott";
  }
  if (v.includes("bauschutt") || v.includes("beton") || v.includes("bau")) {
    return "Bauschutt";
  }
  if (v.includes("hausrat")) return "Hausrat";
  if (v.includes("möbel") || v.includes("moebel") || v.includes("furniture")) {
    return "Möbel";
  }
  if (v.includes("gemischt") || v.includes("mix")) return "Gemischt";
  return null;
}

// Basic Swiss phone sanity check.
// Valid formats:
//   +41 + 9 digits (second digit must be 2–9 = area code / mobile)
//   0 + 9 digits local (second digit must be 2–9)
// Rejects junk like 123456789, 000000000, 111111111, and numbers shorter
// than expected length. We intentionally accept the full 2–9 range because
// Swiss area codes cover 021…091 plus mobile 07x — much broader than a
// naive [234789].
function isPlausibleSwissPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  const isAllSame = /^(\d)\1+$/.test(digits);
  if (isAllSame) return false;
  if (digits.length === 11 && digits.startsWith("41")) {
    return /^[2-9]/.test(digits.substring(2));
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return /^0[2-9]/.test(digits);
  }
  return false;
}

// Swiss PLZ sanity check: 4 digits in 1000–9699 range
function isPlausibleSwissPLZ(plz: string | null | undefined): boolean {
  if (!plz) return false;
  if (!/^\d{4}$/.test(plz)) return false;
  const n = parseInt(plz, 10);
  return n >= 1000 && n <= 9699;
}

// Final clean-up helper: returns null for obviously invalid values so the
// preview form doesn't silently accept AI hallucinations.
function sanitizeBase<T extends BaseExtractedData>(data: T): T {
  // Null-out implausible phone (model sometimes formats junk into CH layout)
  if (data.phone && !isPlausibleSwissPhone(data.phone)) {
    data.phone = null;
  }
  return data;
}

function validateAndCleanData(data: ExtractedData): ExtractedData {
  const serviceType = data.detected_service_type || "umzug_privat";
  
  // Base data with defaults
  const baseData: BaseExtractedData = sanitizeBase({
    detected_service_type: serviceType,
    first_name: data.first_name || null,
    last_name: data.last_name || null,
    email: data.email || null,
    phone: data.phone || null,
    preferred_date: data.preferred_date || null,
    preferred_time: data.preferred_time || null,
    special_notes: data.special_notes || null,
    confidence_score: Math.min(100, Math.max(0, data.confidence_score || 50)),
  });

  // Add service-specific fields based on detected type
  switch (serviceType) {
    case "umzug_privat":
    case "umzug_firma":
      return {
        ...baseData,
        from_street: data.from_street || null,
        from_house_number: data.from_house_number || null,
        from_plz: isPlausibleSwissPLZ(data.from_plz) ? data.from_plz : null,
        from_city: data.from_city || null,
        from_floor: data.from_floor ?? null,
        from_has_elevator: data.from_has_elevator ?? false,
        from_rooms: data.from_rooms ?? null,
        from_living_space_m2: data.from_living_space_m2 ?? null,
        to_street: data.to_street || null,
        to_house_number: data.to_house_number || null,
        to_plz: isPlausibleSwissPLZ(data.to_plz) ? data.to_plz : null,
        to_city: data.to_city || null,
        to_floor: data.to_floor ?? null,
        to_has_elevator: data.to_has_elevator ?? false,
        packing_service_needed: data.packing_service_needed ?? false,
        furniture_assembly_needed: data.furniture_assembly_needed ?? false,
        cleaning_service_needed: data.cleaning_service_needed ?? false,
        storage_needed: data.storage_needed ?? false,
        piano_transport_needed: data.piano_transport_needed ?? false,
      };

    case "reinigung":
      return {
        ...baseData,
        address_street: data.address_street || null,
        address_house_number: data.address_house_number || null,
        address_plz: isPlausibleSwissPLZ(data.address_plz) ? data.address_plz : null,
        address_city: data.address_city || null,
        property_type: normalizePropertyType(data.property_type),
        number_of_rooms: data.number_of_rooms ?? null,
        living_space_m2: data.living_space_m2 ?? null,
        bathroom_count: data.bathroom_count ?? null,
        kitchen_type: normalizeEnum(data.kitchen_type, KITCHEN_MAP),
        has_balcony: data.has_balcony ?? false,
        has_garage: data.has_garage ?? false,
        has_basement: data.has_basement ?? false,
        has_attic: data.has_attic ?? false,
        cleaning_type: normalizeCleaningType(data.cleaning_type),
      };

    case "raeumung":
      return {
        ...baseData,
        address_street: data.address_street || null,
        address_house_number: data.address_house_number || null,
        address_plz: isPlausibleSwissPLZ(data.address_plz) ? data.address_plz : null,
        address_city: data.address_city || null,
        property_type: normalizePropertyType(data.property_type),
        number_of_rooms: data.number_of_rooms ?? null,
        clearing_type: normalizeClearingType(data.clearing_type),
        estimated_volume: normalizeEnum(data.estimated_volume, VOLUME_MAP),
        has_heavy_items: data.has_heavy_items ?? false,
        heavy_items_description: data.heavy_items_description || null,
      };

    case "entsorgung":
      return {
        ...baseData,
        address_street: data.address_street || null,
        address_house_number: data.address_house_number || null,
        address_plz: isPlausibleSwissPLZ(data.address_plz) ? data.address_plz : null,
        address_city: data.address_city || null,
        disposal_type: normalizeDisposalType(data.disposal_type),
        items_description: data.items_description || null,
        estimated_volume: normalizeEnum(data.estimated_volume, VOLUME_MAP),
      };

    case "lagerung":
      return {
        ...baseData,
        pickup_street: data.pickup_street || null,
        pickup_house_number: data.pickup_house_number || null,
        pickup_plz: isPlausibleSwissPLZ(data.pickup_plz) ? data.pickup_plz : null,
        pickup_city: data.pickup_city || null,
        pickup_floor: data.pickup_floor ?? null,
        pickup_has_elevator: data.pickup_has_elevator ?? false,
        storage_duration: normalizeEnum(data.storage_duration, STORAGE_DURATION_MAP),
        storage_volume: normalizeEnum(data.storage_volume, VOLUME_MAP),
        access_frequency: normalizeEnum(data.access_frequency, ACCESS_FREQUENCY_MAP),
        needs_climate_control: data.needs_climate_control ?? false,
        storage_items_description: data.storage_items_description || null,
      };

    case "klaviertransport":
      return {
        ...baseData,
        from_street: data.from_street || null,
        from_house_number: data.from_house_number || null,
        from_plz: isPlausibleSwissPLZ(data.from_plz) ? data.from_plz : null,
        from_city: data.from_city || null,
        from_floor: data.from_floor ?? null,
        from_has_elevator: data.from_has_elevator ?? false,
        to_street: data.to_street || null,
        to_house_number: data.to_house_number || null,
        to_plz: isPlausibleSwissPLZ(data.to_plz) ? data.to_plz : null,
        to_city: data.to_city || null,
        to_floor: data.to_floor ?? null,
        to_has_elevator: data.to_has_elevator ?? false,
        piano_type: normalizeEnum(data.piano_type, PIANO_TYPE_MAP),
        piano_brand: data.piano_brand || null,
        piano_weight_kg: data.piano_weight_kg ?? null,
        staircase_type: normalizeEnum(data.staircase_type, STAIRCASE_MAP),
        staircase_width_cm: data.staircase_width_cm ?? null,
        window_access_possible: data.window_access_possible ?? false,
      };

    case "moebellift":
      return {
        ...baseData,
        address_street: data.address_street || null,
        address_house_number: data.address_house_number || null,
        address_plz: isPlausibleSwissPLZ(data.address_plz) ? data.address_plz : null,
        address_city: data.address_city || null,
        moebellift_floor: data.moebellift_floor ?? null,
        moebellift_item_description: data.moebellift_item_description || null,
        moebellift_item_dimensions: data.moebellift_item_dimensions || null,
        direction: normalizeEnum(data.direction, DIRECTION_MAP),
      };

    default:
      return baseData;
  }
}
