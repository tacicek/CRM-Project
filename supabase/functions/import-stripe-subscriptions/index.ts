/**
 * import-stripe-subscriptions
 *
 * Fetches ALL active Stripe subscriptions, matches each one to a company
 * by the customer's e-mail address, and writes stripe_customer_id +
 * stripe_subscription_id back to the companies table.
 *
 * Also records a subscription_payments row for every matched subscription
 * that has no existing payment record with the same Stripe subscription ID.
 *
 * POST /functions/v1/import-stripe-subscriptions
 * Auth: Supabase service-role via admin panel only.
 *
 * Response JSON:
 * {
 *   matched:   number,          // companies successfully linked
 *   skipped:   number,          // already up-to-date
 *   unmatched: StripeRow[],     // subscriptions whose e-mail has no company
 *   errors:    string[],
 * }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: Record<string, unknown>) =>
  console.log(`[STRIPE-IMPORT] ${step}${d ? " — " + JSON.stringify(d) : ""}`);

interface StripeRow {
  subscription_id: string;
  customer_id: string;
  customer_email: string | null;
  status: string;
  current_period_end: string;
  amount: number;
  currency: string;
}

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
    // 0. Verify Stripe connection & key mode
    // ------------------------------------------------------------------
    const keyMode = stripeKey.startsWith("sk_live_") ? "live" : "test";
    log("Stripe key mode", { mode: keyMode, prefix: stripeKey.slice(0, 12) + "..." });

    // Quick account check
    try {
      const account = await stripe.accounts.retrieve();
      log("Stripe account", { id: account.id, country: account.country });
    } catch (e) {
      log("Account check failed (restricted key?)", { error: String(e) });
    }

    // ------------------------------------------------------------------
    // 1. Collect all Stripe subscriptions (paginate through all pages)
    // ------------------------------------------------------------------
    const stripeRows: StripeRow[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const page = await stripe.subscriptions.list({
        limit: 100,
        status: "all",
        expand: ["data.customer"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const sub of page.data) {
        const customer = sub.customer as Stripe.Customer | null;
        const email = typeof customer === "object" && customer !== null
          ? customer.email
          : null;
        const item = sub.items?.data?.[0];
        const amount = item?.price?.unit_amount ?? 0;
        const currency = item?.price?.currency ?? sub.currency ?? "chf";

        stripeRows.push({
          subscription_id: sub.id,
          customer_id: typeof sub.customer === "string" ? sub.customer : (sub.customer as Stripe.Customer).id,
          customer_email: email,
          status: sub.status,
          current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
          amount: amount / 100,
          currency: currency.toUpperCase(),
        });
      }

      hasMore = page.has_more;
      if (hasMore && page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id;
      }
    }

    log("Stripe subscriptions fetched", { count: stripeRows.length });

    if (stripeRows.length === 0) {
      // Try listing customers to confirm key works
      let customerCount = 0;
      try {
        const customers = await stripe.customers.list({ limit: 1 });
        customerCount = customers.data.length;
      } catch { /* ignore */ }

      return new Response(
        JSON.stringify({
          matched: 0,
          skipped: 0,
          unmatched: [],
          errors: [],
          diagnostic: {
            key_mode: keyMode,
            key_prefix: stripeKey.slice(0, 12) + "...",
            subscriptions_found: 0,
            customers_found: customerCount,
            hint: customerCount === 0
              ? "Stripe hesabında hiç müşteri bulunamadı. Key modu kontrol edin (test vs live)."
              : `${customerCount} müşteri bulundu fakat abonelik yok.`,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // 2. Load all companies (id, email, stripe_subscription_id)
    // ------------------------------------------------------------------
    const { data: companies, error: dbErr } = await supabase
      .from("companies")
      .select("id, email, stripe_customer_id, stripe_subscription_id, crm_enabled, subscription_type");

    if (dbErr) throw new Error(`DB error: ${dbErr.message}`);

    const companyByEmail = new Map<string, typeof companies[0]>();
    for (const c of companies ?? []) {
      if (c.email) companyByEmail.set(c.email.toLowerCase().trim(), c);
    }

    // ------------------------------------------------------------------
    // 3. Match & update
    // ------------------------------------------------------------------
    let matched = 0;
    let skipped = 0;
    const unmatched: StripeRow[] = [];
    const errors: string[] = [];

    for (const row of stripeRows) {
      const email = row.customer_email?.toLowerCase().trim();
      if (!email) {
        unmatched.push(row);
        continue;
      }

      const company = companyByEmail.get(email);
      if (!company) {
        unmatched.push(row);
        continue;
      }

      // Already linked to the same subscription → skip
      if (company.stripe_subscription_id === row.subscription_id) {
        skipped++;
        continue;
      }

      try {
        // Update company stripe IDs and activate CRM if subscription is active
        const isActive = row.status === "active" || row.status === "trialing";
        const updatePayload: Record<string, unknown> = {
          stripe_customer_id: row.customer_id,
          stripe_subscription_id: row.subscription_id,
          subscription_expires_at: row.current_period_end,
        };
        if (isActive) {
          updatePayload.crm_enabled = true;
          updatePayload.subscription_type = "crm";
        }

        const { error: updateErr } = await supabase
          .from("companies")
          .update(updatePayload)
          .eq("id", company.id);

        if (updateErr) throw new Error(updateErr.message);

        // Record a payment if not already recorded for this subscription
        const { data: existingPayment } = await supabase
          .from("subscription_payments")
          .select("id")
          .eq("company_id", company.id)
          .eq("payment_reference", row.subscription_id)
          .maybeSingle();

        if (!existingPayment && row.amount > 0) {
          await supabase.from("subscription_payments").insert({
            company_id: company.id,
            amount: row.amount,
            currency: row.currency,
            payment_method: "stripe",
            payment_reference: row.subscription_id,
            subscription_months: 1,
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
            notes: `Importiert aus Stripe — Status: ${row.status}`,
          });
        }

        matched++;
        log("Matched", { email, company_id: company.id, subscription_id: row.subscription_id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${email}: ${msg}`);
        log("Error updating company", { email, error: msg });
      }
    }

    log("Import complete", { matched, skipped, unmatched: unmatched.length, errors: errors.length });

    return new Response(
      JSON.stringify({ matched, skipped, unmatched, errors }),
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
