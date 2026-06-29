import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getSenderEmail } from "../_shared/envConfig.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logEmail } from "../_shared/logEmail.ts";
import { EMAIL_FONT_STACK } from "../_shared/emailLayout.ts";
import { buildInvoiceEmailHtml, buildInvoiceEmailSubject, fmtDate } from "../_shared/invoiceEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRechnungRequest {
  rechnungId: string;
  /**
   * "prepare" → erzeugt eine signierte Upload-URL (service_role) und gibt {path, token}
   * zurück; der Client lädt das PDF damit hoch (uploadToSignedUrl). Default/"send" → lädt
   * das PDF aus Storage, versendet es und löscht es danach.
   * Grund: der self-hosted storage-Dienst führt Upload-INSERTs nicht als Rolle
   * 'authenticated' aus → RLS-Policies greifen nicht. Signierte URL (service_role) umgeht das.
   */
  mode?: "prepare" | "send";
}

/**
 * Uint8Array → base64 in 8KB-Chunks.
 * String.fromCharCode(...bytes) auf dem ganzen Array sprengt bei großen PDFs den
 * Call-Stack ("Maximum call stack size exceeded"); chunked ist der sichere Weg.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x2000; // 8KB
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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

function buildCustomerEmail(r: RechnungRow, brand: string): string {
  const lines = r.positionen
    .filter((p) => p.betrag > 0 || (p.beschreibung ?? "").trim().length > 0)
    .map((p) => ({
      beschreibung: p.beschreibung,
      detail: typeof p.menge === "number" ? `${p.menge}${p.einheit ? " " + p.einheit : ""}` : "",
      betrag: p.betrag,
    }));

  const iban = r.qr_iban || r.companies.iban || "";

  const extraSection = `
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;padding:12px 14px;margin-bottom:16px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1E40AF;font-family:${EMAIL_FONT_STACK}">
          Zahlbar bis ${fmtDate(r.faellig_am)}
        </p>
        <p style="margin:0;font-size:12px;color:#3f3f46;font-family:${EMAIL_FONT_STACK}">
          ${[iban ? "IBAN: " + iban : "", r.qr_referenz ? "Referenz: " + r.qr_referenz : ""].filter(Boolean).join("  ·  ")}
        </p>
      </div>`;

  return buildInvoiceEmailHtml({
    companyName: r.companies.company_name,
    brand,
    documentLabel: "Rechnung",
    documentNumber: r.rechnung_nr,
    datum: r.datum,
    customerName: r.customer_name,
    intro: "Anbei erhalten Sie Ihre Rechnung mit QR-Zahlteil im PDF-Anhang.",
    detailLabel: "Menge",
    lines,
    zwischensumme: r.zwischensumme,
    mwstSatz: r.mwst_satz,
    mwstBetrag: r.mwst_betrag,
    totalLabel: "Total",
    total: r.gesamttotal || r.total,
    extraSection,
    footerParts: [
      iban ? "IBAN: " + iban : "",
      r.companies.bank_name || "",
      r.companies.mwst_number ? "MwSt-Nr.: " + r.companies.mwst_number : "",
      r.companies.phone || "",
    ],
  });
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
    const { rechnungId, mode } = body;
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

    // Anhang-Pfad serverseitig aus der (autorisierten) Rechnung ableiten — KEIN
    // client-gelieferter Pfad (IDOR-Schutz).
    const pdfPath = `${company.id}/rechnung/${rechnungId}.pdf`;

    // mode "prepare": signierte Upload-URL (service_role, umgeht RLS) erzeugen und zurückgeben.
    if (mode === "prepare") {
      try { await supabase.storage.from("document-pdfs").remove([pdfPath]); } catch (_e) { /* evtl. nicht vorhanden */ }
      const { data: signed, error: signErr } = await supabase.storage
        .from("document-pdfs")
        .createSignedUploadUrl(pdfPath);
      if (signErr || !signed) {
        return new Response(JSON.stringify({ error: "Upload-URL konnte nicht erstellt werden" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ path: signed.path, token: signed.token }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // PDF-Anhang per service_role aus Storage laden (Pfad oben abgeleitet).
    const { data: pdfBlob, error: dlErr } = await supabase.storage
      .from("document-pdfs")
      .download(pdfPath);
    if (dlErr || !pdfBlob) {
      return new Response(JSON.stringify({ error: "PDF-Anhang nicht gefunden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pdfBase64 = bytesToBase64(new Uint8Array(await pdfBlob.arrayBuffer()));
    const attachments = [{ filename: `Rechnung-${r.rechnung_nr}.pdf`, content: pdfBase64 }];

    const { data: emailData, error: emailErr } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [r.customer_email],
      subject: buildInvoiceEmailSubject({ documentTitle: "Rechnung", documentNumber: r.rechnung_nr, companyName: company.company_name }),
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

    // Cleanup: PDF aus Storage entfernen — erst NACHDEM Resend die Daten erhalten hat.
    // Best-effort: ein Fehler hier darf den (bereits erfolgten) Versand nicht beeinflussen.
    try {
      await supabase.storage.from("document-pdfs").remove([pdfPath]);
    } catch (cleanupErr) {
      console.error("document-pdfs cleanup failed:", pdfPath, cleanupErr);
    }

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
