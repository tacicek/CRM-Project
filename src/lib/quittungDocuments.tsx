import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { logoToBase64 } from "@/lib/logoToBase64";
import { resolveDocumentLocale } from "@/i18n/documentLocale";
import type { Quittung, ReceiptCompanySnapshot } from "@/types/quittung.types";

const companySchema = z.object({
  company_name: z.string().min(1),
  email: z.string(),
  logo_url: z.string().nullable().optional(),
  primary_color: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  plz: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  mwst_number: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  bank_name: z.string().nullable().optional(),
  bewertungs_url: z.string().nullable().optional(),
});

/** Issued documents always use the company frozen at issuance, never today's settings. */
export const resolveQuittungCompany = (
  quittung: Quittung,
  liveCompany: ReceiptCompanySnapshot,
): ReceiptCompanySnapshot => {
  const parsed = companySchema.parse(quittung.issued_at ? quittung.company_snapshot : liveCompany);
  return { ...parsed, company_name: parsed.company_name, email: parsed.email };
};

export const generateQuittungBlob = async (
  quittung: Quittung,
  company: ReceiptCompanySnapshot,
  mode: "receipt" | "worksheet" = "receipt",
): Promise<Blob> => {
  const [{ pdf }, { QuittungPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/quittung/QuittungPDF"),
  ]);
  const sender = await prepareQuittungPdfCompany(quittung, company);
  return pdf(<QuittungPDF quittung={quittung} company={sender}
    locale={resolveDocumentLocale(quittung)} mode={mode} />).toBlob();
};

/** All receipt renderers, including drafts, use the same PNG logo preparation. */
export const prepareQuittungPdfCompany = async (
  quittung: Quittung,
  company: ReceiptCompanySnapshot,
): Promise<ReceiptCompanySnapshot> => {
  const sender = resolveQuittungCompany(quittung, company);
  const logo = await logoToBase64(sender.logo_url);
  if (sender.logo_url && !logo) throw new Error("Das gespeicherte Firmenlogo konnte nicht geladen werden.");
  return { ...sender, logo_url: logo };
};

const archivedSchema = z.object({
  document: z.object({ id: z.string().uuid(), version: z.number().int(), sha256: z.string() }).nullable(),
  url: z.string().url().optional(),
});
const preparedSchema = z.object({ path: z.string(), token: z.string() });

const invokeDocument = async (body: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await supabase.functions.invoke("send-quittung", { body });
  if (error) {
    // FunctionsHttpError preserves the server response; surface conflict/partial errors.
    if ("context" in error && error.context instanceof Response) {
      const response: unknown = await error.context.json().catch(() => null);
      const parsed = z.object({ error: z.string() }).safeParse(response);
      if (parsed.success) throw new Error(parsed.data.error);
    }
    throw error;
  }
  return data;
};

export const getArchivedQuittungDocument = async (quittung: Quittung, company: ReceiptCompanySnapshot) => {
  const identity = { quittungId: quittung.id, version: quittung.version };
  const existing = archivedSchema.parse(await invokeDocument({ ...identity, action: "lookup" }));
  if (existing.document && existing.url) return existing;

  const blob = await generateQuittungBlob(quittung, company);
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
  const prepared = preparedSchema.parse(await invokeDocument({ ...identity, action: "prepare", sha256 }));
  const { error: uploadError } = await supabase.storage.from("document-pdfs")
    .uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: "application/pdf" });
  // A concurrent identical upload or a lost upload response is reconciled by the
  // server's content hash check. No archive is accepted unless its bytes are verified.
  try {
    const archived = archivedSchema.parse(await invokeDocument({
      ...identity, action: "archive", pdfPath: prepared.path, sha256,
    }));
    if (!archived.document || !archived.url) throw new Error("PDF archive is incomplete.");
    return archived;
  } catch (error) {
    if (uploadError) throw uploadError;
    throw error;
  }
};

export const downloadQuittungDocument = async (quittung: Quittung, company: ReceiptCompanySnapshot): Promise<void> => {
  let blob: Blob;
  if (quittung.issued_at) {
    const archived = await getArchivedQuittungDocument(quittung, company);
    if (!archived.url) throw new Error("PDF archive is incomplete.");
    const response = await fetch(archived.url);
    if (!response.ok) throw new Error(`PDF download failed (${response.status}).`);
    blob = await response.blob();
  } else {
    blob = await generateQuittungBlob(quittung, company);
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Quittung-${quittung.quittung_nr || "Entwurf"}.pdf`;
  anchor.click();
  // Let the browser consume the object URL before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const sendQuittungDocument = async (quittung: Quittung, company: ReceiptCompanySnapshot): Promise<void> => {
  if (!quittung.issued_at) throw new Error("Die Quittung muss zuerst ausgestellt werden.");
  const archived = await getArchivedQuittungDocument(quittung, company);
  if (!archived.document) throw new Error("PDF archive is incomplete.");
  await invokeDocument({ action: "send", quittungId: quittung.id, version: quittung.version, documentId: archived.document.id });
};
