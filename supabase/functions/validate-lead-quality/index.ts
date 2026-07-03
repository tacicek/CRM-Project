import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createValidateLeadQualityPrompt } from "../_shared/prompts.ts";
import {
  validateLeadDeterministic,
  type DeterministicResult,
  type LeadValidationInput,
} from "../_shared/leadQualityValidator.ts";
// Confirmation URL — the React app (incl. /lead-bestaetigen/:token route) is
// only served from the dashboard host (e.g. https://${Deno.env.get("DASH_APP_URL") || ""}).
// The marketing site (offerio.ch) is a separate static frontend without this route.
function getConfirmationBaseUrl(): string {
  const raw =
    Deno.env.get("DASH_APP_URL")?.trim() ||
    Deno.env.get("FIRMA_APP_URL")?.trim() ||
    Deno.env.get("SITE_URL")?.trim() ||
    getDashAppUrl();
  return raw.replace(/\/+$/, "");
}
import {
  EMAIL_BODY_PADDING,
  EMAIL_CARD_OUTER,
  EMAIL_HEADER_BAND,
  wrapEmailDocument,
} from "../_shared/emailLayout.ts";

// -----------------------------------------------------------------------------
// CORS + schema
// -----------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Accept either UUID or slug (ANF-YYYY-NNNNNN) since submit_lead_json returns
// the slug to the customer and wizards forward that value here.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^ANF-\d{4}-\d{6}$/i;
const RequestSchema = z.object({
  lead_id: z
    .string()
    .min(1)
    .refine((v) => UUID_RE.test(v) || SLUG_RE.test(v), {
      message: "Ungültige Lead-ID (weder UUID noch Slug)",
    }),
});

// -----------------------------------------------------------------------------
// Rate limit (in-memory, per-instance)
// -----------------------------------------------------------------------------
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RL_MAX = 30;
const RL_WINDOW_MS = 60_000;

function rateLimitCheck(key: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return true;
  }
  if (entry.count >= RL_MAX) return false;
  entry.count++;
  return true;
}

