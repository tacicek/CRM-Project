import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getSenderEmail, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logEmail } from "../_shared/logEmail.ts";
import { wrapEmailDocument, EMAIL_FONT_STACK } from "../_shared/emailLayout.ts";
import { buildInvoiceEmailHtml, buildInvoiceEmailSubject, fmtChf, fmtDate } from "../_shared/invoiceEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendQuittungRequest {
  quittungId: string;
  /** Pre-generated PDF as base64 (from frontend @react-pdf/renderer) */
  quittungPdfBase64?: string;
}

interface QuittungRow {
  id: string;
  quittung_nr: string;
  datum: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_destination: string | null;
  gesamttotal: number;
  mwst_satz: number;
  mwst_betrag: number;
  rabatt: number;
  zwischensumme: number;
  status: string;
  betrag_noch_offen: boolean;
  positionen: Array<{
    beschreibung: string;
    satz: string;
    betrag: number;
    checked: boolean;
    is_custom: boolean;
  }>;
  companies: {
    company_name: string;
    email: string;
    notification_email: string | null;
    logo_url: string | null;
    primary_color: string | null;
    phone: string | null;
    street: string | null;
    plz: string | null;
    city: string | null;
    mwst_number: string | null;
    iban: string | null;
    bank_name: string | null;
    resend_enabled: boolean | null;
    resend_api_key: string | null;
    resend_from_email: string | null;
    resend_from_name: string | null;
  };
}

function buildCustomerEmail(q: QuittungRow, brand: string): string {
  const lines = q.positionen
    .filter((p) => p.checked && p.betrag > 0)
    .map((p) => ({ beschreibung: p.beschreibung, detail: p.satz || "", betrag: p.betrag }));

  const extraSection = q.betrag_noch_offen
    ? `
      <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:6px;padding:10px 14px;margin-bottom:16px;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#92400E;font-family:${EMAIL_FONT_STACK}">
          ⚠️ Betrag noch offen – Bitte begleichen Sie den ausstehenden Betrag.
        </p>
      </div>`
    : undefined;

  return buildInvoiceEmailHtml({
    companyName: q.companies.company_name,
    brand,
    documentLabel: "Quittung",
    documentNumber: q.quittung_nr,
    datum: q.datum,
    customerName: q.customer_name,
    intro: "Vielen Dank für Ihren Auftrag. Anbei finden Sie Ihre Quittung im Anhang.",
    detailLabel: "Satz",
    lines,
    zwischensumme: q.zwischensumme,
    rabatt: q.rabatt,
    mwstSatz: q.mwst_satz,
    mwstBetrag: q.mwst_betrag,
    totalLabel: "Gesamttotal",
    total: q.gesamttotal,
    extraSection,
    footerParts: [
      q.companies.iban ? "IBAN: " + q.companies.iban : "",
      q.companies.bank_name || "",
      q.companies.mwst_number ? "MwSt-Nr.: " + q.companies.mwst_number : "",
      q.companies.phone || "",
    ],
  });
}

