import { describe, expect, it } from "vitest";
import { parseTimeEstimate, type OfferTimeEstimate } from "@/lib/offerTimeEstimate";

const valid: OfferTimeEstimate = { minHours: 2, maxHours: 4, hourlyRate: 120 };

describe("parseTimeEstimate — time_estimate JSON contract", () => {
  it("accepts the full writer-verified shape (finite numbers)", () => {
    expect(parseTimeEstimate({ minHours: 2, maxHours: 4, hourlyRate: 120 })).toEqual(valid);
    expect(parseTimeEstimate({ minHours: 0, maxHours: 0, hourlyRate: 0 })).toEqual({
      minHours: 0,
      maxHours: 0,
      hourlyRate: 0,
    });
  });

  it("returns null for absent values (null/undefined) — the legitimate 'no estimate' state", () => {
    expect(parseTimeEstimate(null)).toBeNull();
    expect(parseTimeEstimate(undefined)).toBeNull();
  });

  it("returns null for an empty object or wrong primitive (never a partial estimate)", () => {
    expect(parseTimeEstimate({})).toBeNull();
    expect(parseTimeEstimate("2h")).toBeNull();
    expect(parseTimeEstimate(42)).toBeNull();
    expect(parseTimeEstimate([2, 4, 120])).toBeNull();
  });

  it("returns null when any field is missing or the wrong type", () => {
    expect(parseTimeEstimate({ minHours: 2, maxHours: 4 })).toBeNull();
    expect(parseTimeEstimate({ minHours: "2", maxHours: 4, hourlyRate: 120 })).toBeNull();
    expect(parseTimeEstimate({ minHours: 2, maxHours: null, hourlyRate: 120 })).toBeNull();
  });

  it("rejects NaN / Infinity rather than fabricating a number", () => {
    expect(parseTimeEstimate({ minHours: NaN, maxHours: 4, hourlyRate: 120 })).toBeNull();
    expect(parseTimeEstimate({ minHours: 2, maxHours: Infinity, hourlyRate: 120 })).toBeNull();
  });

  it("does not mutate its input", () => {
    const input = { minHours: 2, maxHours: 4, hourlyRate: 120 };
    parseTimeEstimate(input);
    expect(input).toEqual({ minHours: 2, maxHours: 4, hourlyRate: 120 });
  });

  it("ignores unknown extra keys but still returns exactly the three domain fields", () => {
    expect(parseTimeEstimate({ minHours: 2, maxHours: 4, hourlyRate: 120, note: "x" })).toEqual(valid);
  });
});
