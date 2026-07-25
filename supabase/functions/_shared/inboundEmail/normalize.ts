/**
 * Resend payload → provider-independent `NormalizedInboundEmail`.
 *
 * Two Resend specifics drive this file:
 *
 *   1. The `email.received` webhook carries METADATA ONLY — no body, no
 *      headers, no attachment sizes. The body arrives from a second call
 *      (`GET /emails/receiving/{id}`), so normalisation takes both objects.
 *   2. Resend keeps the message on its side. That is why nothing here tries to
 *      preserve the raw mail: it stays retrievable at the source, and the CRM
 *      only ever stores a capped plain-text preview.
 *
 * Everything in this file is pure — no network, no Deno API — so it is covered
 * by unit tests.
 */

import type {
  NormalizedAttachment,
  NormalizedInboundEmail,
} from "./types.ts";

export const MAX_SUBJECT_CHARS = 500;
export const DEFAULT_MAX_BODY_CHARS = 30_000;
export const BODY_PREVIEW_CHARS = 2_000;

/** Shape of `payload.data` in the `email.received` webhook. */
export interface ResendInboundWebhookData {
  email_id?: unknown;
  created_at?: unknown;
  from?: unknown;
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  received_for?: unknown;
  message_id?: unknown;
  subject?: unknown;
  attachments?: unknown;
}

/** Shape of `GET /emails/receiving/{id}`. */
export interface ResendReceivedEmail {
  id?: unknown;
  from?: unknown;
  to?: unknown;
  cc?: unknown;
  subject?: unknown;
  text?: unknown;
  html?: unknown;
  headers?: unknown;
  created_at?: unknown;
  attachments?: unknown;
}

export type WebhookParse =
  | { ok: true; eventType: string; data: ResendInboundWebhookData; emailId: string }
  | { ok: false; reason: "not_json" | "unsupported_event" | "missing_email_id" };

export const INBOUND_EVENT_TYPE = "email.received";

/**
 * Parse and validate the webhook envelope. Runs AFTER signature verification —
 * an unverified body is never handed to this function.
 */
export const parseResendWebhook = (rawBody: string): WebhookParse => {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "not_json" };
  }

  const eventType = typeof payload.type === "string" ? payload.type : "";
  if (eventType !== INBOUND_EVENT_TYPE) {
    return { ok: false, reason: "unsupported_event" };
  }

  const data = (payload.data ?? {}) as ResendInboundWebhookData;
  const emailId = typeof data.email_id === "string" ? data.email_id : "";
  if (!emailId) return { ok: false, reason: "missing_email_id" };

  return { ok: true, eventType, data, emailId };
};

/** `"Max Müller" <max@example.com>` → name + address. */
export const parseAddress = (
  value: unknown,
): { email: string; name: string | null } => {
  if (typeof value !== "string") return { email: "", name: null };
  const trimmed = value.trim();

  const angled = trimmed.match(/^(.*)<([^>]+)>\s*$/);
  if (angled) {
    const name = angled[1].trim().replace(/^["']|["']$/g, "").trim();
    return { email: angled[2].trim().toLowerCase(), name: name || null };
  }
  return { email: trimmed.toLowerCase(), name: null };
};

const toEmailList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => parseAddress(entry).email)
    .filter((email) => email.length > 0);
};

const asRecordOfStrings = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key.toLowerCase()] = raw;
    else if (Array.isArray(raw) && typeof raw[0] === "string") out[key.toLowerCase()] = raw[0];
  }
  return out;
};

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * HTML → plain text. Not a renderer: the goal is to get readable text for the
 * model and the preview. Untrusted HTML is never stored or shown anywhere, so
 * this only has to be lossy in a safe direction.
 */
export const htmlToText = (html: string): string =>
  html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#\d+;|&[a-z]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Markers that start a quoted reply chain. Everything from the marker on is
 * an older message, not this customer's request — feeding it to the model
 * invites wrong dates and wrong addresses.
 */
