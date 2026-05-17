import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[admin-add-company-member] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
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
    const { company_id, user_email, role = "member" } = await req.json();

    if (!company_id || !user_email) {
      return new Response(JSON.stringify({ error: "company_id and user_email are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["owner", "admin", "member"].includes(role)) {
      return new Response(JSON.stringify({ error: "role must be owner, admin, or member" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Adding member", { company_id, user_email, role, by: user.email });

    // ── Resolve user by email ──────────────────────────────
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      logStep("Failed to list users", { error: usersError.message });
      return new Response(JSON.stringify({ error: "Failed to look up user" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUser = users.users.find(
      (u) => u.email?.toLowerCase() === user_email.toLowerCase()
    );

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: `Kein Benutzer mit E-Mail "${user_email}" gefunden` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Verify company exists ──────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, company_name")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Insert membership (service_role bypasses RLS) ──────
    const { data: membership, error: insertError } = await supabase
      .from("company_members")
      .upsert(
        { company_id, user_id: targetUser.id, role },
        { onConflict: "company_id,user_id", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (insertError) {
      logStep("Insert failed", { error: insertError.message });
      return new Response(JSON.stringify({ error: "Failed to add member", details: insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Member added", { membership_id: membership.id, company: company.company_name, user: user_email });

    return new Response(
      JSON.stringify({
        success: true,
        membership,
        company_name: company.company_name,
        user_email: targetUser.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin-add-company-member] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
