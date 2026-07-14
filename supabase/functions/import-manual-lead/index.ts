import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";
import { isLocale, toLocale } from "../_shared/i18n/locale.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[import-manual-lead] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Verify the requesting user is authenticated
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      logStep("No authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").replace("bearer ", "");
    const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authenticatedUser) {
      logStep("Authentication failed", { error: authError?.message });
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: authenticatedUser.id });

    const { company_id, lead_data, raw_text, confidence_score, user_id } = await req.json();

    // Validate lead_data
    if (!lead_data || typeof lead_data !== "object") {
      logStep("Invalid lead_data", { has_lead_data: !!lead_data });
      return new Response(
        JSON.stringify({ success: false, error: "lead_data fehlt oder ist ungültig" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Ensure the authenticated user matches the claimed user_id
    if (user_id && user_id !== authenticatedUser.id) {
      logStep("User ID mismatch", { claimed: user_id, actual: authenticatedUser.id });
      return new Response(
        JSON.stringify({ success: false, error: "User ID mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Starting import", { company_id, service_type: lead_data?.service_type });

    // Check company has manual import enabled AND user is a member
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, crm_enabled, default_language")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      logStep("Company not found", { company_id, error: companyError });
      return new Response(
        JSON.stringify({ success: false, error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Verify the authenticated user is a member of this company
    const isMember = await verifyCompanyMembership(supabase, authenticatedUser.id, company_id);
    if (!isMember) {
      logStep("Unauthorized: user is not a member of company", { userId: authenticatedUser.id, companyId: company_id });
      return new Response(
        JSON.stringify({ success: false, error: "You do not have access to this company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check access: crm_enabled flag
    if (!company.crm_enabled) {
      logStep("CRM not enabled", { company_id });
      return new Response(
        JSON.stringify({ success: false, error: "CRM-Zugang nicht aktiviert" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Access granted", { company_id });

    // Build lead insert object with all possible fields
    // Base fields for all service types
    const resolvedPlz = lead_data.from_plz || lead_data.plz || lead_data.zip || lead_data.pickup_plz || "";

    // DOCUMENT locale — start of the language propagation chain. The operator picked (or
    // confirmed the AI-detected) customer language in the import UI. An unsupported /
    // missing value degrades to the company default, and toLocale() to 'de' from there.
    const leadLanguage = isLocale(lead_data.language)
      ? lead_data.language
      : toLocale(company.default_language);

    const leadInsert: Record<string, unknown> = {
      company_id: company_id,
      language: leadLanguage,
      customer_first_name: lead_data.customer_first_name || "Unbekannt",
      customer_last_name: lead_data.customer_last_name || "Unbekannt",
      customer_email: lead_data.customer_email || "",
      customer_phone: lead_data.customer_phone || "",
      service_type: lead_data.service_type || "umzug_privat",
      preferred_date: lead_data.preferred_date || null,
      preferred_time_slot: lead_data.preferred_time_slot || null,
      description: lead_data.description || null,
      status: "pending",
      source: "import",
      from_plz: String(resolvedPlz).trim(),
      from_city: lead_data.from_city || lead_data.address_city || lead_data.pickup_city || "Unbekannt",
      form_version: 1,
      detailed_form_data: lead_data,
    };

    // Add service-specific fields based on service type
    const serviceType = lead_data.service_type || "umzug_privat";

    if (serviceType === "umzug_privat" || serviceType === "umzug_firma") {
      // Umzug fields
      Object.assign(leadInsert, {
        from_street: lead_data.from_street || null,
        from_house_number: lead_data.from_house_number || null,
        from_floor: lead_data.from_floor ?? null,
        from_has_lift: lead_data.from_has_lift ?? false,
        from_rooms: lead_data.from_rooms ?? null,
        from_living_space_m2: lead_data.from_living_space_m2 ?? null,
        to_street: lead_data.to_street || null,
        to_house_number: lead_data.to_house_number || null,
        to_plz: lead_data.to_plz || null,
        to_city: lead_data.to_city || null,
        to_floor: lead_data.to_floor ?? null,
        to_has_lift: lead_data.to_has_lift ?? false,
        packing_service_needed: lead_data.packing_service_needed ?? false,
        cleaning_service_needed: lead_data.cleaning_service_needed ?? false,
        storage_needed: lead_data.storage_needed ?? false,
      });
    } else if (serviceType === "reinigung") {
      // Reinigung fields
      Object.assign(leadInsert, {
        from_street: lead_data.from_street || null,
        from_house_number: lead_data.from_house_number || null,
        from_rooms: lead_data.from_rooms ?? null,
        from_living_space_m2: lead_data.from_living_space_m2 ?? null,
        property_type: lead_data.property_type || null,
        bathroom_count: lead_data.bathroom_count ?? null,
        kitchen_type: lead_data.kitchen_type || null,
        has_balcony: lead_data.has_balcony ?? false,
        has_garage: lead_data.has_garage ?? false,
        has_basement: lead_data.has_basement ?? false,
        has_attic: lead_data.has_attic ?? false,
      });
    } else if (serviceType === "raeumung") {
      // Räumung fields
      Object.assign(leadInsert, {
        from_street: lead_data.from_street || null,
        from_house_number: lead_data.from_house_number || null,
        from_rooms: lead_data.from_rooms ?? null,
        property_type: lead_data.property_type || null,
        clearing_type: lead_data.clearing_type || null,
        estimated_volume: lead_data.estimated_volume || null,
        has_heavy_items: lead_data.has_heavy_items ?? false,
        heavy_items_description: lead_data.heavy_items_description || null,
      });
    } else if (serviceType === "entsorgung") {
      // Entsorgung fields
      Object.assign(leadInsert, {
        from_street: lead_data.from_street || null,
        from_house_number: lead_data.from_house_number || null,
        disposal_type: lead_data.disposal_type || null,
        items_description: lead_data.items_description || null,
        estimated_volume: lead_data.estimated_volume || null,
      });
    } else if (serviceType === "lagerung") {
      // Lagerung fields
      Object.assign(leadInsert, {
        pickup_street: lead_data.pickup_street || null,
        pickup_house_number: lead_data.pickup_house_number || null,
        pickup_floor: lead_data.pickup_floor ?? null,
        pickup_has_lift: lead_data.pickup_has_lift ?? false,
        storage_duration: lead_data.storage_duration || null,
        storage_volume: lead_data.storage_volume || null,
        access_frequency: lead_data.access_frequency || null,
        needs_climate_control: lead_data.needs_climate_control ?? false,
        storage_items_description: lead_data.storage_items_description || null,
      });
    } else if (serviceType === "klaviertransport") {
      // Klaviertransport fields
      Object.assign(leadInsert, {
        from_street: lead_data.from_street || null,
        from_house_number: lead_data.from_house_number || null,
        from_floor: lead_data.from_floor ?? null,
        from_has_lift: lead_data.from_has_lift ?? false,
        to_street: lead_data.to_street || null,
        to_house_number: lead_data.to_house_number || null,
        to_plz: lead_data.to_plz || null,
        to_city: lead_data.to_city || null,
        to_floor: lead_data.to_floor ?? null,
        to_has_lift: lead_data.to_has_lift ?? false,
        piano_type: lead_data.piano_type || null,
        piano_brand: lead_data.piano_brand || null,
        piano_weight_kg: lead_data.piano_weight_kg ?? null,
        staircase_type: lead_data.staircase_type || null,
        staircase_width_cm: lead_data.staircase_width_cm ?? null,
        window_access_possible: lead_data.window_access_possible ?? false,
      });
    } else if (serviceType === "moebellift") {
      // Möbellift fields
      Object.assign(leadInsert, {
        from_street: lead_data.from_street || null,
        from_house_number: lead_data.from_house_number || null,
        moebellift_floor: lead_data.moebellift_floor ?? null,
        moebellift_item_description: lead_data.moebellift_item_description || null,
        moebellift_item_dimensions: lead_data.moebellift_item_dimensions || null,
      });
    }

    logStep("Inserting lead", { serviceType, leadInsert });

    // Insert the lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert(leadInsert)
      .select()
      .single();

    if (leadError) {
      logStep("Lead insert error", { error: leadError });
      return new Response(
        JSON.stringify({ success: false, error: `Datenbankfehler: ${leadError.message}` }),
        // 500, not 200 — a 200 makes functions.invoke report success, so the import UI
        // shows "imported" and never retries while the lead was silently lost.
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Import complete", { lead_id: lead.id });

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Unexpected error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
