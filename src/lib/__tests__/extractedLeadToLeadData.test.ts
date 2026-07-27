import { describe, expect, it } from "vitest";

import { extractedLeadToLeadData } from "@/lib/extractedLeadToLeadData";
import type { ExtractedData } from "@/types/extractedLead";

/**
 * Diese Zuordnung lag früher inline in ManualImport.tsx und wird jetzt von ZWEI
 * Stellen benutzt: vom manuellen Import und von der Freigabe im E-Mail-Eingang.
 * Ein Fehler hier schreibt also in beiden Wegen falsche Anfragen — und zwar
 * lautlos, weil eine Anfrage mit vertauschten Feldern trotzdem entsteht.
 */

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

describe("extractedLeadToLeadData — Basisfelder", () => {
  it("bildet Kontaktdaten auf die Lead-Spalten ab", () => {
    const lead = extractedLeadToLeadData(base());

    expect(lead.customer_first_name).toBe("Max");
    expect(lead.customer_last_name).toBe("Müller");
    expect(lead.customer_email).toBe("max@example.com");
    expect(lead.preferred_date).toBe("2026-09-15");
    expect(lead.service_type).toBe("umzug_privat");
    expect(lead.language).toBe("de");
  });

  it("normalisiert die E-Mail-Adresse auf Kleinschreibung", () => {
    expect(extractedLeadToLeadData(base({ email: "Max@Example.COM" })).customer_email)
      .toBe("max@example.com");
  });

  it("macht aus leeren Angaben null statt leerer Zeichenketten", () => {
    const lead = extractedLeadToLeadData(base({ first_name: "  ", special_notes: "" }));
    expect(lead.customer_first_name).toBeNull();
    expect(lead.description).toBeNull();
  });

  it("übernimmt special_notes als Beschreibung", () => {
    expect(extractedLeadToLeadData(base({ special_notes: "Klavier vorhanden" })).description)
      .toBe("Klavier vorhanden");
  });
});

describe("extractedLeadToLeadData — Umzug", () => {
  it("übersetzt from_has_elevator auf die Lift-Spalte", () => {
    // Das Extraktionsschema heisst *_has_elevator, die Lead-Tabelle *_has_lift.
    // Genau solche Umbenennungen gehen bei einer zweiten Kopie verloren.
    const lead = extractedLeadToLeadData(
      base({ from_has_elevator: false, to_has_elevator: true }),
    );
    expect(lead.from_has_lift).toBe(false);
    expect(lead.to_has_lift).toBe(true);
  });

  it("übernimmt beide Adressen", () => {
    const lead = extractedLeadToLeadData(
      base({
        from_street: "Habsburgerstrasse",
        from_house_number: "20",
        from_plz: "6003",
        from_city: "Luzern",
        to_street: "Neustadtstrasse",
        to_plz: "6004",
        to_city: "Luzern",
        from_floor: 2,
        to_floor: 1,
      }),
    );

    expect(lead.from_street).toBe("Habsburgerstrasse");
    expect(lead.from_plz).toBe("6003");
    expect(lead.to_street).toBe("Neustadtstrasse");
    expect(lead.to_plz).toBe("6004");
    expect(lead.from_floor).toBe(2);
    expect(lead.to_floor).toBe(1);
  });

  it("behält Erdgeschoss (0) und verwandelt es nicht in null", () => {
    expect(extractedLeadToLeadData(base({ from_floor: 0 })).from_floor).toBe(0);
  });
});

describe("extractedLeadToLeadData — Einzeladress-Services", () => {
  it.each(["reinigung", "raeumung", "entsorgung"])(
    "%s: address_* landet auf from_*",
    (serviceType) => {
      const lead = extractedLeadToLeadData(
        base({
          detected_service_type: serviceType,
          address_street: "Musterweg",
          address_house_number: "7",
          address_plz: "3000",
          address_city: "Bern",
        }),
      );

      expect(lead.from_street).toBe("Musterweg");
      expect(lead.from_house_number).toBe("7");
      expect(lead.from_plz).toBe("3000");
      expect(lead.from_city).toBe("Bern");
    },
  );

  it("reinigung: Zimmerzahl und Fläche kommen aus den eigenen Feldern", () => {
    const lead = extractedLeadToLeadData(
      base({ detected_service_type: "reinigung", number_of_rooms: 3.5, living_space_m2: 80 }),
    );
    expect(lead.from_rooms).toBe(3.5);
    expect(lead.from_living_space_m2).toBe(80);
  });

  it("lagerung: pickup_plz wird zur Herkunfts-PLZ", () => {
    const lead = extractedLeadToLeadData(
      base({
        detected_service_type: "lagerung",
        pickup_street: "Lagerweg",
        pickup_plz: "4000",
        pickup_city: "Basel",
        pickup_has_elevator: true,
      }),
    );

    expect(lead.pickup_street).toBe("Lagerweg");
    expect(lead.from_plz).toBe("4000");
    expect(lead.from_city).toBe("Basel");
    expect(lead.pickup_has_lift).toBe(true);
  });
});

describe("extractedLeadToLeadData — service-spezifische Felder", () => {
  it("klaviertransport", () => {
    const lead = extractedLeadToLeadData(
      base({
        detected_service_type: "klaviertransport",
        piano_type: "fluegel",
        piano_brand: "Steinway",
        piano_weight_kg: 320,
        staircase_type: "wendel",
      }),
    );

    expect(lead.piano_type).toBe("fluegel");
    expect(lead.piano_brand).toBe("Steinway");
    expect(lead.piano_weight_kg).toBe(320);
    expect(lead.staircase_type).toBe("wendel");
  });

  it("moebellift", () => {
    const lead = extractedLeadToLeadData(
      base({
        detected_service_type: "moebellift",
        address_street: "Bergstrasse",
        moebellift_floor: 4,
        moebellift_item_description: "Sofa",
      }),
    );

    expect(lead.from_street).toBe("Bergstrasse");
    expect(lead.moebellift_floor).toBe(4);
    expect(lead.moebellift_item_description).toBe("Sofa");
  });

  it("mischt keine Felder eines anderen Service-Typs hinein", () => {
    const lead = extractedLeadToLeadData(
      base({ detected_service_type: "entsorgung", piano_type: "fluegel" }),
    );
    expect(lead).not.toHaveProperty("piano_type");
  });
});
