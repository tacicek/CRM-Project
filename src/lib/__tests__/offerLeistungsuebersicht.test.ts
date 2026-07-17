import { describe, it, expect } from "vitest";
import { parseIncludedServices } from "@/lib/offerLeistungsuebersicht";

describe("parseIncludedServices", () => {
  it("valid array → fresh { name }[], order preserved", () => {
    expect(parseIncludedServices([{ name: "Umzug" }, { name: "Reinigung" }]))
      .toEqual([{ name: "Umzug" }, { name: "Reinigung" }]);
  });
  it("valid empty array → empty array (a valid Leistungsübersicht with no services)", () => {
    expect(parseIncludedServices([])).toEqual([]);
  });
  it("non-array → null (omit, never []-as-valid)", () => {
    expect(parseIncludedServices(null)).toBeNull();
    expect(parseIncludedServices(undefined)).toBeNull();
    expect(parseIncludedServices("x")).toBeNull();
    expect(parseIncludedServices({ name: "x" })).toBeNull();
  });
  it("any malformed item → null (no silent filtering)", () => {
    expect(parseIncludedServices([{ name: "ok" }, { name: 1 }])).toBeNull();
    expect(parseIncludedServices([{ name: "ok" }, "nope"])).toBeNull();
    expect(parseIncludedServices([{ label: "no-name" }])).toBeNull();
  });
  it("extra keys are stripped; input not mutated", () => {
    const input = [{ name: "Umzug", bogus: 1 }];
    const snap = structuredClone(input);
    const out = parseIncludedServices(input);
    expect(out).toEqual([{ name: "Umzug" }]);
    expect(input).toEqual(snap);
  });
});
