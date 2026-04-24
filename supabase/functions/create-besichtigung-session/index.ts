import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      company_id,
      customer_name,
      customer_email,
      customer_phone,
      lead_id,
      offer_id,
      from_address,
      from_plz,
      from_city,
      expires_days = 30,
      app_origin,
    } = await req.json();

    // Validate required fields
    if (!company_id || !customer_name) {
      return new Response(
        JSON.stringify({ error: "company_id and customer_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client (public schema - we use raw SQL for besichtigung schema)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Require a valid user token from caller
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Malformed Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid or expired user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    userId = user.id;

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, company_name")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create session via public schema RPC wrapper
    // (PostgREST only exposes 'public' schema, so we call a wrapper function
    //  that inserts into besichtigung.sessions internally)
    const { data: session, error: sessionError } = await supabase.rpc(
      "create_besichtigung_session",
      {
        p_company_id: company_id,
        p_customer_name: customer_name,
        p_customer_email: customer_email || null,
        p_customer_phone: customer_phone || null,
        p_lead_id: lead_id || null,
        p_offer_id: offer_id || null,
        p_from_address: from_address || null,
        p_from_plz: from_plz || null,
        p_from_city: from_city || null,
        p_expires_days: expires_days,
        p_created_by: userId,
      }
    );

    if (sessionError) {
      console.error("Error creating session via RPC:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session", details: sessionError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build URL from caller origin when available (useful for localhost testing)
    // Fallback to configured public app URL for production calls.
    const origin = typeof app_origin === "string" ? app_origin.trim() : "";
    const baseUrl = origin || Deno.env.get("PUBLIC_APP_URL") || "https://offerio.ch";
    const url = `${baseUrl}/besichtigung/${session.token}`;

    return new Response(
      JSON.stringify({
        session,
        url,
        token: session.token,
        expires_at: session.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating besichtigung session:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
