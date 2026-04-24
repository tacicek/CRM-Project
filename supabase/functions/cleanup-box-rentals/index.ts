import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("[cleanup-box-rentals] Starting cleanup job");

  try {
    // Step 1: Archive returned boxes older than 3 months
    const { data: archivedData, error: archiveError } = await supabase.rpc("archive_returned_boxes");

    if (archiveError) {
      throw archiveError;
    }

    const archivedCount = archivedData || 0;
    console.log(`[cleanup-box-rentals] Archived ${archivedCount} boxes`);

    // Step 2: Delete archived boxes older than 3 months
    const { data: deletedData, error: deleteError } = await supabase.rpc("cleanup_archived_boxes");

    if (deleteError) {
      throw deleteError;
    }

    const deletedCount = deletedData || 0;
    console.log(`[cleanup-box-rentals] Deleted ${deletedCount} archived boxes`);

    return new Response(
      JSON.stringify({
        success: true,
        archived: archivedCount,
        deleted: deletedCount,
        message: `Archived ${archivedCount} boxes, deleted ${deletedCount} archived boxes`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[cleanup-box-rentals] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

