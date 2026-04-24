/**
 * cleanup-besichtigung
 * 
 * Runs daily (triggered by pg_cron or Supabase cron).
 * 1. Calls cleanup_expired_besichtigung_data() RPC to get expired storage paths + delete DB rows
 * 2. Removes actual files from besichtigung-uploads storage bucket
 * 
 * This keeps the database and storage lean. Photos are deleted 3 days after
 * the linked offer is sent (or 30 days after session creation if no offer).
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[cleanup-besichtigung] Starting daily cleanup...");

    // Step 1: Call DB function → deletes rows, returns storage paths
    const { data: resultRaw, error: rpcError } = await supabase.rpc(
      "cleanup_expired_besichtigung_data"
    );

    if (rpcError) {
      console.error("[cleanup-besichtigung] RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: "Cleanup RPC failed", details: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = typeof resultRaw === "string" ? JSON.parse(resultRaw) : resultRaw;
    const storagePaths: string[] = result?.storage_paths || [];

    console.log(
      `[cleanup-besichtigung] DB cleanup done: ${result?.deleted_sessions || 0} sessions, ` +
      `${result?.deleted_photos || 0} photos. Storage paths to remove: ${storagePaths.length}`
    );

    // Step 2: Delete files from storage bucket
    let storageDeleted = 0;
    let storageErrors = 0;

    if (storagePaths.length > 0) {
      // Supabase storage .remove() accepts up to 1000 paths at once
      const BATCH_SIZE = 100;
      for (let i = 0; i < storagePaths.length; i += BATCH_SIZE) {
        const batch = storagePaths.slice(i, i + BATCH_SIZE).filter(Boolean);
        if (batch.length === 0) continue;

        const { data: removed, error: removeError } = await supabase.storage
          .from("besichtigung-uploads")
          .remove(batch);

        if (removeError) {
          console.warn(`[cleanup-besichtigung] Storage batch ${i} error:`, removeError.message);
          storageErrors += batch.length;
        } else {
          storageDeleted += removed?.length || batch.length;
        }
      }
    }

    const summary = {
      deleted_sessions: result?.deleted_sessions || 0,
      deleted_photos: result?.deleted_photos || 0,
      storage_files_deleted: storageDeleted,
      storage_errors: storageErrors,
      timestamp: new Date().toISOString(),
    };

    console.log("[cleanup-besichtigung] Cleanup complete:", JSON.stringify(summary));

    return new Response(
      JSON.stringify({ success: true, ...summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[cleanup-besichtigung] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
