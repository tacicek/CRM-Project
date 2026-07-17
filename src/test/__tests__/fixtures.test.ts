import { describe, expect, it } from "vitest";
import {
  IDS,
  SYNTHETIC,
  makeCompany,
  makeLead,
  makeOffer,
  makeAuftrag,
  makeRechnung,
  makeQuittung,
  makeAppointment,
  TENANT_B,
} from "@/test/fixtures";

/** Every string field on a fixture, flattened, for the "no real data" sweep. */
const stringValues = (obj: Record<string, unknown>): string[] =>
  Object.values(obj).filter((v): v is string => typeof v === "string");

describe("fixtures — synthetic & deterministic", () => {
  it("uses only reserved, non-routable contact data (no real customers)", () => {
    const all = [makeCompany(), makeLead(), makeOffer(), makeAuftrag(), makeRechnung(), makeQuittung()];
    for (const row of all) {
      for (const value of stringValues(row)) {
        // Any e-mail-looking value must sit on the reserved .test TLD.
        if (value.includes("@")) {
          expect(value.endsWith(`@${SYNTHETIC.emailDomain}`), value).toBe(true);
        }
      }
    }
  });

  it("is deterministic — repeated calls are byte-identical (no Date.now/random)", () => {
    expect(makeOffer()).toEqual(makeOffer());
    expect(makeAuftrag()).toEqual(makeAuftrag());
    expect(makeAppointment()).toEqual(makeAppointment());
  });

  it("wires the Lead→Offer→Auftrag→Rechnung/Quittung relations to consistent ids", () => {
    expect(makeOffer().company_id).toBe(IDS.companyA);
    expect(makeAuftrag().offer_id).toBe(IDS.offerA);
    expect(makeAuftrag().lead_id).toBe(IDS.leadA);
    expect(makeRechnung().auftrag_id).toBe(IDS.auftragA);
    expect(makeQuittung().auftrag_id).toBe(IDS.auftragA);
  });

  it("provides a distinct second tenant for RLS isolation tests", () => {
    expect(TENANT_B.company().id).toBe(IDS.companyB);
    expect(TENANT_B.company().id).not.toBe(makeCompany().id);
    expect(TENANT_B.lead().company_id).toBe(IDS.companyB);
  });

  it("allows overrides without mutating the base shape", () => {
    const custom = makeOffer({ title: "Custom", status: "sent" });
    expect(custom.title).toBe("Custom");
    expect(custom.status).toBe("sent");
    // Base call is unaffected.
    expect(makeOffer().title).toBe("Offerte Privatumzug");
  });
});
