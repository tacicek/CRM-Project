import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Check company has manual import enabled AND belongs to the authenticated user
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, manual_import_enabled, user_id, crm_enabled, subscription_type, subscription_expires_at")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      logStep("Company not found", { company_id, error: companyError });
      return new Response(
        JSON.stringify({ success: false, error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Verify the authenticated user owns this company
    if (company.user_id !== authenticatedUser.id) {
      logStep("Unauthorized: user does not own company", { userId: authenticatedUser.id, companyOwner: company.user_id });
      return new Response(
        JSON.stringify({ success: false, error: "You do not have access to this company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check access: either manual_import_enabled flag OR active CRM subscription
    const hasCrmActive = (() => {
      if (!company.crm_enabled) return false;
      const type = company.subscription_type ?? "";
      if (!["crm", "trial", "enterprise"].includes(type)) return false;
      if (company.subscription_expires_at) {
        if (new Date(company.subscription_expires_at) < new Date()) return false;
      }
      return true;
    })();

    if (!company.manual_import_enabled && !hasCrmActive) {
      logStep("Manual import not enabled", { company_id, manual_import_enabled: company.manual_import_enabled, hasCrmActive });
      return new Response(
        JSON.stringify({ success: false, error: "Manual import not enabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Access granted", { via: company.manual_import_enabled ? "manual_import_enabled" : "crm_subscription" });

    // Build lead insert object with all possible fields
    // Base fields for all service types
    const resolvedPlz = lead_data.from_plz || lead_data.plz || lead_data.zip || lead_data.pickup_plz || "";
    const leadInsert: Record<string, unknown> = {
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
      // Store complete lead data for detailed view
      form_version: 1, // 1 = manual import, 2 = wizard form
      detailed_form_data: lead_data, // Store ALL data as JSON for flexible display
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Lead created", { lead_id: lead.id });

    // Track the imported lead (non-critical - log but don't fail)
    const { error: trackError } = await supabase
      .from("manual_imported_leads")
      .insert({
        company_id: company_id,
        lead_id: lead.id,
        raw_import_text: raw_text,
        ai_confidence_score: confidence_score,
        imported_by: user_id,
      });
    if (trackError) {
      logStep("manual_imported_leads insert failed (non-critical)", { error: trackError });
    }

    // Create a lead_distribution record so it appears in Anfragen
    const { data: distribution, error: distError } = await supabase
      .from("lead_distributions")
      .insert({
        lead_id: lead.id,
        company_id: company_id,
        status: "accepted", // Auto-accepted since it's their own import
        sent_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
        token_cost: 0, // No cost for imported leads
        token_charged: false,
      })
      .select()
      .single();

    if (distError) {
      logStep("Distribution insert error - rolling back lead", { error: distError, lead_id: lead.id });
      await supabase.from("leads").delete().eq("id", lead.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Anfrage konnte nicht zugeordnet werden. Bitte versuchen Sie es erneut.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Distribution created", { distribution_id: distribution?.id });

    // FIX: Update import count correctly - fetch current count and increment
    const { data: subscription } = await supabase
      .from("manual_import_subscriptions")
      .select("id, total_imports_count")
      .eq("company_id", company_id)
      .eq("status", "active")
      .single();

    if (subscription) {
      await supabase
        .from("manual_import_subscriptions")
        .update({ 
          total_imports_count: (subscription.total_imports_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", subscription.id);
      
      logStep("Import count updated", { subscription_id: subscription.id });
    }

    logStep("Import complete", { lead_id: lead.id, distribution_id: distribution?.id });

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id, distribution_id: distribution?.id }),
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