function buildFirmaEmail(q: QuittungRow, brand: string): string {
  const inner = `
    <div style="background:${brand};padding:20px;">
      <h2 style="margin:0;color:#fff;font-family:${EMAIL_FONT_STACK}">Quittung unterschrieben</h2>
    </div>
    <div style="padding:20px;background:#fafafa;">
      <p style="margin:0 0 12px;font-size:14px;font-family:${EMAIL_FONT_STACK}">
        Die Quittung <strong>${q.quittung_nr}</strong> wurde unterzeichnet.
      </p>
      <table cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background:#fff;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;width:100%;">
        <tr><td style="padding:8px 12px;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK};width:140px;">Kunde:</td><td style="padding:8px 12px;font-size:13px;font-family:${EMAIL_FONT_STACK}">${q.customer_name}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:8px 12px;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">Datum:</td><td style="padding:8px 12px;font-size:13px;font-family:${EMAIL_FONT_STACK}">${fmtDate(q.datum)}</td></tr>
        <tr><td style="padding:8px 12px;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">Gesamttotal:</td><td style="padding:8px 12px;font-size:14px;font-weight:700;color:${brand};font-family:${EMAIL_FONT_STACK}">${fmtChf(q.gesamttotal)}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#71717a;font-family:${EMAIL_FONT_STACK}">PDF im Anhang.</p>
    </div>
  `;
  return wrapEmailDocument(inner);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // JWT auth — require logged-in user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Ungültige Sitzung" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SendQuittungRequest = await req.json();
    const { quittungId, quittungPdfBase64 } = body;

    if (!quittungId) {
      return new Response(JSON.stringify({ error: "quittungId fehlt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch quittung with company
    const { data: quittung, error: qErr } = await supabase
      .from("quittungen")
      .select(`
        id, quittung_nr, datum, customer_name, customer_email,
        customer_phone, customer_address, customer_destination,
        gesamttotal, mwst_satz, mwst_betrag, rabatt, zwischensumme,
        status, betrag_noch_offen, positionen,
        companies (
          company_name, email, notification_email, logo_url, primary_color,
          phone, street, plz, city, mwst_number, iban, bank_name,
          resend_enabled, resend_api_key, resend_from_email, resend_from_name
        )
      `)
      .eq("id", quittungId)
      .single();

    if (qErr || !quittung) {
      return new Response(JSON.stringify({ error: "Quittung nicht gefunden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ownership check — user must belong to the quittung's company
    const { data: quittungCompany } = await supabase
      .from("quittungen")
      .select("company_id")
      .eq("id", quittungId)
      .single();

    if (quittungCompany) {
      const { data: ownerRow } = await supabase
        .from("companies")
        .select("id")
        .eq("id", quittungCompany.company_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!ownerRow) {
        const { data: memberRow } = await supabase
          .from("company_members")
          .select("id")
          .eq("company_id", quittungCompany.company_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!memberRow) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const q = quittung as unknown as QuittungRow;
    const company = q.companies;
    if (!company) throw new Error("Firma nicht gefunden");

    const brand = company.primary_color || "#10B981";

    // Determine Resend API key (company-level or global)
    const resendApiKey = company.resend_enabled && company.resend_api_key
      ? company.resend_api_key
      : Deno.env.get("RESEND_API_KEY")!;
    const fromEmail = company.resend_enabled && company.resend_from_email
      ? company.resend_from_email
      : getSenderEmail();
    const fromName = company.resend_from_name || company.company_name;

    const resend = new Resend(resendApiKey);

    const attachments: Array<{ filename: string; content: string }> = [];
    if (quittungPdfBase64) {
      attachments.push({
        filename: `Quittung-${q.quittung_nr}.pdf`,
        content: quittungPdfBase64,
      });
    }

    const results: string[] = [];

    // 1. Customer email
    if (q.customer_email) {
      const { data: emailData, error: emailErr } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [q.customer_email],
        subject: buildInvoiceEmailSubject({ documentTitle: "Quittung", documentNumber: q.quittung_nr, companyName: company.company_name }),
        html: buildCustomerEmail(q, brand),
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      await logEmail({
        emailType: "quittung_customer",
        recipientEmail: q.customer_email,
        subject: `Quittung ${q.quittung_nr}`,
        status: emailErr ? "failed" : "sent",
        errorMessage: emailErr?.message,
        companyId: company.id,
        metadata: { quittung_id: quittungId, resend_id: emailData?.id },
      });

      if (!emailErr) results.push("customer");
    }

    // 2. Firma internal copy
    const firmaEmail = company.notification_email || company.email;
    if (firmaEmail) {
      const { data: firmaData, error: firmaErr } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [firmaEmail],
        subject: `Quittung ${q.quittung_nr} – unterschrieben`,
        html: buildFirmaEmail(q, brand),
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      await logEmail({
        emailType: "quittung_firma",
        recipientEmail: firmaEmail,
        subject: `Quittung ${q.quittung_nr} – unterschrieben`,
        status: firmaErr ? "failed" : "sent",
        errorMessage: firmaErr?.message,
        companyId: company.id,
        metadata: { quittung_id: quittungId, resend_id: firmaData?.id },
      });

      if (!firmaErr) results.push("firma");
    }

    // Only mark as sent if at least one email was delivered
    if (results.length > 0) {
      await supabase
        .from("quittungen")
        .update({ status: "sent" })
        .eq("id", quittungId);
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Alle E-Mails fehlgeschlagen", sent_to: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, sent_to: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-quittung error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
