/**
 * Provider-independent inbound-email domain types.
 *
 * Resend-specific payload shapes stop at `normalize.ts`. Everything downstream
 * (filters, prompt, decision, lead mapping) works on `NormalizedInboundEmail`
 * only — swapping the provider later must not ripple through the domain.
 *
 * The extracted-field vocabulary is deliberately NOT a new one: it is the
 * schema `extract-anfrage-ai` and the manual-import preview already speak
 * (`detected_service_type`, `first_name`, `from_has_elevator`, …). A second
 * vocabulary would mean a second mapping to `leads` and a second place to get
 * it wrong.
 */

export type InboundProvider = "resend";

export interface NormalizedAttachment {
  providerAttachmentId: string | null;
  filename: string;
  contentType: string;
  /** Only known once the message is fetched; the webhook omits it. */
  sizeBytes: number | null;
}

export interface NormalizedInboundEmail {
  provider: InboundProvider;
  /** Idempotency key — the provider's own id for this message. */
  providerMessageId: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  /** Plain text. HTML is converted, never kept. */
  textBody: string;
  /** True when subject or body hit a length cap. */
  truncated: boolean;
  receivedAt: string;
  attachments: NormalizedAttachment[];
  /** Lower-cased header names. Used by the deterministic pre-filters. */
  headers: Record<string, string>;
}

/**
 * Validated model output. Keys mirror the existing extraction schema; only
 * fields the model actually filled are present.
 */
export type ExtractedLeadFields = Record<
  string,
  string | number | boolean | null
>;

export interface ParsedInquiryResult {
  /** Is this a service request at all — the question `extract-anfrage-ai` never asks. */
  isInquiry: boolean;
  serviceType: string | null;
  /** Document language of the CUSTOMER — start of the language chain. */
  language: "de" | "fr" | "en";
  confidenceScore: number;
  rejectionReason: string | null;
  missingCriticalFields: string[];
  extracted: ExtractedLeadFields;
}

export type ProcessingStatus =
  | "received"
  | "processing"
  | "needs_review"
  | "lead_created"
  | "rejected"
  | "failed";
