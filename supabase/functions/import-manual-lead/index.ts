import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";
import { isLocale, toLocale } from "../_shared/i18n/locale.ts";
import { buildLeadInsert, type LeadSource } from "../_shared/leadMapping.ts";

/**
 * Sources this endpoint may write. The manual import is the default; 'email' is
 * the review-approve action of the inbound-email queue, which deliberately goes
 * through this same function instead of inserting leads on its own.
 */
const ALLOWED_SOURCES: LeadSource[] = ["import", "email"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[import-manual-lead] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Verify the requesting user is authenticated
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      logStep("No authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").replace("bearer ", "");
    const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authenticatedUser) {
      logStep("Authentication failed", { error: authError?.message });
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: authenticatedUser.id });

    const {
      company_id,
      lead_data,
      raw_text,
      confidence_score,
      user_id,
      source,
      inbound_email_id,
    } = await req.json();

    // An unknown value must not silently become 'import' — that would file a
    // mail-sourced lead under the wrong origin.
    if (source !== undefined && !ALLOWED_SOURCES.includes(source)) {
      logStep("Invalid source", { source });
      return new Response(
        JSON.stringify({ success: false, error: "Ungültige Lead-Quelle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const leadSource: LeadSource = source ?? "import";

    // Validate lead_data
    if (!lead_data || typeof lead_data !== "object") {
      logStep("Invalid lead_data", { has_lead_data: !!lead_data });
      return new Response(
        JSON.stringify({ success: false, error: "lead_data fehlt oder ist ungültig" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Ensure the authenticated user matches the claimed user_id
    if (user_id && user_id !== authenticatedUser.id) {
      logStep("User ID mismatch", { claimed: user_id, actual: authenticatedUser.id });
      return new Response(
        JSON.stringify({ success: false, error: "User ID mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Starting import", { company_id, service_type: lead_data?.service_type });

    // Check company has manual import enabled AND user is a member
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, crm_enabled, default_language")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      logStep("Company not found", { company_id, error: companyError });
      return new Response(
        JSON.stringify({ success: false, error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Verify the authenticated user is a member of this company
    const isMember = await verifyCompanyMembership(supabase, authenticatedUser.id, company_id);
    if (!isMember) {
      logStep("Unauthorized: user is not a member of company", { userId: authenticatedUser.id, companyId: company_id });
      return new Response(
        JSON.stringify({ success: false, error: "You do not have access to this company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check access: crm_enabled flag
    if (!company.crm_enabled) {
      logStep("CRM not enabled", { company_id });
      return new Response(
        JSON.stringify({ success: false, error: "CRM-Zugang nicht aktiviert" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Access granted", { company_id });

    // Build the lead row

    // DOCUMENT locale — start of the language propagation chain. The operator picked (or
    // confirmed the AI-detected) customer language in the import UI. An unsupported /
    // missing value degrades to the company default, and toLocale() to 'de' from there.
    const leadLanguage = isLocale(lead_data.language)
      ? lead_data.language
      : toLocale(company.default_language);

    // Feld-Zuordnung liegt in _shared/leadMapping.ts: die Inbound-E-Mail-Pipeline
    // und die Review-Freigabe müssen Leads exakt so schreiben wie dieser Import.
    const serviceType = lead_data.service_type || "umzug_privat";
    const leadInsert = buildLeadInsert(lead_data, {
      companyId: company_id,
      language: leadLanguage,
      source: leadSource,
    });

    logStep("Inserting lead", { serviceType, leadInsert });

    // Review-Freigabe aus der Inbound-Queue: Lead anlegen UND die Mail damit
    // verknüpfen gehören zusammen. Getrennte Anweisungen hinterlassen bei einem
    // Abbruch dazwischen einen Lead, dessen Mail auf 'processing' hängen bleibt —
    // in der Review-Oberfläche unsichtbar und ohne die "es gibt schon einen
    // Lead"-Sperre. Die Funktion prüft ausserdem selbst, dass die Zeile zu dieser
    // Firma gehört; der Service-Role-Client umgeht RLS.
    let leadId: string;

    if (inbound_email_id) {
      const { data, error: rpcError } = await supabase.rpc("create_lead_from_inbound_email", {
        p_inbound_id: inbound_email_id,
        p_company_id: company_id,
        p_lead: leadInsert,
        p_outcome: {},
      });

      if (rpcError || !data) {
        logStep("Lead insert error (inbound)", { error: rpcError });
        return new Response(
          JSON.stringify({ success: false, error: `Datenbankfehler: ${rpcError?.message ?? "kein Lead"}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      leadId = data as string;
    } else {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert(leadInsert)
        .select()
        .single();

      if (leadError) {
        logStep("Lead insert error", { error: leadError });
        return new Response(
          JSON.stringify({ success: false, error: `Datenbankfehler: ${leadError.message}` }),
          // 500, not 200 — a 200 makes functions.invoke report success, so the import UI
          // shows "imported" and never retries while the lead was silently lost.
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      leadId = lead.id;
    }

    logStep("Import complete", { lead_id: leadId, source: leadSource });

    return new Response(
      JSON.stringify({ success: true, lead_id: leadId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Unexpected error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
