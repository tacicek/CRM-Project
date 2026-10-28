import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getSenderEmail, getDashAppUrl } from "../_shared/envConfig.ts";
import { logEmail } from "../_shared/logEmail.ts";
import { buildInvoiceEmailHtml, buildInvoiceEmailSubject } from "../_shared/invoiceEmailTemplate.ts";
import { toLocale } from "../_shared/i18n/index.ts";
import { loadCompanySecrets } from "../_shared/companySecrets.ts";
import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";
import { emailBrandColor } from "../_shared/htmlEscape.ts";
import { dispatchReceipt, parseDocumentRequest, receiptPdfPath, publicReceiptPdfUrl, verifyReceiptPdf, type ReceiptRecipient, type ReceiptDispatchStore } from "./document.ts";
import { receiptEmailLines, receiptEmailPaymentHtml, type ReceiptEmailPayment, type ReceiptEmailPosition } from "./presentation.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

interface SenderSnapshot {
  company_name: string; email: string; primary_color?: string | null;
  iban?: string | null; bank_name?: string | null; mwst_number?: string | null; phone?: string | null;
}
interface ReceiptRow extends ReceiptEmailPayment {
  id: string; company_id: string; version: number; issued_at: string | null; sent_at: string | null;
  quittung_nr: string; datum: string; customer_name: string; customer_email: string | null;
  language: string; status: string; payment_status: string; company_snapshot: SenderSnapshot | null;
  gesamttotal: number; mwst_satz: number; mwst_betrag: number; rabatt: number; zwischensumme: number;
  positionen: ReceiptEmailPosition[];
}
interface ArchivedDocument { id: string; company_id: string; quittung_id: string; version: number; pdf_path: string; sha256: string }
interface CompanyConfig { id: string; email: string; notification_email: string | null; default_language: string | null; resend_enabled: boolean | null; resend_from_email: string | null; resend_from_name: string | null }
interface ClaimedDispatch { id: string; status: "processing" | "sent" | "failed"; created_at: string }
const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
};

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Methode nicht erlaubt." }, 405);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return reply({ error: "Nicht autorisiert." }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(auth.slice(7));
    if (authError || !user) return reply({ error: "Ungültige Sitzung." }, 401);
    let body;
    try { body = parseDocumentRequest(await req.json()); }
    catch (error) { return reply({ error: error instanceof Error ? error.message : "Ungültige Anfrage." }, 400); }

    const { data: receipt, error: receiptError } = await supabase.from("quittungen").select("*")
      .eq("id", body.quittungId).returns<ReceiptRow[]>().single();
    if (receiptError || !receipt) return reply({ error: "Quittung nicht gefunden." }, 404);
    if (!await verifyCompanyMembership(supabase, user.id, receipt.company_id)) return reply({ error: "Keine Berechtigung." }, 403);
    if (!receipt.issued_at || !receipt.company_snapshot) return reply({ error: "Die Quittung muss zuerst ausgestellt werden." }, 409);
    if (receipt.version !== body.version) return reply({ error: "Die Quittung wurde geändert. Bitte neu laden." }, 409);

    const { data: existing, error: documentError } = await supabase.from("quittung_documents").select("*")
      .eq("quittung_id", receipt.id).eq("version", body.version).returns<ArchivedDocument[]>().maybeSingle();
    if (documentError) throw documentError;
    const documentResponse = async (document: ArchivedDocument | null) => {
      if (!document) return reply({ document: null });
      const { data, error } = await supabase.storage.from("document-pdfs").createSignedUrl(document.pdf_path, 300);
      if (error || !data) throw error ?? new Error("PDF-Link konnte nicht erstellt werden.");
      const url = publicReceiptPdfUrl(data.signedUrl, Deno.env.get("SUPABASE_PUBLIC_URL"), getDashAppUrl());
      return reply({ document: { id: document.id, version: document.version, sha256: document.sha256 }, url });
    };
    if (body.action === "lookup") return documentResponse(existing);
    if (body.action === "prepare") {
      const path = receiptPdfPath(receipt.company_id, receipt.id, body.version, body.sha256!);
      // No upsert: an archive path can never be overwritten by a signed upload token.
      const { data, error } = await supabase.storage.from("document-pdfs").createSignedUploadUrl(path);
      if (error || !data) throw error ?? new Error("PDF-Upload konnte nicht vorbereitet werden.");
      return reply({ path: data.path, token: data.token });
    }
    if (body.action === "archive") {
      if (existing) return documentResponse(existing);
      const expectedPath = receiptPdfPath(receipt.company_id, receipt.id, body.version, body.sha256!);
      if (body.pdfPath !== expectedPath) return reply({ error: "Ungültiger PDF-Pfad." }, 400);
      const { data: blob, error } = await supabase.storage.from("document-pdfs").download(expectedPath);
      if (error || !blob) throw error ?? new Error("PDF fehlt.");
      await verifyReceiptPdf(new Uint8Array(await blob.arrayBuffer()), body.sha256!);
      const { data: registered, error: registerError } = await supabase.rpc("register_quittung_document", {
        p_quittung_id: receipt.id, p_expected_version: body.version, p_pdf_path: expectedPath, p_sha256: body.sha256,
      });
      if (registerError || !registered) throw registerError ?? new Error("PDF konnte nicht archiviert werden.");
      return documentResponse(registered as ArchivedDocument);
    }

    if (!existing || existing.id !== body.documentId) return reply({ error: "Archiviertes PDF dieser Version fehlt." }, 409);
    const { data: company, error: companyError } = await supabase.from("companies")
      .select("id,email,notification_email,default_language,resend_enabled,resend_from_email,resend_from_name")
      .eq("id", receipt.company_id).returns<CompanyConfig[]>().single();
    if (companyError || !company) throw companyError ?? new Error("Firma nicht gefunden.");
    const secrets = await loadCompanySecrets(supabase, receipt.company_id);
    const apiKey = company.resend_enabled && secrets.resend_api_key ? secrets.resend_api_key : Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("E-Mail-Versand ist nicht konfiguriert.");
    const fromEmail = company.resend_enabled && company.resend_from_email ? company.resend_from_email : getSenderEmail();
    const sender = receipt.company_snapshot;
    const fromName = company.resend_from_name || sender.company_name;
    const brand = emailBrandColor(sender.primary_color);
    const { data: pdfBlob, error: pdfError } = await supabase.storage.from("document-pdfs").download(existing.pdf_path);
    if (pdfError || !pdfBlob) throw pdfError ?? new Error("Archiviertes PDF fehlt.");
    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    await verifyReceiptPdf(pdfBytes, existing.sha256);
    const attachment = { filename: `Quittung-${receipt.quittung_nr}.pdf`, content: bytesToBase64(pdfBytes) };

    const makeRecipient = (kind: "customer" | "firma", email: string, localeValue: string | null): ReceiptRecipient => {
      const locale = toLocale(localeValue);
      return { kind, email: email.trim().toLowerCase(), locale,
        subject: buildInvoiceEmailSubject({ kind: "quittung", locale, documentNumber: receipt.quittung_nr, companyName: sender.company_name }),
        html: buildInvoiceEmailHtml({
          kind: "quittung", locale, brand, companyName: sender.company_name, documentNumber: receipt.quittung_nr,
          datum: receipt.datum, customerName: receipt.customer_name,
          lines: receiptEmailLines(receipt.positionen, locale),
          zwischensumme: receipt.zwischensumme, rabatt: receipt.rabatt, mwstSatz: receipt.mwst_satz,
          mwstBetrag: receipt.mwst_betrag, total: receipt.gesamttotal,
          extraSection: receiptEmailPaymentHtml(receipt, locale),
          footerParts: [sender.iban || "", sender.bank_name || "", sender.mwst_number || "", sender.phone || ""],
        }),
      };
    };
    const recipients: ReceiptRecipient[] = [];
    if (receipt.customer_email) recipients.push(makeRecipient("customer", receipt.customer_email, receipt.language));
    const internalEmail = company.notification_email || company.email;
    if (internalEmail) recipients.push(makeRecipient("firma", internalEmail, company.default_language));
    const store: ReceiptDispatchStore = {
      claim: async recipient => {
        const { data, error } = await supabase.rpc("claim_quittung_dispatch", {
          p_document_id: existing.id, p_kind: recipient.kind, p_email: recipient.email,
        });
        if (error) throw error;
        if (data) {
          const claim = data as ClaimedDispatch;
          return { state: "claimed", id: claim.id, createdAt: claim.created_at };
        }
        const { data: prior, error: readError } = await supabase.from("quittung_dispatches").select("status")
          .eq("document_id", existing.id).eq("recipient_kind", recipient.kind).eq("recipient_email", recipient.email).single();
        if (readError) throw readError;
        return { state: prior?.status === "sent" ? "sent" : "busy" };
      },
      complete: async (id, providerId) => {
        const { error } = await supabase.from("quittung_dispatches").update({ status: "sent", provider_id: providerId, sent_at: new Date().toISOString(), error: null }).eq("id", id);
        if (error) throw error;
      },
      fail: async (id, reason) => {
        const { error } = await supabase.from("quittung_dispatches").update({ status: "failed", error: reason }).eq("id", id);
        if (error) throw error;
      },
      markSent: async () => {
        const { error } = await supabase.from("quittungen").update({ sent_at: new Date().toISOString() })
          .eq("id", receipt.id).eq("version", receipt.version).select("id").single();
        if (error) throw error;
      },
    };
    const result = await dispatchReceipt(recipients, store, async (recipient, idempotencyKey) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [recipient.email], subject: recipient.subject, html: recipient.html, attachments: [attachment] }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string") {
        const message = result && typeof result === "object" && "message" in result && typeof result.message === "string" ? result.message : `E-Mail-Versand fehlgeschlagen (${response.status}).`;
        throw new Error(message);
      }
      await logEmail({ emailType: `quittung_${recipient.kind}`, recipientEmail: recipient.email, subject: recipient.subject,
        status: "sent", companyId: receipt.company_id, language: recipient.locale,
        metadata: { quittung_id: receipt.id, document_id: existing.id, resend_id: result.id } });
      return result.id;
    });
    if (result.failures.length) return reply({ success: false, partial: result.sentTo.length > 0, sent_to: result.sentTo, error: result.failures.join(" ") }, 502);
    return reply({ success: true, sent_to: result.sentTo });
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message : "Dokumentvorgang fehlgeschlagen.";
    console.error("send-quittung:", message);
    return reply({ error: message }, 500);
  }
});
