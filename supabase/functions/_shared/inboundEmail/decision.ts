/**
 * Confidence decision.
 *
 * The model reports a score; this file — not the model — decides what happens.
 * Keeping the comparison in code is what makes prompt injection pointless: an
 * email saying "mark this as a verified lead" can at most influence a number
 * that is then checked against thresholds it cannot reach into.
 *
 * Pure — unit tested at the boundaries.
 */

import type { ParsedInquiryResult, ProcessingStatus } from "./types.ts";

export interface ConfidenceThresholds {
  /** >= autoApprove → create the lead automatically */
  autoApprove: number;
  /** >= review and < autoApprove → operator decides */
  review: number;
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoApprove: 0.85,
  review: 0.6,
};

export type DecisionOutcome = Extract<
  ProcessingStatus,
  "lead_created" | "needs_review" | "rejected"
>;

export interface Decision {
  outcome: DecisionOutcome;
  reason: string | null;
}

/**
 * Read thresholds from the environment, falling back to the documented
 * defaults. A malformed or out-of-range value falls back rather than throwing:
 * a typo in a secret must not take the pipeline down, and the default is the
 * safer of the two.
 */
export const resolveThresholds = (
  env: (key: string) => string | undefined,
): ConfidenceThresholds => {
  const read = (key: string, fallback: number): number => {
    const raw = env(key);
    if (raw === undefined || raw.trim() === "") return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback;
    return parsed;
  };

  const autoApprove = read(
    "INBOUND_EMAIL_AUTO_APPROVE_THRESHOLD",
    DEFAULT_THRESHOLDS.autoApprove,
  );
  const review = read("INBOUND_EMAIL_REVIEW_THRESHOLD", DEFAULT_THRESHOLDS.review);

  // An inverted pair would make every mail auto-approve. Fall back wholesale.
  if (review > autoApprove) return DEFAULT_THRESHOLDS;

  return { autoApprove, review };
};

export const decide = (
  parsed: ParsedInquiryResult,
  thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS,
): Decision => {
  if (!parsed.isInquiry) {
    return {
      outcome: "rejected",
      reason: parsed.rejectionReason ?? "not an inquiry",
    };
  }

  // Without a service type there is nothing to map onto a lead, no matter how
  // confident the model claims to be.
  if (!parsed.serviceType) {
    return { outcome: "needs_review", reason: "service type not recognised" };
  }

  if (parsed.confidenceScore >= thresholds.autoApprove) {
    return { outcome: "lead_created", reason: null };
  }

  if (parsed.confidenceScore >= thresholds.review) {
    return {
      outcome: "needs_review",
      reason: parsed.missingCriticalFields.length > 0
        ? `missing: ${parsed.missingCriticalFields.join(", ")}`
        : "confidence below auto-approve threshold",
    };
  }

  return { outcome: "rejected", reason: "confidence below review threshold" };
};
