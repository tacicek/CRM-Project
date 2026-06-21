import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getSenderEmail } from "../_shared/envConfig.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logEmail } from "../_shared/logEmail.ts";
import { wrapEmailDocument, EMAIL_FONT_STACK } from "../_shared/emailLayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRechnungRequest {
  rechnungId: string;
  /** Vom Frontend (jsPDF buildRechnungDoc) erzeugtes PDF als base64. */
  pdfBase64?: string;
}

interface RechnungPositionRow {
  beschreibung: string;
  menge: number | null;
  einheit: string | null;
  einzelpreis: number | null;
  betrag: number;
}

interface RechnungRow {
  id: string;
  rechnung_nr: string;
  datum: string;
  faellig_am: string;
  customer_name: string;
  customer_email: string | null;
  zwischensumme: number;
  mwst_satz: number;
  mwst_betrag: number;
  total: number;
  gesamttotal: number;
  qr_referenz: string | null;
  qr_iban: string | null;
  positionen: RechnungPositionRow[];
  companies: {
    id: string;
    company_name: string;
    email: string;
    notification_email: string | null;
    primary_color: string | null;
    phone: string | null;
    mwst_number: string | null;
    iban: string | null;
    bank_name: string | null;
    resend_enabled: boolean | null;
    resend_api_key: string | null;
    resend_from_email: string | null;
    resend_from_name: string | null;
  };
}

