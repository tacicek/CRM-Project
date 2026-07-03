import { describe, it, expect } from "vitest";
import { normalizeServiceTypeForAgb } from "@/lib/normalizeServiceType";

describe("normalizeServiceTypeForAgb", () => {
  it("maps the reinigung lead-form variants to the reinigung template key", () => {
    expect(normalizeServiceTypeForAgb("reinigung_end")).toBe("reinigung");
    expect(normalizeServiceTypeForAgb("reinigung_grund")).toBe("reinigung");
  });

  it("keeps standalone template-key types unchanged (no collapse to a non-existent 'transport')", () => {
    expect(normalizeServiceTypeForAgb("usm_transport")).toBe("usm_transport");
    expect(normalizeServiceTypeForAgb("wasserbett_transport")).toBe("wasserbett_transport");
    expect(normalizeServiceTypeForAgb("klaviertransport")).toBe("klaviertransport");
    expect(normalizeServiceTypeForAgb("moebellift")).toBe("moebellift");
  });

  it("collapses umzug variants to umzug", () => {
    expect(normalizeServiceTypeForAgb("umzug_privat")).toBe("umzug");
    expect(normalizeServiceTypeForAgb("umzug_firma")).toBe("umzug");
  });

  it("keeps raeumung and entsorgung as separate categories", () => {
    expect(normalizeServiceTypeForAgb("raeumung_wohnung")).toBe("raeumung");
    expect(normalizeServiceTypeForAgb("entsorgung")).toBe("entsorgung");
  });

  it("returns already-canonical or unknown types unchanged", () => {
    expect(normalizeServiceTypeForAgb("umzug")).toBe("umzug");
    expect(normalizeServiceTypeForAgb("something_else")).toBe("something_else");
  });
});
