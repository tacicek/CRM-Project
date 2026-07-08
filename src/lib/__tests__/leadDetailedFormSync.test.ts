import { describe, it, expect } from "vitest";
import { syncLeadDetailedFormData } from "../leadDetailedFormSync";

describe("syncLeadDetailedFormData", () => {
  it("returns null when the lead has no snapshot", () => {
    expect(syncLeadDetailedFormData(null, { from_has_lift: true })).toBeNull();
    expect(syncLeadDetailedFormData(undefined, { from_has_lift: true })).toBeNull();
  });

  it("flat-merges edits into a manual-import snapshot", () => {
    const detailed = {
      customer_first_name: "Anna",
      from_street: "Altweg",
      from_has_lift: false,
      service_type: "umzug_privat",
    };
    const result = syncLeadDetailedFormData(detailed, {
      from_street: "Neuweg",
      from_has_lift: true,
    });
    expect(result).toEqual({
      customer_first_name: "Anna",
      from_street: "Neuweg",
      from_has_lift: true,
      service_type: "umzug_privat",
    });
  });

  it("writes lift, address and floor edits into nested auszug/einzug paths", () => {
    const detailed = {
      auszug: {
        adresse: { strasse: "Altweg", hausnummer: "1", plz: "3421", ort: "Lyssach" },
        aufzug: { vorhanden: false, groesse: "klein" },
        stockwerk: "floor_1",
      },
      einzug: {
        adresse: { strasse: "Bielweg", plz: "2503", ort: "Biel" },
        aufzug: { vorhanden: false },
      },
      inventar: { geschaetzte_kartons: 20 },
    };
    const result = syncLeadDetailedFormData(detailed, {
      from_has_lift: true,
      from_floor: 3,
      from_street: "Neuweg",
      to_has_lift: true,
    });
    const auszug = result?.auszug as Record<string, Record<string, unknown>>;
    const einzug = result?.einzug as Record<string, Record<string, unknown>>;
    expect(auszug.aufzug).toEqual({ vorhanden: true, groesse: "klein" });
    expect(auszug.stockwerk).toBe("floor_3");
    expect(auszug.adresse.strasse).toBe("Neuweg");
    // untouched siblings survive
    expect(auszug.adresse.plz).toBe("3421");
    expect(einzug.aufzug).toEqual({ vorhanden: true });
    expect(result?.inventar).toEqual({ geschaetzte_kartons: 20 });
  });

  it("maps floor numbers to stockwerk enum values", () => {
    const base = { auszug: { stockwerk: "floor_1" } };
    const cases: Array<[number, string]> = [
      [-1, "basement"],
      [0, "ground_floor"],
      [2, "floor_2"],
      [7, "floor_5_plus"],
    ];
    for (const [floor, expected] of cases) {
      const result = syncLeadDetailedFormData(base, { from_floor: floor });
      expect((result?.auszug as Record<string, unknown>).stockwerk).toBe(expected);
    }
  });

  it("leaves nested non-umzug snapshots untouched", () => {
    const detailed = { objekt: { zimmer: 3 }, reinigungsart: "Endreinigung" };
    const result = syncLeadDetailedFormData(detailed, { from_rooms: 4 });
    expect(result).toEqual(detailed);
  });

  it("does not mutate the input snapshot", () => {
    const detailed = { auszug: { aufzug: { vorhanden: false } } };
    syncLeadDetailedFormData(detailed, { from_has_lift: true });
    expect(detailed.auszug.aufzug.vorhanden).toBe(false);
  });
});
