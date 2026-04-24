import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CRM-SUBSCRIPTION] ${step}${detailsStr}`);
};

const ALLOWED_ORIGINS = [
  "https://offerio.ch",
  "https://www.offerio.ch",
  "https://dash.offerio.ch",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const crmPriceId = Deno.env.get("STRIPE_CRM_PRICE_ID");
    if (!crmPriceId) throw new Error("STRIPE_CRM_PRICE_ID is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData.user?.email) throw new Error("Authentication failed");

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get company
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, company_name, email, stripe_customer_id, crm_enabled, subscription_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError || !company) throw new Error("Company not found");
    logStep("Company found", { companyId: company.id, companyName: company.company_name });

    // Check if already has active CRM subscription
    if (company.crm_enabled && company.subscription_expires_at) {
      const expires = new Date(company.subscription_expires_at);
      if (expires > new Date()) {
        return new Response(
          JSON.stringify({ error: "Bereits aktives CRM-Abonnement vorhanden" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Resolve or create Stripe customer
    let customerId = company.stripe_customer_id ?? undefined;

    if (!customerId) {
      // Search by email first
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
        logStep("Existing Stripe customer found", { customerId });
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: company.company_name,
          metadata: { company_id: company.id },
        });
        customerId = customer.id;
        logStep("New Stripe customer created", { customerId });
      }

      // Persist Stripe customer ID
      await supabaseAdmin
        .from("companies")
        .update({ stripe_customer_id: customerId })
        .eq("id", company.id);
    }

    // Determine success/cancel URLs
    const requestOrigin = req.headers.get("origin");
    const origin =
      requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
        ? requestOrigin
        : "https://dash.offerio.ch";

    // Create Stripe Checkout Session in subscription mode
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: crmPriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/firma/anfragen?crm_success=true`,
      cancel_url: `${origin}/firma/crm-upgrade?canceled=true`,
      subscription_data: {
        metadata: { company_id: company.id },
      },
      metadata: { company_id: company.id },
      locale: "de",
      billing_address_collection: "auto",
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
