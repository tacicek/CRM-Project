/**
 * match-lead Edge Function
 * 
 * Distributes verified leads to matching companies based on service type,
 * location, and sharing preferences. Sends email/in-app notifications.
 * 
 * Refactored: Business logic extracted to shared modules.
 * Previous: ~1200 lines -> Current: ~350 lines
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Shared modules
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getServiceDisplayLabel, normalizeServiceTypeForMatching } from "../_shared/serviceLabels.ts";
import { calculateLeadPrice } from "../_shared/pricing.ts";
import { buildCompanyLeadNotificationEmail, buildAdminDistributionSummaryEmail, buildCustomerConfirmationEmail } from "../_shared/emailTemplates.ts";
import { getDashboardAppBaseUrl } from "../_shared/dashboardAppUrl.ts";
import type { Lead, MatchedCompany } from "../_shared/types.ts";

const { logStep } = createLogger("match-lead");

// BUG-8: PII maskeleme yardımcıları — loglar DSG/DSGVO uyumlu
const maskEmail = (e: string) => e.replace(/(?<=.{2}).+(?=@)/, "***");
const maskPhone = (p: string) => p.slice(0, 4) + "***";

// Input validation
const MatchLeadRequestSchema = z.object({
  lead_id: z.string().uuid("Ungültige Lead-ID"),
});

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key: key,
    p_window_ms: windowMs,
    p_max_requests: maxRequests,
  });

  if (error) {
    logStep("Rate limiter RPC failed, allowing request", { key, error: error.message });
    return false;
  }

  const result = Array.isArray(data) ? data[0] : data;
  return Boolean(result?.is_limited);
}

// Auth verification: accepts internal secret or admin/service JWT only.
// SEC-4: anon key path removed — anon key is public (exposed in frontend bundle)
// and must not be treated as authorization for sensitive operations like lead distribution.
const verifyCallerAuth = async (req: Request, supabase: ReturnType<typeof createClient>): Promise<{ authorized: boolean; source: string }> => {
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const providedSecret = req.headers.get("x-internal-secret");
  if (internalSecret && providedSecret && providedSecret === internalSecret) {
    return { authorized: true, source: "internal_service" };
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "").replace("bearer ", "");
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) return { authorized: true, source: `user:${user.id}` };
    } catch { /* fall through */ }
  }

  return { authorized: false, source: "unknown" };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. VALIDATE INPUT
    const rawBody = await req.json();
    const parseResult = MatchLeadRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Ungültige Eingabedaten", details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { lead_id } = parseResult.data;

    // 2. INIT SUPABASE
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. RATE LIMITING (persistent DB-backed)
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const isGlobalLimited = await checkRateLimit(supabase, `global:${clientIp}`, 60_000, 30);
    if (isGlobalLimited) {
      logStep("Global rate limit exceeded", { clientIp });
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isLeadLimited = await checkRateLimit(supabase, `lead:${lead_id}`, 300_000, 5);
    if (isLeadLimited) {
      logStep("Per-lead rate limit exceeded", { lead_id });
      return new Response(
        JSON.stringify({ error: "This lead has been processed recently. Please wait." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. AUTH CHECK
    const authResult = await verifyCallerAuth(req, supabase);
    if (!authResult.authorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    logStep("Authorized", { source: authResult.source });

    // 5. FETCH LEAD
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        id, slug, service_type, from_plz, to_plz, token_cost, token_cost_overridden, max_companies,
        from_city, to_city, from_rooms, from_living_space_m2, preferred_date,
        packing_service_needed, cleaning_service_needed, storage_needed,
        piano_type, piano_weight_kg, staircase_type, staircase_turns,
        moebellift_floor, status, detailed_form_data,
        customer_first_name, customer_last_name, customer_email, customer_phone
      `)
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. STATUS CHECK
    if (lead.status !== "verified" && lead.status !== "distributed") {
      if (lead.status === "new") {
        await supabase.from("leads").update({ status: "pending_verification" }).eq("id", lead_id);
      }
      return new Response(
        JSON.stringify({ success: false, message: `Lead is not verified (status: '${lead.status}')`, requires_verification: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. PRICING
    const normalizedServiceType = normalizeServiceTypeForMatching(lead.service_type);
    logStep("Service type", { original: lead.service_type, normalized: normalizedServiceType });

    // If admin manually overrode the token cost, respect it — do NOT recalculate.
    let calculatedTokenCost: number;
    if ((lead as Record<string, unknown>).token_cost_overridden && lead.token_cost > 0) {
      calculatedTokenCost = lead.token_cost;
      logStep("Using admin-overridden token cost", { token_cost: calculatedTokenCost });
    } else {
      calculatedTokenCost = await calculateLeadPrice(supabase, lead as Lead, logStep);
    }

    // Estimate job price (BUG-6: AbortSignal timeout — 5s, non-fatal)
    let estimatedJobPrice = { min_price: 0, max_price: 0, confidence: "low" };
    try {
      const estimateController = new AbortController();
      const estimateTimeout = setTimeout(() => estimateController.abort(), 5000);
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/estimate-job-price`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({ lead_id }),
          signal: estimateController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.estimate) estimatedJobPrice = data.estimate;
        }
      } finally {
        clearTimeout(estimateTimeout);
      }
    } catch { /* non-fatal — match-lead continues without estimate */ }

    // Update lead with pricing (skip token_cost update if admin overrode it)
    // SCH-2: token_cost_overridden artık types.ts'te — type-safe erişim
    const leadUpdate: Record<string, unknown> = (lead as { token_cost_overridden?: boolean }).token_cost_overridden
      ? {}
      : { token_cost: calculatedTokenCost };
    if (estimatedJobPrice.min_price > 0) {
      leadUpdate.estimated_job_price_min = estimatedJobPrice.min_price;
      leadUpdate.estimated_job_price_max = estimatedJobPrice.max_price;
      leadUpdate.estimated_job_price_confidence = estimatedJobPrice.confidence || "medium";
    }
    await supabase.from("leads").update(leadUpdate).eq("id", lead_id);

    // 8. FIND MATCHING COMPANIES (primary + geographic fallback)
    const { data: primaryMatches, error: matchError } = await supabase
      .rpc("find_companies_in_radius", {
        target_plz: lead.from_plz,
        service_type_filter: normalizedServiceType,
        max_results: 100,
      });

    if (matchError) {
      return new Response(
        JSON.stringify({ error: "Error finding companies" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let effectiveCompanies: MatchedCompany[] = primaryMatches as MatchedCompany[] || [];
    let usedFallback = false;

    if (effectiveCompanies.length === 0) {
      // Distinguish between "PLZ unknown" and "no companies cover this area"
      const { data: plzRecord } = await supabase
        .from("swiss_plz")
        .select("plz, city")
        .eq("plz", lead.from_plz)
        .maybeSingle();

      if (!plzRecord) {
        logStep("WARNING: PLZ not found in swiss_plz — lead cannot be matched", {
          from_plz: lead.from_plz,
          lead_id,
          service_type: lead.service_type,
        });
        await supabase.from("leads").update({ status: "unknown_plz" }).eq("id", lead_id);
        return new Response(
          JSON.stringify({
            success: false,
            message: `PLZ ${lead.from_plz} nicht in der Datenbank gefunden. Lead kann nicht zugeordnet werden.`,
            from_plz: lead.from_plz,
            matched_count: 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // PLZ is known but no companies have declared coverage — try geographic fallback (30 km)
      logStep("Primary match empty — trying geographic fallback (30 km)", {
        from_plz: lead.from_plz,
        city: plzRecord.city,
        service_type: lead.service_type,
      });

      const { data: fallbackMatches, error: fallbackError } = await supabase
        .rpc("find_companies_fallback", {
          target_plz: lead.from_plz,
          service_type_filter: normalizedServiceType,
          fallback_radius_km: 30,
          max_results: 100,
        });

      if (fallbackError || !fallbackMatches || fallbackMatches.length === 0) {
        logStep("Fallback also returned no results", { from_plz: lead.from_plz });
        await supabase.from("leads").update({ status: "no_matches" }).eq("id", lead_id);
        return new Response(
          JSON.stringify({ success: true, message: "No matching companies found", matched_count: 0, token_cost: calculatedTokenCost }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      logStep(`Fallback found ${fallbackMatches.length} companies within 30 km`, { from_plz: lead.from_plz });
      effectiveCompanies = fallbackMatches as MatchedCompany[];
      usedFallback = true;
    }

    // 9. FILTER BY SHARING PREFERENCE
    const companyIds = effectiveCompanies.map(c => c.company_id);
    const { data: companyPreferences } = await supabase
      .from("companies")
      .select("id, lead_sharing_preference")
      .in("id", companyIds);

    const prefMap = new Map<string, string>();
    companyPreferences?.forEach((c: { id: string; lead_sharing_preference: string | null }) => {
      prefMap.set(c.id, c.lead_sharing_preference || "both");
    });

    const leadMaxCompanies = lead.max_companies || 5;
    const filteredCompanies = effectiveCompanies.filter((company) => {
      const pref = prefMap.get(company.company_id) || "both";
      // Threshold-based logic: preference defines MAXIMUM competition tolerated
      // only_1: receives ONLY exclusive (1-company) leads
      // only_3: receives exclusive (1) AND premium (3) leads  [leadMaxCompanies <= 3]
      // only_4: receives leads with max 4 companies  [leadMaxCompanies <= 4]
      // only_5/both: receives ALL leads (legacy only_5 treated same as both)
      if (pref === "both" || pref === "only_5") return true;
      if (pref === "only_4" && leadMaxCompanies <= 4) return true;
      if (pref === "only_1" && leadMaxCompanies === 1) return true;
      if (pref === "only_3" && leadMaxCompanies <= 3) return true;
      return false;
    });

    const selectedCompanies = filteredCompanies;
    logStep(`Selected ${selectedCompanies.length} companies`);

    if (selectedCompanies.length === 0) {
      // Companies were found geographically but all filtered out by lead_sharing_preference.
      // Only mark no_matches if lead has no existing distributions (first-time distribution).
      const existingCount = (await supabase
        .from("lead_distributions")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead_id)
      ).count ?? 0;
      if (existingCount === 0) {
        await supabase.from("leads").update({ status: "no_matches" }).eq("id", lead_id);
        logStep("No companies after sharing preference filter — marked no_matches", { lead_id });
      }
      return new Response(
        JSON.stringify({ success: true, message: "No matching companies found", matched_count: 0, token_cost: calculatedTokenCost }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 10. DEDUP - SKIP ALREADY DISTRIBUTED
    const { data: existingDistributions } = await supabase
      .from("lead_distributions")
      .select("company_id")
      .eq("lead_id", lead_id);

    const existingCompanyIds = new Set((existingDistributions || []).map((d: { company_id: string }) => d.company_id));
    const newCompanies = selectedCompanies.filter(c => !existingCompanyIds.has(c.company_id));

    if (newCompanies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Lead already distributed", matched_count: existingCompanyIds.size, token_cost: calculatedTokenCost, already_distributed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 11. CREATE DISTRIBUTIONS
    const distributions = newCompanies.map((company) => ({
      lead_id,
      company_id: company.company_id,
      status: "sent",
      token_cost: calculatedTokenCost,
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }));

    const { data: insertedDists, error: insertError } = await supabase.from("lead_distributions").insert(distributions).select("id, company_id");
    if (insertError) {
      // B6: UNIQUE (lead_id, company_id) ihlali — lead zaten dağıtılmış, graceful yanıt döndür
      if (insertError.code === "23505") {
        logStep("Duplicate distribution prevented by unique index (concurrent call)", { lead_id });
        return new Response(
          JSON.stringify({ success: true, message: "Lead already distributed", already_distributed: true, token_cost: calculatedTokenCost }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Error creating distributions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("leads")
      .update({ status: usedFallback ? "fallback_distributed" : "distributed" })
      .eq("id", lead_id);

    // Build distribution ID lookup per company
    const distIdByCompany = new Map<string, string>();
    if (insertedDists) {
      for (const d of insertedDists) {
        distIdByCompany.set(d.company_id, d.id);
      }
    }

    // 12. IN-APP NOTIFICATIONS
    const serviceLabel = getServiceDisplayLabel(lead.service_type);
    const locationInfo = lead.to_city ? `von ${lead.from_city} nach ${lead.to_city}` : `in ${lead.from_city}`;

    const notifications = newCompanies.map((company) => ({
      company_id: company.company_id,
      type: "new_lead",
      title: `Neue Anfrage: ${serviceLabel}`,
      body: `Sie haben eine neue ${serviceLabel}-Anfrage ${locationInfo} erhalten. Kosten: ${calculatedTokenCost} Tokens`,
      metadata: {
        lead_id, service_type: lead.service_type, from_city: lead.from_city, to_city: lead.to_city,
        token_cost: calculatedTokenCost,
        estimated_price_min: estimatedJobPrice?.min_price || 0,
        estimated_price_max: estimatedJobPrice?.max_price || 0,
      },
      read: false,
    }));
    await supabase.from("notifications").insert(notifications);

    // 13. EMAIL NOTIFICATIONS
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appBaseUrl = getDashboardAppBaseUrl();
    const dashboardUrl = `${appBaseUrl}/firma/anfragen`;
    let emailsSent = 0;

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      const emailPromises = newCompanies.map(async (company) => {
        const recipientEmail = company.notification_email || company.email;
        const distanceText = company.distance_km === 0 ? "Exakter PLZ-Treffer" : `${company.distance_km?.toFixed(1)} km Entfernung`;
        const distributionId = distIdByCompany.get(company.company_id) || "";
        const acceptUrl = distributionId ? `${appBaseUrl}/firma/anfragen?accept=${distributionId}` : "";

        try {
          const instLabels: Record<string, string> = {
            "klavier": "Klavier (aufrecht)",
            "flügel-klein": "Flügel (klein)",
            "flügel-gross": "Flügel (gross)",
            "sonstiges": "Sonstiges",
          };
          const dfd = lead.detailed_form_data as Record<string, unknown> | null;
          const instrumentType =
            lead.service_type === "klaviertransport" && dfd?.inst
              ? (instLabels[dfd.inst as string] ?? String(dfd.inst))
              : undefined;

          const html = buildCompanyLeadNotificationEmail({
            companyName: company.company_name,
            serviceLabel,
            locationInfo,
            distanceText,
            tokenCost: calculatedTokenCost,
            dashboardUrl,
            acceptUrl,
            lead: { ...lead, instrument_type: instrumentType },
            estimatedJobPrice,
          });

          await resend.emails.send({
            from: "Offerio <noreply@offerio.ch>",
            to: [recipientEmail],
            subject: `Neue Anfrage: ${serviceLabel} ${locationInfo}`,
            html,
          });
          return { success: true, email: recipientEmail };
        } catch (err) {
          logStep(`Email failed: ${recipientEmail}`, err);
          return { success: false, email: recipientEmail };
        }
      });

      const results = await Promise.all(emailPromises);
      emailsSent = results.filter(r => r.success).length;

      // 14. ADMIN SUMMARY EMAIL (background)
      const adminResend = new Resend(resendApiKey);
      Promise.resolve().then(async () => {
        try {
          const html = buildAdminDistributionSummaryEmail({
            serviceLabel,
            locationInfo,
            lead,
            tokenCost: calculatedTokenCost,
            emailsSent,
            selectedCompaniesCount: selectedCompanies.length,
            companies: newCompanies,
          });

          await adminResend.emails.send({
            from: "Offerio <noreply@offerio.ch>",
            to: ["info@offerio.ch"],
            subject: `Lead verteilt: ${serviceLabel} ${locationInfo} - ${selectedCompanies.length} Firmen`,
            html,
          });
        } catch (err) {
          logStep("Admin email failed", err);
        }
      }).catch(() => {});
    }

    // 15. CUSTOMER CONFIRMATION EMAIL (background, only for first distribution)
    if (resendApiKey && lead.customer_email && existingCompanyIds.size === 0) {
      const customerResend = new Resend(resendApiKey);
      Promise.resolve().then(async () => {
        try {
          const html = buildCustomerConfirmationEmail({
            customerFirstName: lead.customer_first_name,
            customerLastName: lead.customer_last_name,
            serviceLabel,
            locationInfo,
            matchedCompanies: newCompanies.length,
            lead,
          });

          await customerResend.emails.send({
            from: "Offerio <noreply@offerio.ch>",
            to: [lead.customer_email],
            subject: `Ihre ${serviceLabel}-Anfrage wurde an ${newCompanies.length} Firmen weitergeleitet`,
            html,
          });
          logStep("Customer confirmation email sent", { to: maskEmail(lead.customer_email) });
        } catch (err) {
          logStep("Customer confirmation email failed", err);
        }
      }).catch(() => {});
    }

    // 16. RESPONSE
    return new Response(
      JSON.stringify({
        success: true,
        matched_count: newCompanies.length,
        previously_distributed: existingCompanyIds.size,
        total_companies: selectedCompanies.length,
        token_cost: calculatedTokenCost,
        emails_sent: emailsSent,
        companies: newCompanies.map(c => ({
          company_id: c.company_id,
          company_name: c.company_name,
          distance_km: c.distance_km,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[match-lead] Unhandled error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
