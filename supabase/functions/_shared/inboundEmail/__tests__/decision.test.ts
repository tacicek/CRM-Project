import { describe, expect, it } from "vitest";

import { decide, DEFAULT_THRESHOLDS, resolveThresholds } from "../decision.ts";
import type { ParsedInquiryResult } from "../types.ts";

const result = (overrides: Partial<ParsedInquiryResult> = {}): ParsedInquiryResult => ({
  isInquiry: true,
  serviceType: "umzug_privat",
  language: "de",
  confidenceScore: 0.9,
  rejectionReason: null,
  missingCriticalFields: [],
  extracted: {},
  ...overrides,
});

describe("decide", () => {
  it("creates a lead at or above the auto-approve threshold", () => {
    expect(decide(result({ confidenceScore: 0.85 })).outcome).toBe("lead_created");
    expect(decide(result({ confidenceScore: 0.99 })).outcome).toBe("lead_created");
  });

  it("routes to review just below the auto-approve threshold", () => {
    expect(decide(result({ confidenceScore: 0.8499 })).outcome).toBe("needs_review");
    expect(decide(result({ confidenceScore: 0.6 })).outcome).toBe("needs_review");
  });

  it("rejects below the review threshold", () => {
    expect(decide(result({ confidenceScore: 0.5999 })).outcome).toBe("rejected");
    expect(decide(result({ confidenceScore: 0 })).outcome).toBe("rejected");
  });

  it("rejects a non-inquiry regardless of how confident the model claims to be", () => {
    const decision = decide(result({ isInquiry: false, confidenceScore: 1, rejectionReason: "Newsletter" }));
    expect(decision.outcome).toBe("rejected");
    expect(decision.reason).toBe("Newsletter");
  });

  it("never auto-creates without a service type — there would be nothing to map", () => {
    const decision = decide(result({ serviceType: null, confidenceScore: 0.99 }));
    expect(decision.outcome).toBe("needs_review");
  });

  it("names the missing fields in the review reason", () => {
    const decision = decide(result({ confidenceScore: 0.7, missingCriticalFields: ["to_city"] }));
    expect(decision.reason).toContain("to_city");
  });

  it("honours custom thresholds", () => {
    const strict = { autoApprove: 0.95, review: 0.8 };
    expect(decide(result({ confidenceScore: 0.9 }), strict).outcome).toBe("needs_review");
    expect(decide(result({ confidenceScore: 0.96 }), strict).outcome).toBe("lead_created");
  });
});

describe("resolveThresholds", () => {
  const env = (values: Record<string, string>) => (key: string) => values[key];

  it("falls back to the documented defaults", () => {
    expect(resolveThresholds(env({}))).toEqual(DEFAULT_THRESHOLDS);
  });

  it("reads configured values", () => {
    const thresholds = resolveThresholds(
      env({
        INBOUND_EMAIL_AUTO_APPROVE_THRESHOLD: "0.9",
        INBOUND_EMAIL_REVIEW_THRESHOLD: "0.5",
      }),
    );
    expect(thresholds).toEqual({ autoApprove: 0.9, review: 0.5 });
  });

  it("ignores values that are not usable probabilities", () => {
    const thresholds = resolveThresholds(
      env({ INBOUND_EMAIL_AUTO_APPROVE_THRESHOLD: "85", INBOUND_EMAIL_REVIEW_THRESHOLD: "abc" }),
    );
    expect(thresholds).toEqual(DEFAULT_THRESHOLDS);
  });

  it("refuses an inverted pair — it would auto-approve everything", () => {
    const thresholds = resolveThresholds(
      env({
        INBOUND_EMAIL_AUTO_APPROVE_THRESHOLD: "0.4",
        INBOUND_EMAIL_REVIEW_THRESHOLD: "0.9",
      }),
    );
    expect(thresholds).toEqual(DEFAULT_THRESHOLDS);
  });
});
