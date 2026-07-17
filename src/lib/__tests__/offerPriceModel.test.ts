import { describe, expect, it } from "vitest";
import {
  isPriceModel,
  parsePriceModel,
  PRICE_MODELS,
  type PriceModel,
} from "@/lib/offerPriceModel";

describe("offerPriceModel — canonical contract", () => {
  it("accepts exactly the three DB-CHECK-constrained values", () => {
    expect(isPriceModel("pauschal")).toBe(true);
    expect(isPriceModel("stundenansatz")).toBe(true);
    expect(isPriceModel("kostendach")).toBe(true);
    // PRICE_MODELS mirrors the CHECK constraint's array, in order.
    expect([...PRICE_MODELS]).toEqual(["pauschal", "stundenansatz", "kostendach"]);
  });

  it("rejects null, empty string and unknown strings (no silent fallback)", () => {
    expect(isPriceModel(null)).toBe(false);
    expect(isPriceModel("")).toBe(false);
    expect(isPriceModel("stunden")).toBe(false);
    expect(isPriceModel("Pauschal")).toBe(false); // case-sensitive: DB stores lowercase
    expect(isPriceModel("fixed")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isPriceModel(undefined)).toBe(false);
    expect(isPriceModel(1)).toBe(false);
    expect(isPriceModel({})).toBe(false);
    expect(isPriceModel(["pauschal"])).toBe(false);
  });

  it("parsePriceModel returns a discriminated ok result for valid input", () => {
    const r = parsePriceModel("kostendach");
    expect(r).toEqual({ ok: true, value: "kostendach" });
    if (r.ok) {
      const v: PriceModel = r.value; // compiles only if narrowed to PriceModel
      expect(v).toBe("kostendach");
    }
  });

  it("parsePriceModel surfaces the offending value instead of coercing it", () => {
    expect(parsePriceModel("bogus")).toEqual({ ok: false, received: "bogus" });
    expect(parsePriceModel(null)).toEqual({ ok: false, received: null });
    // No branch ever yields 'pauschal' for an invalid input.
    expect(parsePriceModel("bogus")).not.toMatchObject({ value: "pauschal" });
  });

  it("does not mutate its input", () => {
    const input = { price_model: "stundenansatz" };
    parsePriceModel(input.price_model);
    expect(input).toEqual({ price_model: "stundenansatz" });
  });
});
