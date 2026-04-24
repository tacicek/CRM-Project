import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RECOVER-STRIPE-PURCHASE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Admin authentication check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { checkout_session_id } = await req.json();
    if (!checkout_session_id || typeof checkout_session_id !== "string") {
      return new Response(JSON.stringify({ error: "checkout_session_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Recovery request", { sessionId: checkout_session_id, adminUser: user.email });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // 1. Fetch the session from Stripe
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(checkout_session_id);
    } catch (err) {
      logStep("Stripe session not found", { error: String(err) });
      return new Response(
        JSON.stringify({ error: `Stripe session not found: ${String(err)}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Stripe session retrieved", {
      id: session.id,
      mode: session.mode,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
    });

    // 2. Validate this is a token purchase
    if (session.mode !== "payment") {
      return new Response(
        JSON.stringify({ error: `Session mode is '${session.mode}', not 'payment'. Only token purchases can be recovered here.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({
          error: `Payment not completed. Status: '${session.payment_status}'. Only paid sessions can be recovered.`,
          payment_status: session.payment_status,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Extract and validate metadata
    const companyId = session.metadata?.company_id;
    const totalTokensStr = session.metadata?.total_tokens;
    const packageId = session.metadata?.package_id;

    if (!companyId || !totalTokensStr) {
      return new Response(
        JSON.stringify({
          error: "Session metadata missing company_id or total_tokens",
          metadata: session.metadata,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalTokens = parseInt(totalTokensStr, 10);
    if (isNaN(totalTokens) || totalTokens <= 0) {
      return new Response(
        JSON.stringify({ error: `Invalid total_tokens: ${totalTokensStr}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check if already processed (idempotency)
    const { data: existingTxn } = await supabaseAdmin
      .from("token_transactions")
      .select("id, created_at, balance_after")
      .eq("payment_reference", session.id)
      .eq("type", "purchase")
      .maybeSingle();

    if (existingTxn) {
      logStep("Already processed — no action needed", { txnId: existingTxn.id });
      return new Response(
        JSON.stringify({
          status: "already_processed",
          message: "Diese Zahlung wurde bereits verarbeitet. Tokens wurden dem Konto gutgeschrieben.",
          transaction_id: existingTxn.id,
          processed_at: existingTxn.created_at,
          balance_after: existingTxn.balance_after,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Verify company exists
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, company_name, email, notification_email, token_balance")
      .eq("id", companyId)
      .maybeSingle();

    if (!company) {
      return new Response(
        JSON.stringify({ error: `Company not found: ${companyId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Crediting tokens", {
      companyId,
      companyName: company.company_name,
      totalTokens,
      currentBalance: company.token_balance,
    });

    // 6. Credit tokens atomically
    const { data: balanceResult, error: balanceError } = await supabaseAdmin.rpc(
      "atomic_adjust_token_balance",
      {
        p_company_id: companyId,
        p_amount: totalTokens,
        p_type: "purchase",
        p_description: "Token-Kauf via Stripe (manuell wiederhergestellt)",
        p_payment_method: "stripe",
        p_payment_reference: session.id,
        p_reference_type: "stripe_session",
        p_reference_id: packageId || null,
      }
    );

    if (balanceError) {
      logStep("Balance adjustment error", { error: balanceError.message });
      throw new Error(`Balance adjustment failed: ${balanceError.message}`);
    }

    const result = balanceResult as { success: boolean; error?: string; previous_balance: number; new_balance: number } | null;

    if (!result?.success) {
      throw new Error(result?.error || "Unknown balance adjustment error");
    }

    logStep("Recovery successful", {
      companyId,
      companyName: company.company_name,
      tokensAdded: totalTokens,
      previousBalance: result.previous_balance,
      newBalance: result.new_balance,
    });

    // 7. Send notification (non-blocking)
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-token-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          companyId,
          type: "purchase",
          previousBalance: result.previous_balance,
          newBalance: result.new_balance,
          amount: totalTokens,
          description: "Token-Kauf via Stripe (manuell wiederhergestellt)",
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (emailErr) {
      logStep("Notification email failed (non-critical)", { error: String(emailErr) });
    }

    return new Response(
      JSON.stringify({
        status: "recovered",
        message: `${totalTokens} Tokens wurden dem Konto von "${company.company_name}" gutgeschrieben.`,
        company_name: company.company_name,
        tokens_credited: totalTokens,
        previous_balance: result.previous_balance,
        new_balance: result.new_balance,
        session_id: session.id,
        amount_paid: (session.amount_total ?? 0) / 100,
        currency: (session.currency ?? "chf").toUpperCase(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("Unhandled error", { error: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
