import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[admin-remove-company-member] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Admin authentication ───────────────────────────────
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admins can call this function
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["super_admin", "admin"])
      .maybeSingle();

    if (!roleData) {
      logStep("Unauthorized: caller is not admin", { userId: user.id });
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Input validation ───────────────────────────────────
    const { company_id, user_id } = await req.json();

    if (!company_id || !user_id) {
      return new Response(JSON.stringify({ error: "company_id and user_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Removing member", { company_id, user_id, by: user.email });

    // ── Prevent removing the last owner ───────────────────
    const { data: membership } = await supabase
      .from("company_members")
      .select("role")
      .eq("company_id", company_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (membership?.role === "owner") {
      const { count } = await supabase
        .from("company_members")
        .select("*", { count: "exact", head: true })
        .eq("company_id", company_id)
        .eq("role", "owner");

      if ((count ?? 0) <= 1) {
        return new Response(
          JSON.stringify({ error: "Letzter Inhaber kann nicht entfernt werden" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Delete membership (service_role bypasses RLS) ──────
    const { error: deleteError } = await supabase
      .from("company_members")
      .delete()
      .eq("company_id", company_id)
      .eq("user_id", user_id);

    if (deleteError) {
      logStep("Delete failed", { error: deleteError.message });
      return new Response(JSON.stringify({ error: "Failed to remove member", details: deleteError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Member removed", { company_id, user_id });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin-remove-company-member] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