const QUOTE_MARKERS: RegExp[] = [
  /^\s*-{2,}\s*(original message|urspr[üu]ngliche nachricht|message d'origine)\s*-{2,}\s*$/i,
  /^\s*(on|am|le)\b.{0,120}\b(wrote|schrieb|écrit|ecrit)\s*:\s*$/i,
  /^\s*(von|from|de)\s*:\s*.+<[^>]+>\s*$/i,
  /^\s*_{5,}\s*$/,
];

/** RFC 3676 signature delimiter: a line consisting of exactly "-- ". */
const SIGNATURE_DELIMITER = /^-{2}\s?$/;

/**
 * Drop quoted history and the sender's signature block.
 *
 * Conservative on purpose: a marker in the first two lines is ignored, because
 * a mail that opens with "Am 3. Juli schrieb mir der Vermieter:" is still a
 * genuine request. Over-trimming a real inquiry costs a customer; leaving a
 * quote in costs a few tokens.
 */
export const stripQuotedReply = (text: string): string => {
  const lines = text.split("\n");
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (QUOTE_MARKERS.some((marker) => marker.test(line))) {
      return lines.slice(0, i).join("\n").trimEnd();
    }
    if (SIGNATURE_DELIMITER.test(line)) {
      return lines.slice(0, i).join("\n").trimEnd();
    }
  }
  // A block of ">"-quoted lines at the end is history as well.
  let end = lines.length;
  while (end > 0 && (lines[end - 1].trim() === "" || lines[end - 1].startsWith(">"))) {
    end--;
  }
  return end === lines.length ? text.trimEnd() : lines.slice(0, end).join("\n").trimEnd();
};

const normalizeAttachments = (
  webhookAttachments: unknown,
  fetchedAttachments: unknown,
): NormalizedAttachment[] => {
  // The fetched message is the richer source (it carries `size`); the webhook
  // list is the fallback when the fetch was skipped.
  const source = Array.isArray(fetchedAttachments) && fetchedAttachments.length > 0
    ? fetchedAttachments
    : Array.isArray(webhookAttachments)
    ? webhookAttachments
    : [];

  return source.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      providerAttachmentId: typeof item.id === "string" ? item.id : null,
      filename: typeof item.filename === "string" ? item.filename : "unknown",
      contentType: typeof item.content_type === "string"
        ? item.content_type
        : "application/octet-stream",
      sizeBytes: typeof item.size === "number" ? item.size : null,
    };
  });
};

export const normalizeInboundEmail = (opts: {
  webhookData: ResendInboundWebhookData;
  fetched: ResendReceivedEmail | null;
  maxBodyChars?: number;
}): NormalizedInboundEmail => {
  const { webhookData, fetched } = opts;
  const maxBodyChars = opts.maxBodyChars ?? DEFAULT_MAX_BODY_CHARS;

  const sender = parseAddress(fetched?.from ?? webhookData.from);

  const rawSubject = typeof (fetched?.subject ?? webhookData.subject) === "string"
    ? String(fetched?.subject ?? webhookData.subject)
    : "";
  const subject = rawSubject.slice(0, MAX_SUBJECT_CHARS);

  const text = typeof fetched?.text === "string" ? fetched.text : "";
  const html = typeof fetched?.html === "string" ? fetched.html : "";
  // Plain text wins. HTML is only a fallback, and only after conversion.
  const bodySource = text.trim().length > 0 ? text : html ? htmlToText(html) : "";
  const body = stripQuotedReply(bodySource.replace(/\r\n/g, "\n"));
  const textBody = body.slice(0, maxBodyChars);

  const receivedAt = typeof webhookData.created_at === "string"
    ? webhookData.created_at
    : typeof fetched?.created_at === "string"
    ? fetched.created_at
    : new Date().toISOString();

  return {
    provider: "resend",
    providerMessageId: typeof webhookData.email_id === "string" ? webhookData.email_id : "",
    fromEmail: sender.email,
    fromName: sender.name,
    toEmails: toEmailList(fetched?.to ?? webhookData.to),
    ccEmails: toEmailList(fetched?.cc ?? webhookData.cc),
    subject,
    textBody,
    truncated: body.length > maxBodyChars || rawSubject.length > MAX_SUBJECT_CHARS,
    receivedAt,
    attachments: normalizeAttachments(webhookData.attachments, fetched?.attachments),
    headers: asRecordOfStrings(fetched?.headers),
  };
};

/** Capped plain-text preview — the only body-ish thing that reaches Postgres. */
export const buildBodyPreview = (email: NormalizedInboundEmail): string =>
  email.textBody.slice(0, BODY_PREVIEW_CHARS);
