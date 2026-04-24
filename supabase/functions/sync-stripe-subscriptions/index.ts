/**
 * sync-stripe-subscriptions
 *
 * Fetches the live status of every Stripe subscription linked to a company
 * and reconciles it with the Supabase `companies` table.
 *
 * Called by: Admin panel "Stripe Sync" button (POST, no body required).
 * Auth: Supabase service-role key — only reachable from authenticated admin users.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[STRIPE-SYNC] ${step}${details ? " — " + JSON.stringify(details) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ------------------------------------------------------------------
    // 1. Fetch all companies that have a Stripe subscription ID
    // ------------------------------------------------------------------
    const { data: companies, error: dbErr } = await supabase
      .from("companies")
      .select("id, company_name, stripe_subscription_id, stripe_customer_id, crm_enabled, subscription_type, subscription_expires_at")
      .not("stripe_subscription_id", "is", null);

    if (dbErr) throw new Error(`DB query failed: ${dbErr.message}`);
    if (!companies || companies.length === 0) {
      log("No companies with Stripe subscriptions found");
      return new Response(JSON.stringify({ synced: 0, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    log("Companies to sync", { count: companies.length });

    // ------------------------------------------------------------------
    // 2. Fetch each Stripe subscription and reconcile
    // ------------------------------------------------------------------
    const results: Array<{
      company_id: string;
      company_name: string;
      stripe_subscription_id: string;
      stripe_status: string;
      action: string;
      error?: string;
    }> = [];

    for (const company of companies) {
      const subId = company.stripe_subscription_id as string;
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        log("Stripe subscription fetched", { subId, status: sub.status });

        const stripeStatus = sub.status; // active | past_due | canceled | unpaid | trialing | paused | incomplete | incomplete_expired
        const currentPeriodEnd = new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString();

        let action = "no_change";

        if (stripeStatus === "active" || stripeStatus === "trialing") {
          // Subscription is healthy — ensure CRM is enabled and expiry is in sync
          const { error: updateErr } = await supabase
            .from("companies")
            .update({
              crm_enabled: true,
              subscription_type: "crm",
              subscription_expires_at: currentPeriodEnd,
            })
            .eq("id", company.id);

          if (updateErr) throw new Error(updateErr.message);
          action = "synced_active";

        } else if (stripeStatus === "past_due" || stripeStatus === "unpaid") {
          // Grace period — keep CRM enabled but flag expiry
          const { error: updateErr } = await supabase
            .from("companies")
            .update({
              subscription_expires_at: currentPeriodEnd,
            })
            .eq("id", company.id);

          if (updateErr) throw new Error(updateErr.message);
          action = "synced_past_due";

        } else if (
          stripeStatus === "canceled" ||
          stripeStatus === "incomplete_expired"
        ) {
          // Subscription is dead — deactivate CRM
          const { error: updateErr } = await supabase
            .from("companies")
            .update({
              crm_enabled: false,
              subscription_type: "basic",
              stripe_subscription_id: null,
            })
            .eq("id", company.id);

          if (updateErr) throw new Error(updateErr.message);
          action = "deactivated";
        }

        results.push({
          company_id: company.id,
          company_name: company.company_name,
          stripe_subscription_id: subId,
          stripe_status: stripeStatus,
          action,
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log("Error syncing subscription", { subId, error: msg });
        results.push({
          company_id: company.id,
          company_name: company.company_name,
          stripe_subscription_id: subId,
          stripe_status: "error",
          action: "error",
          error: msg,
        });
      }
    }

    const synced = results.filter((r) => r.action !== "error").length;
    log("Sync complete", { synced, total: companies.length });

    return new Response(JSON.stringify({ synced, total: companies.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("FATAL ERROR", { error: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
