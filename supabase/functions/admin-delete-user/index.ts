import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdminAccess } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // SECURITY: Use shared admin auth with standardized role check
    // Only admin and super_admin can delete users
    const auth = await verifyAdminAccess(req, supabaseAdmin, ["admin", "super_admin"]);
    if (auth.error) return auth.error;
    
    const requestingUser = auth.user;
    console.log(`[admin-delete-user] Authorized: ${requestingUser.email} (role: ${auth.role})`);

    // Get the user ID to delete
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Benutzer-ID erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-deletion
    if (userId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: "Sie können sich nicht selbst löschen" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-delete-user] Deleting user: ${userId}`);

    // Capture company ids up front: companies.user_id is ON DELETE SET NULL, so once the
    // auth user is gone we can no longer locate them by user_id.
    const { data: companyRows } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("user_id", userId);
    const companyIds = (companyRows ?? []).map((c) => c.id);

    // Step 1: Delete the AUTH user first. If it fails we abort before destroying any app
    // data — otherwise a failed auth-delete would leave a still-loginable account whose
    // company/profile rows were already gone. profiles.id and user_roles.user_id are
    // ON DELETE CASCADE, so they are removed atomically only when this succeeds.
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("[admin-delete-user] Error deleting auth user:", authDeleteError);
      return new Response(
        JSON.stringify({ error: "Auth-Benutzer konnte nicht gelöscht werden: " + authDeleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: The auth delete only nulled companies.user_id (SET NULL); remove those rows
    // by their captured ids. Roles/profile were already cascade-deleted — the extra
    // user_roles cleanup below is a harmless no-op safety net.
    if (companyIds.length > 0) {
      const { error: companyDeleteError } = await supabaseAdmin
        .from("companies")
        .delete()
        .in("id", companyIds);
      if (companyDeleteError) {
        console.error("[admin-delete-user] Error deleting company:", companyDeleteError);
      }
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

    console.log(`[admin-delete-user] Successfully deleted user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Benutzer erfolgreich gelöscht" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin-delete-user] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Ein unerwarteter Fehler ist aufgetreten" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
