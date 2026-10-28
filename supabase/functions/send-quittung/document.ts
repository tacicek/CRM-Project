/** Pure receipt document/dispatch rules. I/O belongs to the Edge adapter. */
export type DocumentAction = "lookup" | "prepare" | "archive" | "send";
export interface DocumentRequest {
  action: DocumentAction;
  quittungId: string;
  version: number;
  sha256?: string;
  pdfPath?: string;
  documentId?: string;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
export const parseDocumentRequest = (value: unknown): DocumentRequest => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültige Anfrage.");
  const row = value as Record<string, unknown>;
  if (row.action !== "lookup" && row.action !== "prepare" && row.action !== "archive" && row.action !== "send") {
    throw new Error("Ungültige Dokumentaktion.");
  }
  if (typeof row.quittungId !== "string" || !UUID.test(row.quittungId) ||
      typeof row.version !== "number" || !Number.isSafeInteger(row.version) || row.version < 1) {
    throw new Error("Dokument-ID und Version sind erforderlich.");
  }
  const result: DocumentRequest = { action: row.action, quittungId: row.quittungId, version: row.version };
  if (row.action === "prepare" || row.action === "archive") {
    if (typeof row.sha256 !== "string" || !SHA256.test(row.sha256)) throw new Error("Ungültige PDF-Prüfsumme.");
    result.sha256 = row.sha256;
  }
  if (row.action === "archive") {
    if (typeof row.pdfPath !== "string") throw new Error("PDF-Pfad fehlt.");
    result.pdfPath = row.pdfPath;
  }
  if (row.action === "send") {
    if (typeof row.documentId !== "string" || !UUID.test(row.documentId)) throw new Error("Archiviertes PDF fehlt.");
    result.documentId = row.documentId;
  }
  return result;
};

export const receiptPdfPath = (companyId: string, receiptId: string, version: number, hash: string): string =>
  `${companyId}/quittung/${receiptId}/${version}/${hash}.pdf`;

/**
 * The service SDK prefixes signed links with its private Docker URL. Browsers
 * need the configured HTTPS Storage gateway, or this CRM's HTTPS Storage proxy
 * when Kong's public endpoint is HTTP-only. Never trust request Origin/Host.
 */
export const publicReceiptPdfUrl = (
  signedUrl: string,
  publicSupabaseUrl: string | undefined,
  appUrl: string,
): string => {
  const signed = new URL(signedUrl);
  if (!signed.pathname.startsWith("/storage/v1/object/sign/document-pdfs/")) {
    throw new Error("Ungültiger PDF-Downloadpfad.");
  }
  const publicApi = publicSupabaseUrl ? new URL(publicSupabaseUrl) : null;
  const base = publicApi?.protocol === "https:" ? publicApi : new URL(appUrl);
  const localDevelopment = base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if ((base.protocol !== "https:" && !localDevelopment) || base.username || base.password) {
    throw new Error("Die öffentliche PDF-Adresse ist nicht korrekt konfiguriert.");
  }
  base.pathname = base.pathname.replace(/\/$/, "") + signed.pathname;
  base.search = signed.search;
  base.hash = "";
  return base.href;
};

export const verifyReceiptPdf = async (bytes: Uint8Array, expectedHash: string): Promise<void> => {
  if (bytes.length < 8 || bytes.length > 15 * 1024 * 1024 ||
      new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("Ungültiges PDF (maximal 15 MB).");
  }
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
  if (hash !== expectedHash) throw new Error("Die PDF-Prüfsumme stimmt nicht überein.");
};

export interface ReceiptRecipient {
  kind: "customer" | "firma";
  email: string;
  subject: string;
  html: string;
  locale: "de" | "fr" | "en";
}
export type DispatchClaim = { state: "sent" } | { state: "busy" } |
  { state: "claimed"; id: string; createdAt: string };
export interface ReceiptDispatchStore {
  claim(recipient: ReceiptRecipient): Promise<DispatchClaim>;
  complete(id: string, providerId: string): Promise<void>;
  fail(id: string, reason: string): Promise<void>;
  markSent(): Promise<void>;
}
export interface ReceiptDeliveryResult { sentTo: string[]; failures: string[] }

/** Retries reuse a persisted dispatch id. A DB failure after delivery is never reported as success. */
export const dispatchReceipt = async (
  recipients: ReceiptRecipient[],
  store: ReceiptDispatchStore,
  deliver: (recipient: ReceiptRecipient, idempotencyKey: string) => Promise<string>,
  now = Date.now(),
): Promise<ReceiptDeliveryResult> => {
  if (recipients.length === 0) throw new Error("Kein Empfänger vorhanden.");
  const sentTo: string[] = [];
  const failures: string[] = [];
  for (const recipient of recipients) {
    const claim = await store.claim(recipient);
    if (claim.state === "sent") { sentTo.push(recipient.kind); continue; }
    if (claim.state === "busy") { failures.push(`${recipient.kind}: Versand läuft bereits.`); continue; }
    // Resend retains idempotency keys for 24h. Beyond that, an uncertain prior
    // delivery must be reconciled instead of automatically risking a second email.
    if (now - new Date(claim.createdAt).getTime() >= 23 * 60 * 60 * 1000) {
      failures.push(`${recipient.kind}: Versandstatus prüfen; Wiederholungsfrist abgelaufen.`);
      continue;
    }
    let providerId: string;
    try {
      providerId = await deliver(recipient, `quittung/${claim.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Versand fehlgeschlagen.";
      await store.fail(claim.id, message);
      failures.push(`${recipient.kind}: ${message}`);
      continue;
    }
    await store.complete(claim.id, providerId);
    sentTo.push(recipient.kind);
  }
  const customerRequired = recipients.some(r => r.kind === "customer");
  if (sentTo.length > 0 && (!customerRequired || sentTo.includes("customer"))) await store.markSent();
  return { sentTo, failures };
};
