import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session via public schema RPC wrapper
    const { data: session, error: sessionError } = await supabase.rpc(
      "get_besichtigung_session_by_token",
      { p_token: token }
    );

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found", details: sessionError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side expiry enforcement — expires_at geçtiyse veri döndürme.
    // 410 Gone: süresi dolmuş kaynak için semantik olarak doğru HTTP kodu.
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session abgelaufen" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("id, company_name, logo_url, primary_color")
      .eq("id", session.company_id)
      .single();

    // Get photos via RPC
    const { data: photos } = await supabase.rpc(
      "get_besichtigung_photos",
      { p_session_id: session.id }
    );

    // Get videos via RPC
    const { data: videos } = await supabase.rpc(
      "get_besichtigung_videos",
      { p_session_id: session.id }
    );

    const publicSession = {
      id: session.id,
      status: session.status,
      customer_name: session.customer_name,
      from_address: session.from_address,
      from_plz: session.from_plz,
      from_city: session.from_city,
      expires_at: session.expires_at,
      company: company
        ? {
            name: company.company_name,
            logo_url: company.logo_url,
            primary_color: company.primary_color,
          }
        : null,
      photos: photos || [],
      videos: videos || [],
    };

    return new Response(
      JSON.stringify({ session: publicSession }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error validating token:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
