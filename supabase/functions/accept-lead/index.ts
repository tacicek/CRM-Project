import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getDashboardAppBaseUrl } from "../_shared/dashboardAppUrl.ts";
import { getDefaultFrom, getAppName } from "../_shared/envConfig.ts";
import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";
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

const maskEmail = (e: string) => e.replace(/(?<=.{2}).+(?=@)/, "***");

const AcceptLeadRequestSchema = z.object({
  distributionId: z.string().uuid("Ungültige Distribution-ID"),
  companyId: z.string().uuid("Ungültige Firmen-ID"),
});

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
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

    // ── Auth ───────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^bearer\s+/i, "").trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logStep("Authentication failed", { error: authError?.message });
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: user.id, email: maskEmail(user.email ?? "") });

    // ── Input validation ───────────────────────────────────
    const rawBody = await req.json();
    const parseResult = AcceptLeadRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Ungültige Eingabedaten", details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { distributionId, companyId } = parseResult.data;

    // ── Company exists ─────────────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, company_name, email, notification_email")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: "Firma nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Membership check ───────────────────────────────────
    const isMember = await verifyCompanyMembership(supabase, user.id, companyId);
    if (!isMember) {
      logStep("Unauthorized — not a company member", { userId: user.id, companyId });
      return new Response(
        JSON.stringify({ error: "Sie haben keine Berechtigung für diese Firma" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Load distribution ──────────────────────────────────
    const { data: distribution, error: distError } = await supabase
      .from("lead_distributions")
      .select("*, lead:leads(*)")
      .eq("id", distributionId)
      .eq("company_id", companyId)
      .single();

    if (distError || !distribution) {
      logStep("Distribution not found", distError);
      return new Response(
        JSON.stringify({ error: "Verteilung nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (distribution.status !== "sent") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Diese Anfrage wurde bereits bearbeitet.",
          status: distribution.status,
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

    // ── Accept: update distribution status ─────────────────
    const { error: updateDistError } = await supabase
      .from("lead_distributions")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", distributionId);

    if (updateDistError) throw updateDistError;

    logStep("Lead accepted", { distributionId, companyId, leadId: lead.id });

    // ── Send confirmation email (background) ───────────────
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      Promise.resolve().then(async () => {
        try {
          const resend = new Resend(resendApiKey);
          const firmaAnfragenUrl = `${getDashboardAppBaseUrl()}/firma/anfragen`;
          const serviceLabel = getServiceDisplayLabel(lead.service_type);
          const recipientEmail = company.notification_email || company.email;

          const inner = `
            <div style="${EMAIL_CARD_OUTER}">
              <div style="${EMAIL_HEADER_BAND};text-align:center;">
                <h1 style="margin:0;font-size:20px;font-weight:600;color:#18181b;">Anfrage angenommen</h1>
              </div>
              <div style="${EMAIL_BODY_PADDING}">
                <p style="font-size:16px;margin-top:0;">Guten Tag ${company.company_name},</p>
                <p>
                  Sie haben die Anfrage für <strong>${serviceLabel}</strong>
                  in <strong>${lead.from_plz} ${lead.from_city}</strong> angenommen.
                </p>
                <div style="text-align:center;margin:22px 0;">
                  <a href="${firmaAnfragenUrl}" style="display:inline-block;background:#2d2d2d;color:#ffffff;text-decoration:none;padding:14px 24px;font-weight:600;border-radius:8px;">
                    Zur Anfrage
                  </a>
                </div>
              </div>
            </div>
            <div style="text-align:center;padding:14px 0 0;font-size:12px;color:#71717a;">
              <p style="margin:0;">© ${new Date().getFullYear()} ${getAppName()}</p>
            </div>`;

          await resend.emails.send({
            from: getDefaultFrom(),
            to: [recipientEmail],
            subject: `Anfrage angenommen: ${serviceLabel} in ${lead.from_city}`,
            html: wrapEmailDocument(inner),
          });

          await supabase.from("email_logs").insert({
            company_id: companyId,
            lead_id: lead.id,
            email_type: "lead_accepted_confirmation",
            recipient_email: recipientEmail,
            status: "sent",
          });
        } catch (emailError) {
          logStep("Email failed", emailError);
          await supabase.from("email_logs").insert({
            company_id: companyId,
            lead_id: lead.id,
            email_type: "lead_accepted_confirmation",
            recipient_email: company.notification_email || company.email,
            status: "failed",
            error_message: emailError instanceof Error ? emailError.message : String(emailError),
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, message: "Lead erfolgreich angenommen" }),
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
