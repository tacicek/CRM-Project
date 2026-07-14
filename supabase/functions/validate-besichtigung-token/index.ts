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

    // Server-side expiry enforcement — don't return data if expires_at has passed.
    // 410 Gone: semantically correct HTTP code for an expired resource.
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session abgelaufen" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("id, company_name, logo_url, primary_color, default_language")
      .eq("id", session.company_id)
      .single();

    // DOKUMENT-Sprache der Besichtigungsseite.
    //
    // Der Kunde lädt hier Fotos hoch — die Seite muss in SEINER Sprache erscheinen,
    // nicht in der der Firma. Die Session kennt weder eine eigene Sprache noch gibt
    // die RPC lead_id/offer_id an den Client weiter, also wird sie hier serverseitig
    // aufgelöst: Offerte (eingefroren) vor Lead vor Firmen-Default.
    const resolveSessionLanguage = async (): Promise<string> => {
      if (session.offer_id) {
        const { data: offer } = await supabase
          .from("offers")
          .select("language")
          .eq("id", session.offer_id)
          .maybeSingle();
        if (offer?.language) return offer.language;
      }
      if (session.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("language")
          .eq("id", session.lead_id)
          .maybeSingle();
        if (lead?.language) return lead.language;
      }
      return company?.default_language ?? "de";
    };

    const language = await resolveSessionLanguage();

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
      // lead_id / offer_id bleiben bewusst draussen (der Client braucht sie nicht und
      // sie sind interne IDs) — nur die daraus abgeleitete Sprache wird durchgereicht.
      language,
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
