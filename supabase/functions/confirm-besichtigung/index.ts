import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";
import { logEmail } from "../_shared/logEmail.ts";
import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";
import {
  createTranslator,
  formatDateLong,
  toLocale,
  type Locale,
} from "../_shared/i18n/index.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProposalSlot {
  date: string;
  startTime: string;
  endTime: string;
}

interface ConfirmRequest {
  type?: "confirm";
  offerId: string;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  // Alternative fields from frontend
  besichtigungDate?: string;
  besichtigungTime?: string;
  durationMinutes?: number;
  companyId?: string;
  address?: {
    street: string;
    houseNumber: string;
    plz: string;
    city: string;
  };
}

interface ProposeRequest {
  type: "propose";
  offerId: string;
  proposals: ProposalSlot[];
  message?: string;
}

type RequestBody = ConfirmRequest | ProposeRequest;

// Helper function to calculate end time
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[confirm-besichtigung] ${step}`, details ? JSON.stringify(details) : "");
};

/** German long date — used ONLY for the internal CRM note on the offer row, never in customer mail. */
const formatDateDeCH = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Auth: Aufrufer muss ein eingeloggter Benutzer sein ──
    // (verify_jwt=false in config.toml; daher hier explizit prüfen)
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      logStep("Unauthorized: missing token");
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      logStep("Unauthorized: invalid token");
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const request: RequestBody = await req.json();

    logStep("Processing besichtigung request", { type: request.type, offerId: request.offerId });

    // Get offer details
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("*")
      .eq("id", request.offerId)
      .single();

    if (offerError || !offer) {
      throw new Error("Offer not found");
    }

    // ── Authz: Benutzer muss Mitglied der Firma dieser Offerte sein ──
    const isMember = await verifyCompanyMembership(supabase, user.id, offer.company_id);
    if (!isMember) {
      logStep("Forbidden: user is not a member of offer's company", { userId: user.id, companyId: offer.company_id });
      return new Response(
        JSON.stringify({ error: "Keine Berechtigung für diese Firma" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get company details including Resend settings
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*, resend_enabled, resend_api_key, resend_from_email, resend_from_name")
      .eq("id", offer.company_id)
      .single();

    if (companyError || !company) {
      throw new Error("Company not found");
    }

    // Determine which Resend API key and from address to use
    let resendApiKey = Deno.env.get("RESEND_API_KEY");
    let fromAddress = getDefaultFrom();
    let isCompanyEmail = false;

    if (company.resend_enabled && company.resend_api_key && company.resend_from_email) {
      resendApiKey = company.resend_api_key;
      const fromName = company.resend_from_name || company.company_name;
      fromAddress = `${fromName} <${company.resend_from_email}>`;
      isCompanyEmail = true;
      logStep("Using company's own Resend API", { fromAddress });
    } else {
      logStep("Using default Resend API");
    }
    
    if (!resendApiKey) {
      logStep("No Resend API key configured, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "No email sent - no API key configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Both mails this function sends go to the CUSTOMER, so the offer's own language governs
    // throughout. `isCompanyEmail` only picks the sending identity, never the language.
    const customerLocale = toLocale(offer.language);
    const tCustomer = createTranslator(customerLocale);

    // Determine if this is a confirm or propose request
    // If no type specified and has besichtigungDate, treat as confirm
    const isConfirm = request.type === "confirm" || 
                      (!request.type && ("besichtigungDate" in request || "appointmentDate" in request));

    if (isConfirm) {
      // Handle confirmation
      const confirmRequest = request as ConfirmRequest;
      
      // Support both old and new field names
      const appointmentDate = confirmRequest.appointmentDate || confirmRequest.besichtigungDate;
      const startTime = confirmRequest.startTime || confirmRequest.besichtigungTime || "10:00";
      const durationMinutes = confirmRequest.durationMinutes || 60;
      const endTime = confirmRequest.endTime || calculateEndTime(startTime, durationMinutes);
      
      if (!appointmentDate) {
        throw new Error("Appointment date is required");
      }
      
      logStep("Confirming besichtigung", { appointmentDate, startTime, endTime });

      // Get address from request or lead
      const confirmReq = request as ConfirmRequest;
      let locationAddress = "";
      let locationPlz = "";
      let locationCity = "";

      if (confirmReq.address) {
        locationAddress = `${confirmReq.address.street} ${confirmReq.address.houseNumber}`.trim();
        locationPlz = confirmReq.address.plz;
        locationCity = confirmReq.address.city;
      } else {
        // Try to get from lead
        const { data: lead } = await supabase
          .from("leads")
          .select("from_street, from_house_number, from_plz, from_city")
          .eq("id", offer.lead_id)
          .single();
        
        if (lead) {
          locationAddress = `${lead.from_street || ""} ${lead.from_house_number || ""}`.trim();
          locationPlz = lead.from_plz || "";
          locationCity = lead.from_city || "";
        }
      }

      // Create appointment ONLY when called from OfferteDetail (no type) - AcceptBesichtigungDialog already creates it
      let appointmentCreated = false;
      if (request.type !== "confirm") {
        const { error: appointmentError } = await supabase
          .from("appointments")
          .insert({
            company_id: offer.company_id,
            lead_id: offer.lead_id,
            offer_id: offer.id,
            appointment_type: "besichtigung",
            status: "confirmed",
            appointment_date: appointmentDate,
            start_time: startTime,
            end_time: endTime,
            duration_minutes: durationMinutes,
            location_address: locationAddress,
            location_plz: locationPlz,
            location_city: locationCity,
            customer_first_name: offer.customer_first_name,
            customer_last_name: offer.customer_last_name,
            customer_email: offer.customer_email,
            customer_phone: offer.customer_phone,
            title: `Besichtigung: ${offer.title}`,
            confirmed_by_firma: true,
            confirmed_at: new Date().toISOString(),
          });

        if (appointmentError) {
          // Idempotency: uniq_confirmed_besichtigung_per_offer fired — the besichtigung was
          // already created by a prior (retried) call. Treat as done instead of a 500.
          if (appointmentError.code === "23505") {
            logStep("Besichtigung appointment already exists — skipping insert");
          } else {
            logStep("Error creating appointment", { error: appointmentError });
            throw new Error("Failed to create appointment");
          }
        } else {
          appointmentCreated = true;
          logStep("Appointment created in calendar");
        }
      }

      // Update offer to mark besichtigung as confirmed.
      // customer_response_note is an INTERNAL CRM field rendered in the dashboard — it stays German.
      const { error: offerUpdateError } = await supabase
        .from("offers")
        .update({
          customer_response_note: `✅ Besichtigung bestätigt: ${formatDateDeCH(appointmentDate)} um ${startTime} Uhr`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", offer.id);

      if (offerUpdateError) {
        logStep("Error updating offer", { error: offerUpdateError });
      } else {
        logStep("Offer updated with confirmation");
      }

      // Send confirmation email AFTER DB operations (appointment + offer)
      const emailHtml = generateConfirmationEmail({
        customerName: `${offer.customer_first_name} ${offer.customer_last_name}`,
        companyName: company.company_name,
        companyEmail: company.email,
        companyPhone: company.phone,
        date: appointmentDate,
        startTime: startTime,
        endTime: endTime,
        offerTitle: offer.title,
        isCompanyEmail,
        locale: customerLocale,
      });

      // Emoji prefix preserved (the catalog values are emoji-free by design).
      const emailSubject = `✅ ${tCustomer("email.besichtigungConfirmed.subject", {
        date: formatDateLong(appointmentDate, customerLocale),
      })}`;

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: fromAddress,
        to: [offer.customer_email],
        subject: emailSubject,
        html: emailHtml,
      });

      if (emailError) {
        logStep("Error sending confirmation email", { error: emailError });
        await logEmail({
          recipientEmail: offer.customer_email,
          recipientName: `${offer.customer_first_name} ${offer.customer_last_name}`,
          subject: emailSubject,
          emailType: "besichtigung_confirmed",
          status: "failed",
          errorMessage: JSON.stringify(emailError),
          companyId: company.id,
          language: customerLocale,
          metadata: { offerId: offer.id, isCompanyEmail },
        });
        throw new Error("Failed to send email");
      } else {
        logStep("Confirmation email sent", { emailId: emailData?.id });
        await logEmail({
          recipientEmail: offer.customer_email,
          recipientName: `${offer.customer_first_name} ${offer.customer_last_name}`,
          subject: emailSubject,
          emailType: "besichtigung_confirmed",
          status: "sent",
          companyId: company.id,
          language: customerLocale,
          metadata: { offerId: offer.id, isCompanyEmail },
        });
      }

      return new Response(
        JSON.stringify({ success: true, type: "confirmed", appointmentCreated }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else if (request.type === "propose") {
      // Handle proposal
      const proposeRequest = request as ProposeRequest;
      
      // Get lead info for the response link
      const { data: lead } = await supabase
        .from("leads")
        .select("id, from_street, from_house_number, from_plz, from_city")
        .eq("id", offer.lead_id)
        .single();
      
      const address = lead ? 
        `${lead.from_street || ""} ${lead.from_house_number || ""}, ${lead.from_plz} ${lead.from_city}`.trim() : "";
      
      // Build response link with proposal data
      const proposalsForLink = proposeRequest.proposals.map(p => ({
        date: p.date,
        time: p.startTime
      }));
      
      // URLSearchParams encodes automatically - do not pre-encode to avoid double-encoding.
      //
      // `lang` is carried in the query string on purpose: /besichtigung/:leadId/antwort is a
      // PUBLIC page that reads everything from the URL and has no DB row to resolve a language
      // from. Without this parameter the customer would click a French e-mail and land on a
      // German page.
      const responseParams = new URLSearchParams({
        token: offer.access_token,
        companyId: company.id,
        companyName: company.company_name,
        customerName: `${offer.customer_first_name} ${offer.customer_last_name}`,
        customerEmail: offer.customer_email,
        address,
        proposals: JSON.stringify(proposalsForLink),
        lang: customerLocale,
      });

      const baseUrl = Deno.env.get("SITE_URL") || getDashAppUrl();
      const responseLink = `${baseUrl}/besichtigung/${offer.lead_id}/antwort?${responseParams.toString()}`;

      const emailHtml = generateProposalEmail({
        customerName: `${offer.customer_first_name} ${offer.customer_last_name}`,
        companyName: company.company_name,
        companyEmail: company.email,
        companyPhone: company.phone,
        proposals: proposeRequest.proposals,
        message: proposeRequest.message,
        offerTitle: offer.title,
        offerId: offer.id,
        accessToken: offer.access_token,
        baseUrl,
        responseLink,
        isCompanyEmail,
        locale: customerLocale,
      });

      // Emoji prefix preserved (the catalog values are emoji-free by design).
      const emailSubject = `📅 ${tCustomer("email.besichtigungProposal.subject", {
        companyName: company.company_name,
      })}`;

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: fromAddress,
        to: [offer.customer_email],
        subject: emailSubject,
        html: emailHtml,
      });

      if (emailError) {
        logStep("Error sending proposal email", { error: emailError });
        await logEmail({
          recipientEmail: offer.customer_email,
          recipientName: `${offer.customer_first_name} ${offer.customer_last_name}`,
          subject: emailSubject,
          emailType: "besichtigung_proposal",
          status: "failed",
          errorMessage: JSON.stringify(emailError),
          companyId: company.id,
          language: customerLocale,
          metadata: { offerId: offer.id, proposals: proposeRequest.proposals, isCompanyEmail },
        });
        throw new Error("Failed to send email");
      } else {
        logStep("Proposal email sent", { emailId: emailData?.id });
        await logEmail({
          recipientEmail: offer.customer_email,
          recipientName: `${offer.customer_first_name} ${offer.customer_last_name}`,
          subject: emailSubject,
          emailType: "besichtigung_proposal",
          status: "sent",
          companyId: company.id,
          language: customerLocale,
          metadata: { offerId: offer.id, proposals: proposeRequest.proposals, isCompanyEmail },
        });
      }

      return new Response(
        JSON.stringify({ success: true, type: "proposal_sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    throw new Error("Invalid request type");

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error in confirm-besichtigung", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

interface ConfirmationEmailParams {
  customerName: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string | null;
  date: string;
  startTime: string;
  endTime: string;
  offerTitle: string;
  isCompanyEmail: boolean;
  /** Customer locale (offers.language). */
  locale: Locale;
}

function generateConfirmationEmail(params: ConfirmationEmailParams): string {
  const t = createTranslator(params.locale);
  const signature = params.isCompanyEmail
    ? params.companyName
    : t("common.teamSignature", { appName: getAppName() });

  return `
    <!DOCTYPE html>
    <html lang="${params.locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ✅ ${t("email.besichtigungConfirmed.headerTitle")}
          </h1>
        </div>

        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin-top: 0;">${t("common.greeting", { name: escapeHtml(params.customerName) })}</p>

          <p>${t("email.besichtigungConfirmed.intro", { companyName: `<strong>${escapeHtml(params.companyName)}</strong>` })}</p>

          <div style="background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px;">📅 ${t("email.besichtigungConfirmed.slotTitle")}</h3>
            <p style="margin: 0; font-size: 20px; font-weight: 600; color: #14532d;">
              ${formatDateLong(params.date, params.locale)}
            </p>
            <p style="margin: 8px 0 0 0; font-size: 18px; color: #166534;">
              🕐 ${t("common.timeRange", { start: params.startTime, end: params.endTime })}
            </p>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${t("common.offer")}:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${escapeHtml(params.offerTitle)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${t("common.company")}:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${escapeHtml(params.companyName)}</td>
              </tr>
              ${params.companyPhone ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${t("common.phone")}:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <a href="tel:${encodeURIComponent(params.companyPhone)}" style="color: #3b82f6;">${escapeHtml(params.companyPhone)}</a>
                </td>
              </tr>
              ` : ""}
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${t("common.email")}:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <a href="mailto:${encodeURIComponent(params.companyEmail)}" style="color: #3b82f6;">${escapeHtml(params.companyEmail)}</a>
                </td>
              </tr>
            </table>
          </div>

          <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af;">
              <strong>📍 ${t("email.besichtigungConfirmed.noticeTitle")}</strong><br>
              ${t("email.besichtigungConfirmed.noticeBody", { companyName: `<strong>${escapeHtml(params.companyName)}</strong>` })}
            </p>
          </div>

          <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
            ${t("common.regards")}<br>
            <strong>${escapeHtml(signature)}</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
          <p>${t("common.autoSentBy", { sender: escapeHtml(params.isCompanyEmail ? params.companyName : getAppName()) })}</p>
        </div>
      </body>
    </html>
  `;
}

interface ProposalEmailParams {
  customerName: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string | null;
  proposals: ProposalSlot[];
  message?: string;
  offerTitle: string;
  offerId: string;
  accessToken: string;
  baseUrl: string;
  responseLink: string;
  isCompanyEmail: boolean;
  /** Customer locale (offers.language). */
  locale: Locale;
}

function generateProposalEmail(params: ProposalEmailParams): string {
  const t = createTranslator(params.locale);
  const signature = params.isCompanyEmail
    ? params.companyName
    : t("common.teamSignature", { appName: getAppName() });

  const proposalListHtml = params.proposals.map((p, index) => `
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 10px 0;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="background: #3b82f6; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600;">
          ${index + 1}
        </div>
        <div>
          <p style="margin: 0; font-weight: 600; color: #1e293b;">
            ${formatDateLong(p.date, params.locale)}
          </p>
          <p style="margin: 4px 0 0 0; color: #64748b;">
            🕐 ${t("common.timeRange", { start: p.startTime, end: p.endTime })}
          </p>
        </div>
      </div>
    </div>
  `).join("");

  return `
    <!DOCTYPE html>
    <html lang="${params.locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            📅 ${t("email.besichtigungProposal.headerTitle")}
          </h1>
        </div>

        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin-top: 0;">${t("common.greeting", { name: escapeHtml(params.customerName) })}</p>

          <p>${t("email.besichtigungProposal.intro", { companyName: `<strong>${escapeHtml(params.companyName)}</strong>` })}</p>

          ${params.message ? `
          <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; font-style: italic;">
            "${escapeHtml(params.message)}"
          </div>
          ` : ""}

          <div style="margin: 20px 0;">
            ${proposalListHtml}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${params.responseLink}"
               style="display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              ✅ ${t("email.besichtigungProposal.cta")}
            </a>
          </div>

          <p style="text-align: center; color: #64748b; font-size: 14px;">
            ${t("email.besichtigungProposal.ctaHint")}
          </p>

          ${params.companyPhone ? `
          <div style="text-align: center; margin: 20px 0;">
            <a href="tel:${encodeURIComponent(params.companyPhone)}"
               style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              📞 ${escapeHtml(params.companyPhone)}
            </a>
          </div>
          ` : ""}

          <div style="background: #fff7ed; border: 1px solid #f97316; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #9a3412;">
              <strong>⏰ ${t("email.besichtigungProposal.urgencyTitle")}</strong><br>
              ${t("email.besichtigungProposal.urgencyBody")}
            </p>
          </div>

          <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
            ${t("common.regards")}<br>
            <strong>${escapeHtml(signature)}</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
          <p>${t("common.autoSentBy", { sender: escapeHtml(params.isCompanyEmail ? params.companyName : getAppName()) })}</p>
        </div>
      </body>
    </html>
  `;
}

serve(handler);
