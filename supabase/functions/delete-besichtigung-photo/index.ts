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
    const { token, photo_id } = await req.json();

    if (!token || !photo_id) {
      return new Response(
        JSON.stringify({ error: "Token and photo_id are required" }),
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

    if (session.status === "completed" || session.status === "expired") {
      return new Response(
        JSON.stringify({ error: "Cannot delete photos from completed or expired sessions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete photo via RPC (returns storage_path for cleanup)
    const { data: deleted, error: deleteError } = await supabase.rpc(
      "delete_besichtigung_photo",
      { p_photo_id: photo_id }
    );

    if (deleteError || !deleted) {
      return new Response(
        JSON.stringify({ error: "Photo not found or could not be deleted", details: deleteError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean up storage
    if (deleted.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("besichtigung-uploads")
        .remove([deleted.storage_path]);

      if (storageError) {
        console.error("Storage delete error (non-fatal):", storageError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error deleting photo:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
