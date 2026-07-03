import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  token: z.string().uuid("Ungültiger Bestätigungs-Token"),
});

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[confirm-lead-by-token] ${step}${d}`);
};

// Rate limit by IP (10/min)
const rateLimit = new Map<string, { count: number; resetAt: number }>();
function rateLimitCheck(key: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";
    if (!rateLimitCheck(ip)) {
      return new Response(
        JSON.stringify({ error: "Zu viele Versuche" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawBody = await req.json().catch(() => ({}));
    const parse = RequestSchema.safeParse(rawBody);
    if (!parse.success) {
      return new Response(
        JSON.stringify({
          success: false,
          status: "invalid_token",
          error: "Ungültiger Bestätigungs-Token",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { token } = parse.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load confirmation row
    const { data: conf, error: confErr } = await supabase
      .from("lead_confirmations")
      .select("id, lead_id, expires_at, confirmed_at")
      .eq("token", token)
      .maybeSingle();

    if (confErr) {
      logStep("DB error loading confirmation", { error: confErr.message });
      return new Response(
        JSON.stringify({ success: false, status: "error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!conf) {
      return new Response(
        JSON.stringify({ success: false, status: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Already confirmed?
    if (conf.confirmed_at) {
      logStep("Token already used", { lead_id: conf.lead_id });
      return new Response(
        JSON.stringify({ success: true, status: "already_confirmed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Expired?
    if (new Date(conf.expires_at).getTime() < Date.now()) {
      logStep("Token expired", { lead_id: conf.lead_id });
      return new Response(
        JSON.stringify({ success: false, status: "expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Both writes run in one transaction (atomic_confirm_lead RPC) so the confirmation and
    // the lead-status flip can't diverge — previously a failed flip left the lead stuck in
    // 'awaiting_customer_confirmation' while the token reported 'already_confirmed' on retry.
    const { error: confirmErr } = await supabase.rpc("atomic_confirm_lead", {
      p_confirmation_id: conf.id,
      p_lead_id: conf.lead_id,
    });

    if (confirmErr) {
      logStep("Failed to confirm lead", { error: confirmErr.message });
      return new Response(
        JSON.stringify({ success: false, status: "error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    logStep("Lead confirmed by customer", { lead_id: conf.lead_id });

    return new Response(
      JSON.stringify({ success: true, status: "confirmed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    logStep("Unexpected error", { error: (err as Error).message });
    return new Response(
      JSON.stringify({ success: false, status: "error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
