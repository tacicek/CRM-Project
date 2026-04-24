/**
 * admin-assign-lead
 *
 * Allows a super-admin to manually assign a lead (typically in "no_matches" or
 * "unknown_plz" status) to one or more specific companies with a custom token cost.
 *
 * POST /functions/v1/admin-assign-lead
 * Auth: Supabase Bearer JWT (admin only — verified via user role check)
 *
 * Body:
 * {
 *   lead_id: string (uuid),
 *   assignments: [{ company_id: string (uuid), token_cost: number }]
 * }
 *
 * Response:
 * { distributed: number, skipped: number }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdminAccess } from "../_shared/adminAuth.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: Record<string, unknown>) =>
  console.log(`[ADMIN-ASSIGN-LEAD] ${step}${d ? " — " + JSON.stringify(d) : ""}`);

const RequestSchema = z.object({
  lead_id: z.string().uuid("Ungültige Lead-ID"),
  assignments: z
    .array(
      z.object({
        company_id: z.string().uuid("Ungültige Firmen-ID"),
        token_cost: z.number().int().min(1).max(500),
      })
    )
    .min(1, "Mindestens eine Firma muss ausgewählt sein"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // -------------------------------------------------------------------------
    // 1. Authenticate caller — must be a logged-in admin/owner/staff
    // -------------------------------------------------------------------------
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const auth = await verifyAdminAccess(req, supabaseAdmin, ["admin", "super_admin", "staff"]);
    if (auth.error) return auth.error;

    log("Admin authenticated", { userId: auth.user.id, role: auth.role });

    // -------------------------------------------------------------------------
    // 2. Parse & validate body
    // -------------------------------------------------------------------------
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Ungültige Eingabe", details: parsed.error.flatten() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { lead_id, assignments } = parsed.data;
    log("Processing assignment", { lead_id, count: assignments.length });

    // -------------------------------------------------------------------------
    // 3. Load the lead — must exist
    // -------------------------------------------------------------------------
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("id, slug, status, service_type, token_cost, max_companies")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead nicht gefunden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    log("Lead found", { slug: lead.slug, status: lead.status, max_companies: lead.max_companies });

    // -------------------------------------------------------------------------
    // 3b. Quota check — count active distributions (sent + accepted)
    // -------------------------------------------------------------------------
    const maxCompanies = lead.max_companies || 5;
    const { count: activeDistCount } = await supabaseAdmin
      .from("lead_distributions")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead_id)
      .in("status", ["sent", "accepted"]);

    const currentActive = activeDistCount ?? 0;
    const remainingSlots = maxCompanies - currentActive;

    log("Quota check", { maxCompanies, currentActive, remainingSlots, requested: assignments.length });

    if (assignments.length > remainingSlots) {
      return new Response(
        JSON.stringify({
          error: `Kontingent überschritten: ${remainingSlots} Platz${remainingSlots === 1 ? "" : "e"} frei, ${assignments.length} angefordert`,
          remainingSlots,
          maxCompanies,
          currentActive,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // 4. Insert distributions (skip existing ones via ON CONFLICT DO NOTHING)
    // -------------------------------------------------------------------------
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48h for manually assigned

    let distributed = 0;
    let skipped = 0;

    for (const assignment of assignments) {
      const { error: insertErr } = await supabaseAdmin
        .from("lead_distributions")
        .insert({
          lead_id,
          company_id: assignment.company_id,
          token_cost: assignment.token_cost,
          status: "sent",
          sent_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });

      if (insertErr) {
        // Unique constraint violation = already distributed to this company
        if (insertErr.code === "23505") {
          log("Skipped (already exists)", { company_id: assignment.company_id });
          skipped++;
        } else {
          log("Insert error", { company_id: assignment.company_id, error: insertErr.message });
          skipped++;
        }
      } else {
        distributed++;
        log("Distribution created", { company_id: assignment.company_id, token_cost: assignment.token_cost });
      }
    }

    // -------------------------------------------------------------------------
    // 5. Update lead status to "distributed" if at least one was sent
    // -------------------------------------------------------------------------
    if (distributed > 0) {
      await supabaseAdmin
        .from("leads")
        .update({
          status: "distributed",
          verified_by: auth.user.id,
          verified_at: now.toISOString(),
        })
        .eq("id", lead_id);

      log("Lead status updated to distributed", { lead_id });

      // -----------------------------------------------------------------------
      // 6. Trigger notification emails for newly distributed companies
      // -----------------------------------------------------------------------
      try {
        await fetch(`${supabaseUrl}/functions/v1/notify-companies`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ leadId: lead_id }),
        });
        log("Notification emails triggered");
      } catch (e) {
        log("Notification email failed (non-critical)", { error: String(e) });
      }
    }

    log("Done", { distributed, skipped });

    return new Response(
      JSON.stringify({ distributed, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("FATAL", { error: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
