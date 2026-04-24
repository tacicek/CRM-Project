import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Zod Schema für Metadata-Validierung
const SessionMetadataSchema = z.object({
  company_id: z.string().uuid("Ungültige Firmen-ID"),
  total_tokens: z.string().regex(/^\d+$/, "total_tokens muss eine Zahl sein"),
  package_id: z.string().optional(),
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // SECURITY FIX: Webhook secret is REQUIRED in production
    if (!webhookSecret) {
      logStep("CRITICAL: STRIPE_WEBHOOK_SECRET not configured - rejecting request");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!signature) {
      logStep("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified");
    } catch (err) {
      logStep("Webhook signature verification failed", { error: String(err) });
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Initialize Supabase admin client (shared across handlers)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // =========================================================================
    // TOKEN PURCHASE: checkout.session.completed (mode: payment)
    // CRM SUBSCRIPTION: checkout.session.completed (mode: subscription)
    // =========================================================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      logStep("Processing checkout.session.completed", {
        sessionId: session.id,
        mode: session.mode,
        paymentStatus: session.payment_status,
        metadata: session.metadata,
      });

      // --- CRM Subscription checkout ---
      if (session.mode === "subscription") {
        const companyId = session.metadata?.company_id;
        if (!companyId) {
          logStep("No company_id in CRM subscription session metadata");
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

        logStep("CRM subscription checkout completed", { companyId, subscriptionId });

        // Activate CRM for 1 month (Stripe handles renewals via invoice events)
        const { error: extendError } = await supabaseAdmin.rpc("extend_subscription", {
          p_company_id: companyId,
          p_months: 1,
        });

        if (extendError) {
          logStep("extend_subscription error", { error: extendError.message });
          throw new Error(`extend_subscription failed: ${extendError.message}`);
        }

        // Store Stripe subscription ID + customer ID on company
        if (subscriptionId) {
          await supabaseAdmin
            .from("companies")
            .update({
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: session.customer as string,
            })
            .eq("id", companyId);
        }

        // Record the payment
        await supabaseAdmin.from("subscription_payments").insert({
          company_id: companyId,
          amount: (session.amount_total ?? 0) / 100,
          currency: (session.currency ?? "chf").toUpperCase(),
          payment_method: "stripe",
          payment_reference: session.id,
          subscription_months: 1,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          notes: `Stripe Checkout Session: ${session.id}`,
        });

        logStep("CRM subscription activated", { companyId, subscriptionId });

        // Send confirmation email via subscription-manager (BUG-10: AbortSignal timeout)
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/subscription-manager`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ action: "send_activation_email", company_id: companyId }),
            signal: AbortSignal.timeout(8000),
          });
        } catch (e) {
          logStep("Activation email failed (non-critical)", { error: String(e) });
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // --- Token purchase checkout ---
      if (session.payment_status === "paid") {
        const metadataResult = SessionMetadataSchema.safeParse(session.metadata);

        if (!metadataResult.success) {
          logStep("Invalid metadata in session", {
            metadata: session.metadata,
            errors: metadataResult.error.flatten(),
          });
          return new Response(
            JSON.stringify({ error: "Invalid session metadata" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { company_id: companyId, total_tokens, package_id: packageId } = metadataResult.data;
        const totalTokens = parseInt(total_tokens, 10);

        logStep("Crediting tokens", { companyId, totalTokens, packageId });

        // IDEMPOTENCY CHECK
        const { data: existingTxn } = await supabaseAdmin
          .from("token_transactions")
          .select("id")
          .eq("payment_reference", session.id)
          .eq("type", "purchase")
          .maybeSingle();

        if (existingTxn) {
          logStep("Duplicate webhook detected, already processed", { sessionId: session.id });
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        const { data: balanceResult, error: balanceError } = await supabaseAdmin.rpc(
          "atomic_adjust_token_balance",
          {
            p_company_id: companyId,
            p_amount: totalTokens,
            p_type: "purchase",
            p_description: "Token-Kauf via Stripe",
            p_payment_method: "stripe",
            p_payment_reference: session.id,
            p_reference_type: "stripe_session",
            p_reference_id: packageId || null,
          }
        );

        if (balanceError) {
          if (balanceError.message?.includes("duplicate") || balanceError.message?.includes("unique")) {
            logStep("Duplicate transaction prevented by unique index", { sessionId: session.id });
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          throw new Error(`Balance adjustment error: ${balanceError.message}`);
        }

        if (!balanceResult?.success) {
          throw new Error(balanceResult?.error || "Unknown balance adjustment error");
        }

        const currentBalance = balanceResult.previous_balance;
        const newBalance = balanceResult.new_balance;
        logStep("Company balance updated atomically", { currentBalance, newBalance, totalTokens });

        const { data: companyData } = await supabaseAdmin
          .from("companies")
          .select("company_name, email, notification_email")
          .eq("id", companyId)
          .single();

        let packageName = null;
        if (packageId) {
          const { data: packageData } = await supabaseAdmin
            .from("token_packages")
            .select("name")
            .eq("id", packageId)
            .single();
          packageName = packageData?.name;
        }

        if (companyData) {
          logStep("Sending token notification email", { email: companyData.notification_email || companyData.email });
          // Fire-and-forget — notification must never block or fail the webhook response
          fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-token-notification`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({
                companyId,
                type: "purchase",
                previousBalance: currentBalance,
                newBalance,
                amount: totalTokens,
                description: packageName ? `Token-Paket: ${packageName}` : "Token-Kauf via Kreditkarte",
              }),
              signal: AbortSignal.timeout(8000),
            }
          ).then((r) => {
            logStep("Token notification sent", { status: r.status });
          }).catch((emailError) => {
            logStep("Token notification failed (non-critical)", { error: String(emailError) });
          });
        }

        logStep("Token purchase completed successfully", { companyId, totalTokens, newBalance });
      } else {
        logStep("Payment not yet completed", { paymentStatus: session.payment_status });
      }

    // =========================================================================
    // CRM SUBSCRIPTION RENEWAL: invoice.payment_succeeded
    // =========================================================================
    } else if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;

      // Only handle subscription invoices (not one-off)
      if (!invoice.subscription) {
        logStep("Non-subscription invoice, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      // Skip the very first invoice — already handled by checkout.session.completed
      if (invoice.billing_reason === "subscription_create") {
        logStep("First subscription invoice, handled by checkout.session.completed — skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      const subscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;

      logStep("CRM subscription renewal invoice", { subscriptionId, billingReason: invoice.billing_reason });

      // BUG-1: Idempotency check — Stripe aynı invoice'ı birden fazla kez gönderebilir
      const { data: existingRenewalPayment } = await supabaseAdmin
        .from("subscription_payments")
        .select("id")
        .eq("payment_reference", invoice.id)
        .maybeSingle();

      if (existingRenewalPayment) {
        logStep("Duplicate renewal webhook, already processed", { invoiceId: invoice.id });
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id, company_name")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      if (!company) {
        logStep("No company found for subscription", { subscriptionId });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      // Extend CRM by 1 month
      await supabaseAdmin.rpc("extend_subscription", {
        p_company_id: company.id,
        p_months: 1,
      });

      // Record payment (uq_subscription_payment_reference constraint ikinci savunma katmanı)
      await supabaseAdmin.from("subscription_payments").insert({
        company_id: company.id,
        amount: (invoice.amount_paid ?? 0) / 100,
        currency: (invoice.currency ?? "chf").toUpperCase(),
        payment_method: "stripe",
        payment_reference: invoice.id,
        subscription_months: 1,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        notes: `Stripe Invoice Renewal: ${invoice.id}`,
      });

      logStep("CRM subscription renewed for 1 month", { companyId: company.id });

    // =========================================================================
    // CRM SUBSCRIPTION CANCELLED: customer.subscription.deleted
    // =========================================================================
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const subscriptionId = subscription.id;

      logStep("Subscription deleted", { subscriptionId });

      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id, company_name")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      if (company) {
        await supabaseAdmin
          .from("companies")
          .update({
            crm_enabled: false,
            subscription_type: "basic",
            stripe_subscription_id: null,
          })
          .eq("id", company.id);

        logStep("CRM deactivated after subscription cancellation", { companyId: company.id });
      }

    // =========================================================================
    // PAYMENT FAILED: invoice.payment_failed
    // =========================================================================
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.subscription) {
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      const subscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription)?.id;

      logStep("Payment failed for subscription", { subscriptionId });

      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      if (company) {
        // Trigger subscription-manager to send a payment failure reminder (BUG-10: AbortSignal timeout)
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/subscription-manager`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ action: "send_payment_failed_email", company_id: company.id }),
            signal: AbortSignal.timeout(8000),
          });
        } catch (e) {
          logStep("Payment failed email error (non-critical)", { error: String(e) });
        }
        logStep("Payment failed notification queued", { companyId: company.id });
      }

    } else {
      logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
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
