import { describe, expect, it } from "vitest";

import { parseInquiryResult } from "../parsedInquiry.ts";

const answer = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    is_inquiry: true,
    detected_service_type: "umzug_privat",
    language: "de",
    confidence_score: 0.91,
    rejection_reason: null,
    missing_critical_fields: ["to_city"],
    first_name: "Max",
    last_name: "Müller",
    phone: "079 123 45 67",
    from_plz: "8000",
    from_city: "Zürich",
    from_rooms: 3.5,
    from_floor: 2,
    from_has_elevator: false,
    ...overrides,
  });

describe("parseInquiryResult", () => {
  it("accepts a well-formed answer", () => {
    const parsed = parseInquiryResult(answer());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.isInquiry).toBe(true);
    expect(parsed.value.serviceType).toBe("umzug_privat");
    expect(parsed.value.confidenceScore).toBe(0.91);
    expect(parsed.value.missingCriticalFields).toEqual(["to_city"]);
    expect(parsed.value.extracted.from_rooms).toBe(3.5);
    expect(parsed.value.extracted.from_has_elevator).toBe(false);
  });

  it("unwraps a fenced code block", () => {
    const parsed = parseInquiryResult("```json\n" + answer() + "\n```");
    expect(parsed.ok).toBe(true);
  });

  it("rejects output that is not JSON", () => {
    expect(parseInquiryResult("Gerne! Hier ist das Ergebnis:")).toEqual({
      ok: false,
      reason: "not_json",
    });
  });

  it("rejects a JSON array", () => {
    expect(parseInquiryResult("[1,2,3]")).toEqual({ ok: false, reason: "not_an_object" });
  });

  it("rejects an answer without is_inquiry", () => {
    const parsed = parseInquiryResult(JSON.stringify({ confidence_score: 0.9 }));
    expect(parsed).toEqual({ ok: false, reason: "missing_is_inquiry" });
  });

  it("rejects an out-of-range confidence instead of clamping it", () => {
    // Clamping 5 → 1 would auto-create a lead off a nonsense answer.
    expect(parseInquiryResult(answer({ confidence_score: 5 }))).toEqual({
      ok: false,
      reason: "missing_confidence",
    });
    expect(parseInquiryResult(answer({ confidence_score: "sehr sicher" }))).toEqual({
      ok: false,
      reason: "missing_confidence",
    });
  });

  it("drops fields the model invented", () => {
    const parsed = parseInquiryResult(answer({ internal_admin_flag: true, price_chf: 9000 }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.extracted).not.toHaveProperty("internal_admin_flag");
    expect(parsed.value.extracted).not.toHaveProperty("price_chf");
  });

  it("drops values outside their plausible range", () => {
    const parsed = parseInquiryResult(answer({ from_floor: 400, from_rooms: 900 }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.extracted).not.toHaveProperty("from_floor");
    expect(parsed.value.extracted).not.toHaveProperty("from_rooms");
  });

  it("drops a malformed PLZ and an impossible date", () => {
    const parsed = parseInquiryResult(answer({ from_plz: "80", preferred_date: "2026-02-31" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.extracted).not.toHaveProperty("from_plz");
    expect(parsed.value.extracted).not.toHaveProperty("preferred_date");
  });

  it("keeps a valid date", () => {
    const parsed = parseInquiryResult(answer({ preferred_date: "2026-09-15" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.extracted.preferred_date).toBe("2026-09-15");
  });

  it("treats an unknown service type as unrecognised rather than passing it on", () => {
    const parsed = parseInquiryResult(answer({ detected_service_type: "raumfahrt" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.serviceType).toBeNull();
  });

  it("falls back to German for an unsupported language", () => {
    const parsed = parseInquiryResult(answer({ language: "it" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.language).toBe("de");
  });

  it("keeps a prompt-injection attempt schema-bound", () => {
    // The model was talked into answering "approved": the schema has no such
    // field, and the confidence it reports still has to survive validation.
    const parsed = parseInquiryResult(
      JSON.stringify({
        is_inquiry: true,
        detected_service_type: "umzug_privat",
        confidence_score: 0.5,
        approved: true,
        override_threshold: 0,
        processing_status: "lead_created",
        first_name: "Max",
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.confidenceScore).toBe(0.5);
    expect(parsed.value.extracted).not.toHaveProperty("approved");
    expect(parsed.value.extracted).not.toHaveProperty("processing_status");
    expect(Object.keys(parsed.value)).not.toContain("approved");
  });

  it("string numbers and string booleans are still understood", () => {
    const parsed = parseInquiryResult(answer({ from_floor: "3", from_has_elevator: "true" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.extracted.from_floor).toBe(3);
    expect(parsed.value.extracted.from_has_elevator).toBe(true);
  });
});