function fmtChf(amount: number): string {
  return "CHF " + amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildCustomerEmail(r: RechnungRow, brand: string): string {
  const rows = r.positionen
    .filter((p) => p.betrag > 0 || (p.beschreibung ?? "").trim().length > 0)
    .map((p) => {
      const mengeStr = p.menge != null ? `${p.menge}${p.einheit ? " " + p.einheit : ""}` : "";
      return `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;">${p.beschreibung}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;color:#71717a;">${mengeStr}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;text-align:right;">${fmtChf(p.betrag)}</td>
    </tr>`;
    })
    .join("");

  const iban = r.qr_iban || r.companies.iban || "";

  const inner = `
    <div style="background:${brand};padding:24px 20px 20px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.75);font-family:${EMAIL_FONT_STACK}">
        Rechnung
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;font-family:${EMAIL_FONT_STACK}">
        ${r.companies.company_name}
      </h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);font-family:${EMAIL_FONT_STACK}">
        ${r.rechnung_nr} · ${fmtDate(r.datum)}
      </p>
    </div>

    <div style="padding:24px 20px;background:#fafafa;">
      <p style="margin:0 0 16px;font-size:15px;color:#18181b;font-family:${EMAIL_FONT_STACK}">
        Guten Tag ${r.customer_name},
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;font-family:${EMAIL_FONT_STACK}">
        Anbei erhalten Sie Ihre Rechnung mit QR-Zahlteil im PDF-Anhang.
      </p>

      <table width="100%" cellspacing="0" cellpadding="0" border="0"
        style="border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;background:#fff;margin-bottom:16px;">
        <thead>
          <tr style="background:${brand};">
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;font-weight:600;font-family:${EMAIL_FONT_STACK}">Beschreibung</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;font-weight:600;font-family:${EMAIL_FONT_STACK}">Menge</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;font-weight:600;font-family:${EMAIL_FONT_STACK}">Betrag</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table width="100%" cellspacing="0" cellpadding="0" border="0"
        style="max-width:280px;margin-left:auto;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">Zwischensumme:</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;font-family:${EMAIL_FONT_STACK}">${fmtChf(r.zwischensumme)}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">MwSt. (${r.mwst_satz}%):</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;font-family:${EMAIL_FONT_STACK}">${fmtChf(r.mwst_betrag)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:16px;font-weight:700;background:${brand}22;border-radius:4px 0 0 4px;color:${brand};font-family:${EMAIL_FONT_STACK}">Total:</td>
          <td style="padding:10px 12px;font-size:16px;font-weight:700;background:${brand}22;border-radius:0 4px 4px 0;text-align:right;color:${brand};font-family:${EMAIL_FONT_STACK}">${fmtChf(r.gesamttotal || r.total)}</td>
        </tr>
      </table>

      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;padding:12px 14px;margin-bottom:16px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1E40AF;font-family:${EMAIL_FONT_STACK}">
          Zahlbar bis ${fmtDate(r.faellig_am)}
        </p>
        <p style="margin:0;font-size:12px;color:#3f3f46;font-family:${EMAIL_FONT_STACK}">
          ${[iban ? "IBAN: " + iban : "", r.qr_referenz ? "Referenz: " + r.qr_referenz : ""].filter(Boolean).join("  ·  ")}
        </p>
      </div>

      <p style="margin:16px 0 4px;font-size:13px;color:#3f3f46;font-family:${EMAIL_FONT_STACK}">
        Mit freundlichen Grüssen,<br>
        <strong>${r.companies.company_name}</strong>
      </p>
    </div>

    <div style="padding:14px 20px;background:#f4f4f5;border-top:1px solid #e4e4e7;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;font-family:${EMAIL_FONT_STACK}">
        ${[
          iban ? "IBAN: " + iban : "",
          r.companies.bank_name || "",
          r.companies.mwst_number ? "MwSt-Nr.: " + r.companies.mwst_number : "",
          r.companies.phone || "",
        ].filter(Boolean).join("  ·  ")}
      </p>
    </div>
  `;

  return wrapEmailDocument(inner);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const body: SendRechnungRequest = await req.json();
    const { rechnungId, pdfBase64 } = body;
    if (!rechnungId) {
      return new Response(JSON.stringify({ error: "rechnungId fehlt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rechnung, error: rErr } = await supabase
      .from("rechnungen")
      .select(`
        id, rechnung_nr, datum, faellig_am, customer_name, customer_email,
        zwischensumme, mwst_satz, mwst_betrag, total, gesamttotal,
        qr_referenz, qr_iban, positionen,
        companies (
          id, company_name, email, notification_email, primary_color,
          phone, mwst_number, iban, bank_name,
          resend_enabled, resend_api_key, resend_from_email, resend_from_name
        )
      `)
      .eq("id", rechnungId)
      .single();

    if (rErr || !rechnung) {
      return new Response(JSON.stringify({ error: "Rechnung nicht gefunden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ownership check — user must own or be member of the rechnung's company
    const { data: ownerInfo } = await supabase
      .from("rechnungen").select("company_id").eq("id", rechnungId).single();

    if (ownerInfo) {
      const { data: ownerRow } = await supabase
        .from("companies").select("id").eq("id", ownerInfo.company_id).eq("user_id", user.id).maybeSingle();
      if (!ownerRow) {
        const { data: memberRow } = await supabase
          .from("company_members").select("id")
          .eq("company_id", ownerInfo.company_id).eq("user_id", user.id).maybeSingle();
        if (!memberRow) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const r = rechnung as unknown as RechnungRow;
    const company = r.companies;
    if (!company) throw new Error("Firma nicht gefunden");
    if (!r.customer_email) {
      return new Response(JSON.stringify({ error: "Keine Kunden-E-Mail hinterlegt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brand = company.primary_color || "#10B981";
    const resendApiKey = company.resend_enabled && company.resend_api_key
      ? company.resend_api_key
      : Deno.env.get("RESEND_API_KEY")!;
    const fromEmail = company.resend_enabled && company.resend_from_email
      ? company.resend_from_email
      : getSenderEmail();
    const fromName = company.resend_from_name || company.company_name;

    const resend = new Resend(resendApiKey);

    const attachments = pdfBase64
      ? [{ filename: `Rechnung-${r.rechnung_nr}.pdf`, content: pdfBase64 }]
      : undefined;

    const { data: emailData, error: emailErr } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [r.customer_email],
      subject: `Ihre Rechnung von ${company.company_name} – ${r.rechnung_nr}`,
      html: buildCustomerEmail(r, brand),
      attachments,
    });

    await logEmail({
      emailType: "rechnung_customer",
      recipientEmail: r.customer_email,
      subject: `Rechnung ${r.rechnung_nr}`,
      status: emailErr ? "failed" : "sent",
      errorMessage: emailErr?.message,
      companyId: company.id,
      metadata: { rechnung_id: rechnungId, resend_id: emailData?.id },
    });

    if (emailErr) {
      return new Response(
        JSON.stringify({ success: false, error: emailErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Erfolgreich → Status auf versendet (nur wenn noch nicht bezahlt)
    await supabase
      .from("rechnungen")
      .update({ status: "versendet" })
      .eq("id", rechnungId)
      .neq("status", "bezahlt");

    return new Response(
      JSON.stringify({ success: true, sent_to: r.customer_email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-rechnung-email error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
