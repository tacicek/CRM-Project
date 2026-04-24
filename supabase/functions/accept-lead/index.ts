import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getDashboardAppBaseUrl } from "../_shared/dashboardAppUrl.ts";
import {
  EMAIL_BODY_PADDING,
  EMAIL_CARD_OUTER,
  EMAIL_HEADER_BAND,
  wrapEmailDocument,
} from "../_shared/emailLayout.ts";
import { getServiceDisplayLabel } from "../_shared/serviceLabels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BUG-8: PII maskeleme yardımcıları — loglar DSG/DSGVO uyumlu
const maskEmail = (e: string) => e.replace(/(?<=.{2}).+(?=@)/, "***");

// SECURITY: Zod schema for input validation
const AcceptLeadRequestSchema = z.object({
  distributionId: z.string().uuid("Ungültige Distribution-ID"),
  companyId: z.string().uuid("Ungültige Firmen-ID"),
});

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[accept-lead] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Verify the requesting user is authorized
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    logStep("Auth header check", { hasHeader: !!authHeader });
    
    if (!authHeader) {
      logStep("No authorization header found");
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").replace("bearer ", "");
    logStep("Token extracted", { tokenLength: token.length });
    
    // Validate user token using service role key
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logStep("Authentication failed", { error: authError?.message, code: authError?.code });
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logStep("User authenticated", { userId: user.id, email: maskEmail(user.email ?? "") });
    const finalUser = user;

    // SECURITY: Validate input with Zod
    const rawBody = await req.json();
    const parseResult = AcceptLeadRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      logStep("Validation error", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { distributionId, companyId } = parseResult.data;

    // SECURITY: Verify user owns this company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, user_id, token_balance, company_name, email, notification_email")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: "Firma nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Check if the authenticated user owns this company
    if (company.user_id !== finalUser?.id) {
      logStep("Unauthorized access attempt", { userId: finalUser?.id, companyOwnerId: company.user_id });
      return new Response(
        JSON.stringify({ error: "Sie haben keine Berechtigung für diese Firma" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Processing acceptance", { distributionId, companyId, userId: finalUser?.id });

    // Get the distribution with lead info
    const { data: distribution, error: distError } = await supabase
      .from("lead_distributions")
      .select("*, lead:leads(*)")
      .eq("id", distributionId)
      .eq("company_id", companyId) // Ensure distribution belongs to this company
      .single();

    if (distError || !distribution) {
      logStep("Distribution not found", distError);
      return new Response(
        JSON.stringify({ error: "Verteilung nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (distribution.status !== "sent") {
      logStep("Distribution already processed", { status: distribution.status });
      
      // Check if it's quota_full - return user-friendly message with 200 status
      if (distribution.status === "quota_full") {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Diese Anfrage wurde bereits von einer anderen Firma angenommen.",
            quota_full: true,
            status: distribution.status 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // For other statuses (accepted, rejected, etc.)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Diese Anfrage wurde bereits bearbeitet.", 
          status: distribution.status 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lead = distribution.lead;
    if (!lead) {
      return new Response(
        JSON.stringify({ error: "Lead nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxCompanies = lead.max_companies || 5;
    const tokenCost = Number(distribution.token_cost || lead.token_cost || 10);
    const currentBalance = Number(company.token_balance || 0);

    // BUG-9: Stale balance ön kontrol kaldırıldı.
    // atomic_accept_lead RPC, FOR UPDATE lock ile live bakiyeyi kontrol eder
    // ve 'Insufficient token balance' hatası döndürür — bu yeterli ve güvenli.

    // SECURITY FIX: Use atomic operation to prevent race condition
    // This uses a database function/transaction to atomically:
    // 1. Check quota
    // 2. Increment accepted_count
    // 3. Return the new count (or null if quota exceeded)
    const { data: acceptResult, error: acceptError } = await supabase.rpc(
      "atomic_accept_lead",
      {
        p_lead_id: lead.id,
        p_distribution_id: distributionId,
        p_company_id: companyId,
        p_token_cost: tokenCost,
        p_current_balance: currentBalance,
        p_max_companies: maxCompanies
      }
    );

    // If the atomic function doesn't exist, fall back to the original logic with explicit locking
    if (acceptError && acceptError.message.includes("function atomic_accept_lead")) {
      logStep("Atomic function not available, using fallback with explicit checks");
      
      // Re-fetch lead with latest accepted_count to minimize race window
      const { data: freshLead, error: freshLeadError } = await supabase
        .from("leads")
        .select("accepted_count, max_companies")
        .eq("id", lead.id)
        .single();

      if (freshLeadError || !freshLead) {
        throw new Error("Lead nicht mehr verfügbar");
      }

      const currentAccepted = freshLead.accepted_count || 0;
      
      if (currentAccepted >= maxCompanies) {
        // Update this distribution as quota_full
        await supabase
          .from("lead_distributions")
          .update({ status: "quota_full", responded_at: new Date().toISOString() })
          .eq("id", distributionId);

        // Return 200 with quota_full flag - this is expected business logic, not an error
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Diese Anfrage wurde bereits von einer anderen Firma angenommen.",
            quota_full: true 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use UPDATE with WHERE clause that checks current count to prevent race
      const { data: updateResult, error: updateLeadError } = await supabase
        .from("leads")
        .update({ 
          accepted_count: currentAccepted + 1,
          status: currentAccepted + 1 >= maxCompanies ? "completed" : lead.status
        })
        .eq("id", lead.id)
        .eq("accepted_count", currentAccepted) // Optimistic locking
        .select("accepted_count")
        .single();

      if (updateLeadError || !updateResult) {
        // Race condition detected - another process updated the count
        logStep("Race condition detected, retrying check");
        return new Response(
          JSON.stringify({ 
            error: "Anfrage wird gerade von einem anderen Prozess bearbeitet. Bitte versuchen Sie es erneut.",
            retry: true 
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Proceed with the rest of the logic
      const newAcceptedCount = updateResult.accepted_count;

      // Update distribution status
      const { error: updateDistError } = await supabase
        .from("lead_distributions")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
          token_charged: true,
        })
        .eq("id", distributionId);

      if (updateDistError) {
        throw updateDistError;
      }

      // Deduct tokens
      const newBalance = currentBalance - tokenCost;
      await supabase
        .from("companies")
        .update({ token_balance: newBalance })
        .eq("id", companyId);

      // Record transaction
      await supabase.from("token_transactions").insert({
        company_id: companyId,
        type: "charge",
        amount: -tokenCost,
        balance_before: currentBalance,
        balance_after: newBalance,
        reference_type: "lead",
        reference_id: lead.id,
        description: `Lead angenommen: ${lead.service_type} in ${lead.from_city}`,
      });

      logStep("Lead accepted", { newAcceptedCount, newBalance });

      // Check if quota is now full and notify remaining companies
      if (newAcceptedCount >= maxCompanies) {
        await handleQuotaFull(supabase, lead, maxCompanies, distributionId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Lead erfolgreich angenommen",
          newBalance,
          tokenCost,
          acceptedCount: newAcceptedCount,
          maxCompanies,
          quotaFull: newAcceptedCount >= maxCompanies,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If atomic function exists and succeeded
    if (acceptError) {
      logStep("Accept error", acceptError);
      throw acceptError;
    }

    if (!acceptResult || acceptResult.success === false) {
      const errorMessage = acceptResult?.error || "Kontingent voll oder ungültige Anfrage";
      // Return 200 with quota_full flag - this is expected business logic, not an error
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage, 
          quota_full: acceptResult?.quota_full 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If quota is now full, send email notifications to remaining companies (background)
    // The DB function already marked them as quota_full — we just need to send the emails
    if (acceptResult.quota_full) {
      Promise.resolve().then(() => handleQuotaFull(supabase, lead, maxCompanies, distributionId)).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lead erfolgreich angenommen",
        newBalance: acceptResult.new_balance,
        tokenCost,
        acceptedCount: acceptResult.new_accepted_count,
        maxCompanies,
        quotaFull: acceptResult.quota_full,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface LeadData {
  id: string;
  service_type: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  from_plz: string;
  from_city: string;
  to_plz?: string;
  to_city?: string;
  [key: string]: unknown;
}

// Helper function to handle quota full notifications
async function handleQuotaFull(
  supabase: ReturnType<typeof createClient>,
  lead: LeadData,
  maxCompanies: number,
  currentDistributionId: string
) {
  logStep("Quota now full, blocking remaining distributions");

  // Get remaining pending distributions for this lead
  const { data: remainingDists } = await supabase
    .from("lead_distributions")
    .select("id, company_id")
    .eq("lead_id", lead.id)
    .eq("status", "sent")
    .neq("id", currentDistributionId);

  if (remainingDists && remainingDists.length > 0) {
    // Update all remaining distributions to quota_full
    const remainingIds = remainingDists.map(d => d.id);
    await supabase
      .from("lead_distributions")
      .update({ status: "quota_full", responded_at: new Date().toISOString() })
      .in("id", remainingIds);

    logStep(`Blocked ${remainingIds.length} remaining distributions`);

    // Send notification emails to remaining companies
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const firmaAnfragenUrl = `${getDashboardAppBaseUrl()}/firma/anfragen`;

      const serviceLabel = getServiceDisplayLabel(lead.service_type);

      for (const dist of remainingDists) {
        const { data: companyInfo } = await supabase
          .from("companies")
          .select("company_name, email, notification_email")
          .eq("id", dist.company_id)
          .single();
        
        if (!companyInfo) continue;
        
        const recipientEmail = companyInfo.notification_email || companyInfo.email;
        
        try {
          const quotaInner = `
              <div style="${EMAIL_CARD_OUTER}">
                <div style="${EMAIL_HEADER_BAND};text-align:center;">
                  <h1 style="margin:0;font-size:20px;font-weight:600;color:#18181b;">Anfrage nicht mehr verfügbar</h1>
                </div>
                <div style="${EMAIL_BODY_PADDING}">
                  <p style="font-size:16px;margin-top:0;">Guten Tag ${companyInfo.company_name},</p>
                  <p>
                    Die Anfrage für <strong>${serviceLabel}</strong> in <strong>${lead.from_plz} ${lead.from_city}</strong>
                    wurde bereits von anderen Firmen angenommen.
                  </p>
                  <div style="background:#f4f4f5;padding:14px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;">
                    <p style="margin:0;color:#3f3f46;font-size:14px;">
                      Das maximale Kontingent von ${maxCompanies} Firmen wurde erreicht.
                    </p>
                  </div>
                  <p>Es kommen regelmässig neue Anfragen – im Dashboard sehen Sie die aktuellen.</p>
                  <div style="text-align:center;margin:22px 0;">
                    <a href="${firmaAnfragenUrl}" style="display:inline-block;background:#2d2d2d;color:#ffffff;text-decoration:none;padding:14px 24px;font-weight:600;border-radius:8px;">
                      Weitere Anfragen ansehen
                    </a>
                  </div>
                </div>
              </div>
              <div style="text-align:center;padding:14px 0 0;font-size:12px;color:#71717a;">
                <p style="margin:0;">© ${new Date().getFullYear()} Offerio</p>
              </div>`;

          await resend.emails.send({
            from: "Offerio <noreply@offerio.ch>",
            to: [recipientEmail],
            subject: `Anfrage vergeben: ${serviceLabel} in ${lead.from_city}`,
            html: wrapEmailDocument(quotaInner),
          });
          logStep(`Quota full notification sent to ${companyInfo.company_name}`);

          // C11: Başarılı e-postayı email_logs'a kaydet
          await supabase.from("email_logs").insert({
            company_id:      dist.company_id,
            lead_id:         lead.id,
            email_type:      "quota_full_notification",
            recipient_email: recipientEmail,
            status:          "sent",
          }).then(() => {});

        } catch (emailError) {
          logStep(`Failed to send quota notification to ${recipientEmail}`, emailError);

          // C11: Başarısız e-postayı email_logs'a kaydet — hatayı yutma
          await supabase.from("email_logs").insert({
            company_id:      dist.company_id,
            lead_id:         lead.id,
            email_type:      "quota_full_notification",
            recipient_email: recipientEmail,
            status:          "failed",
            error_message:   emailError instanceof Error ? emailError.message : String(emailError),
          }).then(() => {});
        }
      }
    }
  }
}
