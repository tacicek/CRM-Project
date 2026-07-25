/**
 * Deterministic pre-filters — cheap, explainable rejections before any model
 * call. They exist for two reasons: an unauthenticated endpoint should not turn
 * every bounce message into AI spend, and a bounce is not a judgement call.
 *
 * Deliberately narrow. A false positive here silently drops a paying customer's
 * request, which is far worse than paying for one extra classification. When in
 * doubt the mail goes to the model.
 */

import type { NormalizedInboundEmail } from "./types.ts";

export type PrefilterReason =
  | "bounce"
  | "auto_reply"
  | "empty_message"
  | "system_sender";

export interface PrefilterVerdict {
  reason: PrefilterReason;
  detail: string;
}

/** Below this, subject + body carry nothing a model could extract. */
export const MIN_USEFUL_CHARS = 20;

const BOUNCE_LOCAL_PARTS = [
  "mailer-daemon",
  "postmaster",
  "mail-daemon",
];

const BOUNCE_SUBJECTS = [
  "undeliverable",
  "delivery status notification",
  "delivery has failed",
  "mail delivery failed",
  "returned mail",
  "unzustellbar",
  "nicht zustellbar",
  "übermittlungsfehler",
  "uebermittlungsfehler",
  "echec de la remise",
  "échec de la remise",
];

const OUT_OF_OFFICE_SUBJECTS = [
  "out of office",
  "out-of-office",
  "automatic reply",
  "auto-reply",
  "autoreply",
  "abwesenheit",
  "abwesenheitsnotiz",
  "automatische antwort",
  "ferienabwesenheit",
  "absence du bureau",
  "réponse automatique",
  "reponse automatique",
  "message d'absence",
];

/**
 * Senders that never represent a person waiting for an offer. Kept short on
 * purpose — a customer writing from `info@` of their own company is normal.
 */
const SYSTEM_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "bounce",
  "bounces",
];

const localPart = (email: string): string => email.split("@")[0]?.toLowerCase() ?? "";

const subjectContains = (subject: string, needles: string[]): string | null => {
  const lower = subject.toLowerCase();
  return needles.find((needle) => lower.includes(needle)) ?? null;
};

/**
 * Is this address usable as `leads.customer_email`?
 * System senders are not — writing `mailer-daemon@…` into a lead would poison
 * the follow-up mail and the spam-score trigger's per-address counter.
 */
export const isPlausibleCustomerAddress = (email: string): boolean => {
  if (!email.includes("@")) return false;
  const local = localPart(email);
  if (SYSTEM_LOCAL_PARTS.some((part) => local === part || local.startsWith(`${part}+`))) {
    return false;
  }
  return !BOUNCE_LOCAL_PARTS.some((part) => local.startsWith(part));
};

export const runPrefilters = (
  email: NormalizedInboundEmail,
): PrefilterVerdict | null => {
  const local = localPart(email.fromEmail);

  if (BOUNCE_LOCAL_PARTS.some((part) => local.startsWith(part))) {
    return { reason: "bounce", detail: `sender ${local}` };
  }

  const bounceSubject = subjectContains(email.subject, BOUNCE_SUBJECTS);
  if (bounceSubject) {
    return { reason: "bounce", detail: `subject "${bounceSubject}"` };
  }

  // RFC 3834. Any value other than "no" marks a machine-generated message.
  const autoSubmitted = email.headers["auto-submitted"]?.toLowerCase().trim();
  if (autoSubmitted && autoSubmitted !== "no") {
    return { reason: "auto_reply", detail: `auto-submitted: ${autoSubmitted}` };
  }

  if (email.headers["x-autoreply"] || email.headers["x-autorespond"]) {
    return { reason: "auto_reply", detail: "x-autoreply header" };
  }

  const precedence = email.headers["precedence"]?.toLowerCase().trim();
  if (precedence === "bulk" || precedence === "junk" || precedence === "auto_reply") {
    return { reason: "auto_reply", detail: `precedence: ${precedence}` };
  }

  const oooSubject = subjectContains(email.subject, OUT_OF_OFFICE_SUBJECTS);
  if (oooSubject) {
    return { reason: "auto_reply", detail: `subject "${oooSubject}"` };
  }

  if (SYSTEM_LOCAL_PARTS.some((part) => local === part)) {
    return { reason: "system_sender", detail: `sender ${local}` };
  }

  if (`${email.subject} ${email.textBody}`.trim().length < MIN_USEFUL_CHARS) {
    return { reason: "empty_message", detail: "subject and body below minimum length" };
  }

  return null;
};