// -----------------------------------------------------------------------------
// Logger
// -----------------------------------------------------------------------------
const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[validate-lead-quality] ${step}${d}`);
};

// -----------------------------------------------------------------------------
// AI fallback: VALIDATE_LEAD_QUALITY_PROMPT → Claude Haiku
// -----------------------------------------------------------------------------
interface AiResult {
  is_valid: boolean;
  quality_score: number;
  spam_signals: string[];
  rejection_reason: string | null;
}

async function callClaudeValidator(
  lead: LeadValidationInput,
  apiKey: string,
): Promise<AiResult | null> {
  try {
    const prompt = createValidateLeadQualityPrompt(lead as Record<string, unknown>);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      logStep("Claude error", { status: resp.status, body: await resp.text() });
      return null;
    }

    const data = await resp.json();
    const raw = data.content?.[0]?.text ?? "";
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const parsed = JSON.parse(clean);
    return {
      is_valid: Boolean(parsed.is_valid),
      quality_score: Math.max(0, Math.min(100, Number(parsed.quality_score ?? 0))),
      spam_signals: Array.isArray(parsed.spam_signals) ? parsed.spam_signals : [],
      rejection_reason: parsed.rejection_reason ?? null,
    };
  } catch (e) {
    logStep("Claude fallback failed", { error: (e as Error).message });
    return null;
  }
}

// -----------------------------------------------------------------------------
// Double opt-in e-mail
// -----------------------------------------------------------------------------
async function sendDoubleOptInEmail(
  resendApiKey: string,
  to: string,
  firstName: string | null,
  token: string,
  serviceType: string | null,
): Promise<boolean> {
  const resend = new Resend(resendApiKey);
  const confirmUrl = `${getConfirmationBaseUrl()}/lead-bestaetigen/${token}`;
  const greeting = firstName ? `Guten Tag ${firstName}` : "Guten Tag";

  const inner = `
    <div style="${EMAIL_CARD_OUTER}">
      <div style="${EMAIL_HEADER_BAND};text-align:center;">
        <h1 style="margin:0;font-size:20px;font-weight:600;color:#18181b;">
          Bitte bestätigen Sie Ihre Anfrage
        </h1>
      </div>
      <div style="${EMAIL_BODY_PADDING}">
        <p style="font-size:16px;margin-top:0;">${greeting},</p>
        <p>
          wir haben Ihre Anfrage erhalten${serviceType ? ` (<strong>${serviceType}</strong>)` : ""}.
          Zum Schutz vor Missbrauch benötigen wir eine kurze Bestätigung,
          dass diese Anfrage wirklich von Ihnen stammt.
        </p>
        <p>Bitte klicken Sie auf den folgenden Button, um Ihre Anfrage zu aktivieren:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${confirmUrl}"
             style="display:inline-block;background:#2d2d2d;color:#ffffff;text-decoration:none;padding:14px 28px;font-weight:600;border-radius:8px;">
            Anfrage bestätigen
          </a>
        </div>
        <p style="font-size:13px;color:#52525b;">
          Falls der Button nicht funktioniert, kopieren Sie bitte diesen Link in Ihren Browser:<br>
          <a href="${confirmUrl}" style="color:#2563eb;word-break:break-all;">${confirmUrl}</a>
        </p>
        <p style="font-size:13px;color:#52525b;">
          Der Link ist 48 Stunden gültig. Haben Sie keine Anfrage gestellt, ignorieren Sie diese E-Mail.
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:14px 0 0;font-size:12px;color:#71717a;">
      <p style="margin:0;">© ${new Date().getFullYear()} ${getAppName()}</p>
    </div>`;

  try {
    // resend.emails.send resolves with { error } instead of throwing — treat that as a failed
    // double opt-in so the lead isn't marked as sent while the customer waits forever.
    const { error } = await resend.emails.send({
      from: getDefaultFrom(),
      to: [to],
      subject: "Bitte bestätigen Sie Ihre Anfrage",
      html: wrapEmailDocument(inner),
    });
    if (error) {
      logStep("Resend send error", { error });
      return false;
    }
    return true;
  } catch (e) {
    logStep("Resend send error", { error: (e as Error).message });
    return false;
  }
}

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit by IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";
    if (!rateLimitCheck(ip)) {
      return new Response(
        JSON.stringify({ error: "Zu viele Anfragen" }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        },
      );
    }

    // Parse body
    const rawBody = await req.json().catch(() => ({}));
    const parse = RequestSchema.safeParse(rawBody);
    if (!parse.success) {
      return new Response(
        JSON.stringify({
          error: "Ungültige Eingabe",
          details: parse.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { lead_id } = parse.data;

    // Supabase client (service role)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load lead (accept both UUID and slug identifiers)
    const lookupCol = UUID_RE.test(lead_id) ? "id" : "slug";
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, status, created_at, ai_validated_at, " +
        "customer_first_name, customer_last_name, customer_email, customer_phone, " +
        "preferred_date, service_type, " +
        "from_plz, from_city, from_street, to_plz, to_city, to_street")
      .eq(lookupCol, lead_id)
      .single();

    if (leadErr || !lead) {
      logStep("Lead not found", { lead_id, error: leadErr?.message });
      return new Response(
        JSON.stringify({ error: "Lead nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Idempotency: already validated
    if (lead.ai_validated_at) {
      logStep("Already validated", { lead_id });
      return new Response(
        JSON.stringify({ success: true, already_validated: true, status: lead.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Freshness: don't validate leads older than 10 minutes (anti-replay)
    const createdAt = new Date(lead.created_at).getTime();
    if (Date.now() - createdAt > 10 * 60 * 1000) {
      logStep("Lead too old for auto-validation", { lead_id });
      return new Response(
        JSON.stringify({ error: "Lead zu alt für automatische Validierung" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    logStep("Starting validation", { lead_id, status: lead.status });

    // ---- Deterministic layer ---------------------------------------------
    const detInput: LeadValidationInput = {
      customer_first_name: lead.customer_first_name,
      customer_last_name: lead.customer_last_name,
      customer_email: lead.customer_email,
      customer_phone: lead.customer_phone,
      preferred_date: lead.preferred_date,
      service_type: lead.service_type,
      from_plz: lead.from_plz,
      from_city: lead.from_city,
      from_street: lead.from_street,
      to_plz: lead.to_plz,
      to_city: lead.to_city,
      to_street: lead.to_street,
    };

    const detResult: DeterministicResult = validateLeadDeterministic(detInput);
    logStep("Deterministic result", {
      verdict: detResult.verdict,
      score: detResult.qualityScore,
      signals: detResult.signals.length,
    });

    // ---- AI layer (only for ambiguous) -----------------------------------
    let finalScore = detResult.qualityScore;
    let finalSignals = [...detResult.signals];
    let finalValid = detResult.verdict !== "clearly_invalid";
    let finalReason = detResult.rejectionReason;

    if (detResult.verdict === "ambiguous") {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (apiKey) {
        const ai = await callClaudeValidator(detInput, apiKey);
        if (ai) {
          logStep("AI result", { is_valid: ai.is_valid, score: ai.quality_score });
          // Average the AI and deterministic scores, merge the signals
          finalScore = Math.round((detResult.qualityScore + ai.quality_score) / 2);
          finalSignals = Array.from(new Set([...finalSignals, ...ai.spam_signals]));
          finalValid = ai.is_valid;
          finalReason = ai.rejection_reason ?? finalReason;
        } else {
          logStep("AI unavailable, using deterministic only");
          // AI fail → fall back to the deterministic decision (if ambiguous, the safe side: opt-in)
          finalValid = detResult.qualityScore >= 40;
        }
      } else {
        logStep("ANTHROPIC_API_KEY missing, using deterministic only");
        finalValid = detResult.qualityScore >= 40;
      }
    }

    // ---- Routing decision ------------------------------------------------
    let newStatus: string;
    let doubleOptInSent = false;

    if (finalValid && detResult.verdict !== "clearly_invalid") {
      // Valid → normal flow
      newStatus = "pending_verification";
    } else {
      // Invalid → check whether we can email the customer
      if (detResult.emailCanReceive && lead.customer_email) {
        newStatus = "awaiting_customer_confirmation";
      } else {
        newStatus = "unconfirmed_risky";
      }
    }

    // ---- Persist validation to leads table -------------------------------
    const { error: updErr } = await supabase
      .from("leads")
      .update({
        status: newStatus,
        ai_quality_score: finalScore,
        ai_validation_signals: finalSignals,
        ai_validated_at: new Date().toISOString(),
        ai_rejected_reason: finalReason,
      })
      .eq("id", lead.id);

    if (updErr) {
      logStep("Update leads failed", { error: updErr.message });
      return new Response(
        JSON.stringify({ error: "DB-Update fehlgeschlagen" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Send double opt-in if needed ------------------------------------
    if (newStatus === "awaiting_customer_confirmation" && lead.customer_email) {
      // Create confirmation token
      const { data: conf, error: confErr } = await supabase
        .from("lead_confirmations")
        .insert({
          lead_id: lead.id,
          sent_to_email: lead.customer_email,
        })
        .select("token")
        .single();

      if (confErr || !conf) {
        logStep("Failed to create confirmation token", { error: confErr?.message });
      } else {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          doubleOptInSent = await sendDoubleOptInEmail(
            resendKey,
            lead.customer_email,
            lead.customer_first_name,
            conf.token,
            lead.service_type,
          );
        } else {
          logStep("RESEND_API_KEY missing — cannot send opt-in email");
        }
      }
    }

    logStep("Validation complete", {
      lead_id,
      newStatus,
      qualityScore: finalScore,
      doubleOptInSent,
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        quality_score: finalScore,
        signals: finalSignals,
        double_opt_in_sent: doubleOptInSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    logStep("Unexpected error", { error: (err as Error).message });
    return new Response(
      JSON.stringify({ error: "Unerwarteter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
