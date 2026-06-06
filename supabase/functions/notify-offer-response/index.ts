import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getAppName } from "../_shared/envConfig.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NotifyOfferResponseSchema = z.object({
  // Token-based auth — validates caller has legitimate access to this offer
  offerId: z.string().uuid("Ungültige Offer-ID"),
  accessToken: z.string().min(10, "Access-Token erforderlich"),
  // Notification payload
  offerTitle: z.string().min(1).max(200),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(255),
  customerPhone: z.string().max(50).nullable().optional(),
  responseType: z.enum(["accepted", "rejected", "question"]),
  responseNote: z.string().max(2000).nullable().optional(),
  companyEmail: z.string().email().max(255),
  companyName: z.string().min(1).max(200),
  companyId: z.string().uuid().optional(),
  offerTotal: z.number().min(0),
});

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[notify-offer-response] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    const parseResult = NotifyOfferResponseSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Ungültige Eingabedaten", details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const request = parseResult.data;

    // Verify access_token matches the offerId — prevents unauthorized email spam
    const { data: offerRow, error: offerErr } = await supabase
      .from("offers")
      .select("id, access_token, status, company_id")
      .eq("id", request.offerId)
      .eq("access_token", request.accessToken)
      .single();

    if (offerErr || !offerRow) {
      logStep("Token validation failed", { offerId: request.offerId });
      return new Response(
        JSON.stringify({ error: "Ungültiger Token" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    logStep("Token validated", { offerId: request.offerId, responseType: request.responseType });

    // Get company Resend settings
    let company = null;
    const companyId = request.companyId ?? offerRow.company_id;
    if (companyId) {
      const { data } = await supabase
        .from("companies")
        .select("id, company_name, resend_enabled, resend_api_key, resend_from_email, resend_from_name")
        .eq("id", companyId)
        .single();
      company = data;
    }

    // Resolve Resend key and from address
    let resendApiKey = Deno.env.get("RESEND_API_KEY");
    let fromAddress = getDefaultFrom();
    let isCompanyEmail = false;

    if (company?.resend_enabled && company?.resend_api_key && company?.resend_from_email) {
      resendApiKey = company.resend_api_key;
      const fromName = company.resend_from_name || company.company_name;
      fromAddress = `${fromName} <${company.resend_from_email}>`;
      isCompanyEmail = true;
    }

    if (!resendApiKey) {
      logStep("No Resend API key configured, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "Email notification skipped - API key not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resend = new Resend(resendApiKey);
    const appName = getAppName();
    const senderLabel = isCompanyEmail ? request.companyName : `Ihr ${appName} Team`;

    const isAccepted = request.responseType === "accepted";
    const isQuestion = request.responseType === "question";
    const statusText = isAccepted ? "angenommen" : isQuestion ? "Frage" : "abgelehnt";
    const statusColor = isAccepted ? "#16a34a" : isQuestion ? "#3b82f6" : "#dc2626";
    const statusEmoji = isAccepted ? "✅" : isQuestion ? "❓" : "❌";

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);

    let emailSubject: string;
    let emailHtml: string;

    if (isQuestion) {
      emailSubject = `❓ Kundenfrage zu Offerte "${request.offerTitle}"`;
      emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:16px 14px;background-color:#e4e4e8;">
  <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:30px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:24px;">❓ Neue Kundenfrage</h1>
  </div>
  <div style="background:#f8fafc;padding:30px;border:1px solid #e2e8f0;border-top:none;">
    <p style="margin-top:0;">Guten Tag,</p>
    <p>Der Kunde <strong>${request.customerName}</strong> hat eine Frage zu Ihrer Offerte.</p>
    <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748b;">Offerte:</td><td style="padding:8px 0;font-weight:600;text-align:right;">${request.offerTitle}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Betrag:</td><td style="padding:8px 0;font-weight:600;text-align:right;">${formatCurrency(request.offerTotal)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Kunde:</td><td style="padding:8px 0;text-align:right;">${request.customerName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">E-Mail:</td><td style="padding:8px 0;text-align:right;"><a href="mailto:${request.customerEmail}" style="color:#3b82f6;">${request.customerEmail}</a></td></tr>
        ${request.customerPhone ? `<tr><td style="padding:8px 0;color:#64748b;">Telefon:</td><td style="padding:8px 0;text-align:right;"><a href="tel:${request.customerPhone}" style="color:#3b82f6;">${request.customerPhone}</a></td></tr>` : ""}
      </table>
    </div>
    <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#1e40af;">Frage des Kunden:</p>
      <p style="margin:0;color:#1e3a8a;white-space:pre-wrap;">${request.responseNote || "Keine Nachricht"}</p>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <a href="mailto:${request.customerEmail}" style="display:inline-block;background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">✉️ Kunde antworten</a>
    </div>
    <p style="margin-bottom:0;margin-top:30px;color:#64748b;font-size:14px;">Mit freundlichen Grüssen<br><strong>${senderLabel}</strong></p>
  </div>
  <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;"><p>Diese E-Mail wurde automatisch von ${senderLabel} gesendet.</p></div>
</body>
</html>`;
    } else {
      emailSubject = `${statusEmoji} Offerte "${request.offerTitle}" wurde ${statusText}`;
      emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:16px 14px;background-color:#e4e4e8;">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:30px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:24px;">${statusEmoji} Offerte ${statusText}</h1>
  </div>
  <div style="background:#f8fafc;padding:30px;border:1px solid #e2e8f0;border-top:none;">
    <p style="margin-top:0;">Guten Tag,</p>
    <p>Der Kunde <strong>${request.customerName}</strong> hat Ihre Offerte <strong>${statusText}</strong>.</p>
    <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748b;">Offerte:</td><td style="padding:8px 0;font-weight:600;text-align:right;">${request.offerTitle}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Betrag:</td><td style="padding:8px 0;font-weight:600;text-align:right;">${formatCurrency(request.offerTotal)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Kunde:</td><td style="padding:8px 0;text-align:right;">${request.customerName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">E-Mail:</td><td style="padding:8px 0;text-align:right;"><a href="mailto:${request.customerEmail}" style="color:#667eea;">${request.customerEmail}</a></td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Status:</td><td style="padding:8px 0;text-align:right;"><span style="background:${statusColor};color:white;padding:4px 12px;border-radius:12px;font-size:14px;">${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</span></td></tr>
      </table>
    </div>
    ${request.responseNote ? `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:20px 0;"><p style="margin:0 0 8px;font-weight:600;color:#92400e;">Nachricht des Kunden:</p><p style="margin:0;color:#78350f;">${request.responseNote}</p></div>` : ""}
    ${isAccepted
        ? `<p style="color:#16a34a;font-weight:500;">🎉 Herzlichen Glückwunsch! Kontaktieren Sie den Kunden, um die nächsten Schritte zu besprechen.</p>`
        : `<p style="color:#64748b;">Der Kunde hat sich für einen anderen Anbieter entschieden.</p>`}
    <p style="margin-bottom:0;color:#64748b;font-size:14px;">Mit freundlichen Grüssen<br><strong>${senderLabel}</strong></p>
  </div>
  <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;"><p>Diese E-Mail wurde automatisch von ${senderLabel} gesendet.</p></div>
</body>
</html>`;
    }

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [request.companyEmail],
      subject: emailSubject,
      html: emailHtml,
    });

    if (error) {
      logStep("Error sending email", { error });
      await logEmail({
        recipientEmail: request.companyEmail,
        recipientName: request.companyName,
        subject: emailSubject,
        emailType: "offer_response",
        status: "failed",
        errorMessage: JSON.stringify(error),
        companyId: companyId,
        metadata: { responseType: request.responseType, offerTitle: request.offerTitle, offerTotal: request.offerTotal },
      });
      throw error;
    }

    logStep("Email sent successfully", { emailId: data?.id });
    await logEmail({
      recipientEmail: request.companyEmail,
      recipientName: request.companyName,
      subject: emailSubject,
      emailType: "offer_response",
      status: "sent",
      companyId: companyId,
      metadata: { responseType: request.responseType, offerTitle: request.offerTitle, offerTotal: request.offerTotal },
    });

    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Fatal error", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
