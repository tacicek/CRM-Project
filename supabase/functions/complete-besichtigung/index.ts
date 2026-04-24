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
    const { token, customer_notes } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token via RPC
    const { data: session, error: sessionError } = await supabase.rpc(
      "get_besichtigung_session_by_token",
      { p_token: token }
    );

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.status === "completed") {
      return new Response(
        JSON.stringify({ error: "Session is already completed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.status === "expired") {
      return new Response(
        JSON.stringify({ error: "Session has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check photo count via RPC
    const { data: photos } = await supabase.rpc(
      "get_besichtigung_photos",
      { p_session_id: session.id }
    );

    const photoCount = Array.isArray(photos) ? photos.length : 0;

    if (photoCount === 0) {
      return new Response(
        JSON.stringify({ error: "At least one photo is required to complete the session" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session status via RPC
    const { error: updateError } = await supabase.rpc(
      "update_besichtigung_session_status",
      {
        p_session_id: session.id,
        p_status: "uploaded",
        p_customer_notes: customer_notes || null,
      }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to complete session", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notify the company that the customer has uploaded photos
    try {
      const { data: sessionDetails } = await supabase
        .from("virtual_besichtigung_sessions")
        .select("company_id, address")
        .eq("id", session.id)
        .single();

      if (sessionDetails?.company_id) {
        const address = sessionDetails.address ? ` (${sessionDetails.address})` : "";
        await supabase.from("notifications").insert({
          company_id: sessionDetails.company_id,
          type: "besichtigung_uploaded",
          title: "Neue Fotos eingegangen",
          body: `Ihr Kunde hat ${photoCount} Foto${photoCount === 1 ? "" : "s"} für die virtuelle Besichtigung${address} hochgeladen.`,
          metadata: { session_id: session.id },
        });
      }
    } catch (notifyErr) {
      // Non-critical — log and continue
      console.error("Failed to insert notification:", notifyErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Session completed successfully",
        photo_count: photoCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error completing session:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
