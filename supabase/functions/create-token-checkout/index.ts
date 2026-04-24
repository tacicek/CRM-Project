import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-TOKEN-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Create Supabase client for user auth
    const supabaseClient = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { packageId } = await req.json();
    if (!packageId) throw new Error("Package ID is required");
    logStep("Package ID received", { packageId });

    // Create admin client to fetch package and company data
    const supabaseAdmin = createClient(supabaseUrl ?? "", supabaseServiceKey ?? "");

    // Get company for the user
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError) throw new Error(`Company fetch error: ${companyError.message}`);
    if (!company) throw new Error("No company found for this user");
    logStep("Company found", { companyId: company.id, companyName: company.company_name });

    // Get the token package
    const { data: tokenPackage, error: packageError } = await supabaseAdmin
      .from("token_packages")
      .select("*")
      .eq("id", packageId)
      .eq("is_active", true)
      .maybeSingle();

    if (packageError) throw new Error(`Package fetch error: ${packageError.message}`);
    if (!tokenPackage) throw new Error("Token package not found or inactive");
    if (!tokenPackage.stripe_price_id) throw new Error("Stripe price not configured for this package");
    logStep("Token package found", { 
      name: tokenPackage.name, 
      priceId: tokenPackage.stripe_price_id,
      tokens: tokenPackage.tokens_included + (tokenPackage.bonus_tokens || 0)
    });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check if a Stripe customer record exists for this user
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing Stripe customer found", { customerId });
    } else {
      logStep("No existing Stripe customer, will create during checkout");
    }

    // Calculate total tokens
    const totalTokens = tokenPackage.tokens_included + (tokenPackage.bonus_tokens || 0);

    // SECURITY: Validate origin against whitelist to prevent redirect attacks
    const ALLOWED_ORIGINS = [
      "https://offerio.ch",
      "https://www.offerio.ch",
      "https://dash.offerio.ch",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8080",
    ];
    
    const requestOrigin = req.headers.get("origin");
    const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) 
      ? requestOrigin 
      : "https://dash.offerio.ch";
    
    logStep("Origin validation", { requestOrigin, resolvedOrigin: origin, isWhitelisted: requestOrigin === origin });
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: tokenPackage.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/firma/tokens?success=true&tokens=${totalTokens}`,
      cancel_url: `${origin}/firma/tokens?canceled=true`,
      metadata: {
        company_id: company.id,
        package_id: tokenPackage.id,
        tokens_included: tokenPackage.tokens_included.toString(),
        bonus_tokens: (tokenPackage.bonus_tokens || 0).toString(),
        total_tokens: totalTokens.toString(),
      },
      // Branding & UX improvements
      locale: "de",
      payment_method_types: ["card"],
      billing_address_collection: "auto",
      submit_type: "pay",
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
