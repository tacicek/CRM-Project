import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECAPTCHA_SECRET_KEY = Deno.env.get("RECAPTCHA_SECRET_KEY");
const RECAPTCHA_MIN_SCORE = 0.5; // Minimum score to pass (0.0 - 1.0)

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[verify-recaptcha] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action, remoteip } = await req.json();

    // If reCAPTCHA is not configured, skip verification
    if (!RECAPTCHA_SECRET_KEY) {
      logStep("reCAPTCHA not configured, skipping verification");
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true,
          message: "reCAPTCHA not configured" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Token is required if reCAPTCHA is enabled
    if (!token) {
      logStep("No token provided");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "reCAPTCHA token required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Verifying token", { action, hasRemoteIp: !!remoteip });

    // Verify with Google
    const verifyUrl = new URL("https://www.google.com/recaptcha/api/siteverify");
    verifyUrl.searchParams.set("secret", RECAPTCHA_SECRET_KEY);
    verifyUrl.searchParams.set("response", token);
    if (remoteip) {
      verifyUrl.searchParams.set("remoteip", remoteip);
    }

    const verifyResponse = await fetch(verifyUrl.toString(), {
      method: "POST",
    });

    const result: RecaptchaResponse = await verifyResponse.json();
    logStep("Verification result", result);

    // Check if verification succeeded
    if (!result.success) {
      logStep("Verification failed", result["error-codes"]);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "reCAPTCHA verification failed",
          errorCodes: result["error-codes"] 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check score (v3 only)
    const score = result.score || 1.0;
    if (score < RECAPTCHA_MIN_SCORE) {
      logStep("Score too low", { score, minRequired: RECAPTCHA_MIN_SCORE });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "reCAPTCHA score too low - possible bot detected",
          score 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check action matches (if provided)
    if (action && result.action && result.action !== action) {
      logStep("Action mismatch", { expected: action, received: result.action });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "reCAPTCHA action mismatch" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Verification successful", { score, action: result.action });

    return new Response(
      JSON.stringify({ 
        success: true, 
        score,
        action: result.action,
        hostname: result.hostname,
        timestamp: result.challenge_ts
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Error", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
