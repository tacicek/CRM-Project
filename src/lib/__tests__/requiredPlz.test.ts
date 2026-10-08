import { describe, expect, it } from "vitest";

import { extractedLeadToLeadData } from "@/lib/extractedLeadToLeadData";
import { PLZ_SOURCE_BY_SERVICE, isImportServiceType, requiredPlz } from "@/lib/requiredPlz";
import type { ExtractedData } from "@/types/extractedLead";

const base = (overrides: Partial<ExtractedData> = {}): ExtractedData => ({
  detected_service_type: "umzug_privat",
  language: "de",
  confidence_score: 0.9,
  first_name: "Max",
  last_name: "Müller",
  email: "max@example.com",
  phone: "079 123 45 67",
  preferred_date: "2026-09-15",
  preferred_time: null,
  special_notes: null,
  ...overrides,
});

describe("requiredPlz — dieselbe Zuordnung wie extractedLeadToLeadData", () => {
  it("nennt fuer JEDEN Servicetyp genau das Feld, das als from_plz gespeichert wird", () => {
    // Der Test, der den Firmenumzug-Fehler verhindert haette: eine zweite
    // Abschrift der Zuordnung darf nicht still von der ersten abweichen.
    for (const [serviceType, source] of Object.entries(PLZ_SOURCE_BY_SERVICE)) {
      const data = base({ detected_service_type: serviceType, [source]: "8000" });
      expect(extractedLeadToLeadData(data).from_plz, serviceType).toBe("8000");
      expect(requiredPlz(data)?.source, serviceType).toBe(source);
    }
  });

  it("Firmenumzug liest die Auszugs-PLZ, nicht die Einzeladresse", () => {
    const r = requiredPlz(base({ detected_service_type: "umzug_firma", from_plz: "2560", address_plz: null }));
    expect(r).toEqual({ source: "from_plz", labelKey: "lead.plz.from", value: "2560", valid: true });
  });

  it("lagerung liest die Abhol-PLZ", () => {
    expect(requiredPlz(base({ detected_service_type: "lagerung", pickup_plz: "3000" }))).toMatchObject({
      source: "pickup_plz",
      labelKey: "lead.plz.pickup",
      valid: true,
    });
  });

  it("leer, Leerzeichen oder keine vier Ziffern sind ungueltig", () => {
    expect(requiredPlz(base({ from_plz: null }))?.valid).toBe(false);
    expect(requiredPlz(base({ from_plz: "   " }))?.valid).toBe(false);
    expect(requiredPlz(base({ from_plz: "256" }))?.valid).toBe(false);
    expect(requiredPlz(base({ from_plz: " 2560 " }))).toMatchObject({ value: "2560", valid: true });
  });

  it("ein unbekannter Servicetyp ist ein Fehler, keine Ersatz-PLZ", () => {
    expect(requiredPlz(base({ detected_service_type: "malerarbeit", address_plz: "8000" }))).toBeNull();
    expect(isImportServiceType("umzug_firma")).toBe(true);
    expect(isImportServiceType("")).toBe(false);
    expect(isImportServiceType(undefined)).toBe(false);
  });
});
