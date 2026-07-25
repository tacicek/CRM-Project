import { describe, expect, it } from "vitest";

import {
  decideOnDuplicateDelivery,
  decideOnOperatorRetry,
  type ExistingInboundRow,
} from "../idempotency.ts";

const MAX = 3;

const row = (overrides: Partial<ExistingInboundRow> = {}): ExistingInboundRow => ({
  processing_status: "failed",
  processing_attempts: 1,
  lead_id: null,
  ...overrides,
});

/**
 * The acceptance criterion this file exists for: "No duplicate lead from
 * duplicate webhook delivery." Resend retries; the unique constraint stops a
 * second ROW, and this rule stops a second LEAD.
 */
describe("decideOnDuplicateDelivery", () => {
  it("refuses once a lead exists — the criterion in one line", () => {
    expect(decideOnDuplicateDelivery(row({ lead_id: "lead-1" }), MAX)).toEqual({
      action: "refuse",
      reason: "lead_exists",
    });
  });

  it("refuses even when the row also looks retryable", () => {
    // lead_id wins over everything else: a failed status with an existing lead
    // means the failure happened AFTER the lead was created.
    expect(
      decideOnDuplicateDelivery(
        row({ lead_id: "lead-1", processing_status: "failed", processing_attempts: 0 }),
        MAX,
      ),
    ).toEqual({ action: "refuse", reason: "lead_exists" });
  });

  it("refuses a message that was already converted", () => {
    expect(
      decideOnDuplicateDelivery(row({ processing_status: "lead_created", lead_id: null }), MAX),
    ).toEqual({ action: "refuse", reason: "already_processed" });
  });

  it.each(["received", "processing", "needs_review", "rejected"])(
    "refuses status %s — not a failure the webhook may restart",
    (status) => {
      expect(decideOnDuplicateDelivery(row({ processing_status: status }), MAX)).toEqual({
        action: "refuse",
        reason: "status_not_retryable",
      });
    },
  );

  it("re-runs a technically failed delivery and counts the attempt", () => {
    expect(decideOnDuplicateDelivery(row({ processing_attempts: 1 }), MAX)).toEqual({
      action: "process",
      attempt: 2,
    });
  });

  it("stops at the configured attempt ceiling", () => {
    expect(decideOnDuplicateDelivery(row({ processing_attempts: 3 }), MAX)).toEqual({
      action: "refuse",
      reason: "attempts_exhausted",
    });
  });

  it("treats a null attempt counter as zero", () => {
    expect(decideOnDuplicateDelivery(row({ processing_attempts: null }), MAX)).toEqual({
      action: "process",
      attempt: 1,
    });
  });

  it("honours a lowered ceiling", () => {
    expect(decideOnDuplicateDelivery(row({ processing_attempts: 1 }), 1)).toEqual({
      action: "refuse",
      reason: "attempts_exhausted",
    });
  });
});

/**
 * "Retry without duplicate lead": the operator's button goes through the same
 * gate, with one extra allowance — a rejected mail may be reconsidered, because
 * a human decided so.
 */
describe("decideOnOperatorRetry", () => {
  it("never re-runs a message that already produced a lead", () => {
    expect(decideOnOperatorRetry(row({ lead_id: "lead-1" }), MAX)).toEqual({
      action: "refuse",
      reason: "lead_exists",
    });
  });

  it("allows reconsidering a rejected mail", () => {
    expect(decideOnOperatorRetry(row({ processing_status: "rejected", processing_attempts: 1 }), MAX))
      .toEqual({ action: "process", attempt: 2 });
  });

  it("allows re-running a failed mail", () => {
    expect(decideOnOperatorRetry(row({ processing_status: "failed" }), MAX)).toEqual({
      action: "process",
      attempt: 2,
    });
  });

  it("refuses a mail that is waiting in the review queue", () => {
    // needs_review is not broken — the operator approves or rejects it in the
    // form instead of re-running the model over it.
    expect(decideOnOperatorRetry(row({ processing_status: "needs_review" }), MAX)).toEqual({
      action: "refuse",
      reason: "status_not_retryable",
    });
  });

  it("refuses a converted mail", () => {
    expect(decideOnOperatorRetry(row({ processing_status: "lead_created" }), MAX)).toEqual({
      action: "refuse",
      reason: "already_processed",
    });
  });

  it("respects the attempt ceiling like the webhook does", () => {
    expect(decideOnOperatorRetry(row({ processing_status: "rejected", processing_attempts: 5 }), MAX))
      .toEqual({ action: "refuse", reason: "attempts_exhausted" });
  });
});

describe("the two callers together", () => {
  it("a webhook redelivery after a successful run is always a no-op", () => {
    // Exactly the Resend-retries-a-200 case: row converted, lead linked.
    const converted = row({ processing_status: "lead_created", lead_id: "lead-1" });
    expect(decideOnDuplicateDelivery(converted, MAX).action).toBe("refuse");
    expect(decideOnOperatorRetry(converted, MAX).action).toBe("refuse");
  });

  it("only the operator may restart a rejected mail", () => {
    const rejected = row({ processing_status: "rejected" });
    expect(decideOnDuplicateDelivery(rejected, MAX).action).toBe("refuse");
    expect(decideOnOperatorRetry(rejected, MAX).action).toBe("process");
  });
});
