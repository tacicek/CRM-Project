import { describe, expect, it } from "vitest";

import { buildLeadInsert, extractedToLeadInput } from "../leadMapping.ts";

const options = { companyId: "c-1", language: "de" as const, source: "email" as const };

describe("buildLeadInsert", () => {
  it("writes the requested source", () => {
    const row = buildLeadInsert({ service_type: "umzug_privat" }, options);
    expect(row.source).toBe("email");
    expect(row.status).toBe("pending");
    expect(row.company_id).toBe("c-1");
    expect(row.language).toBe("de");
  });

  it("keeps the manual-import default when asked for it", () => {
    const row = buildLeadInsert({ service_type: "reinigung" }, { ...options, source: "import" });
    expect(row.source).toBe("import");
  });

  it("fills the NOT NULL columns with visible placeholders, not invented data", () => {
    const row = buildLeadInsert({ service_type: "umzug_privat" }, options);
    expect(row.customer_first_name).toBe("Unbekannt");
    expect(row.customer_last_name).toBe("Unbekannt");
    expect(row.customer_email).toBe("");
    expect(row.customer_phone).toBe("");
    expect(row.from_city).toBe("Unbekannt");
    expect(row.from_plz).toBe("");
  });

  it("resolves the PLZ from whichever address the service uses", () => {
    expect(buildLeadInsert({ pickup_plz: "6000" }, options).from_plz).toBe("6000");
    expect(buildLeadInsert({ from_plz: "8000", pickup_plz: "6000" }, options).from_plz).toBe("8000");
  });

  it("maps umzug fields", () => {
    const row = buildLeadInsert(
      {
        service_type: "umzug_privat",
        from_street: "Beispielstrasse",
        from_floor: 2,
        from_has_lift: false,
        to_city: "Luzern",
        to_floor: 1,
        to_has_lift: true,
      },
      options,
    );

    expect(row.from_street).toBe("Beispielstrasse");
    expect(row.from_floor).toBe(2);
    expect(row.from_has_lift).toBe(false);
    expect(row.to_city).toBe("Luzern");
    expect(row.to_has_lift).toBe(true);
  });

  it("keeps floor 0 instead of turning it into null", () => {
    expect(buildLeadInsert({ service_type: "umzug_privat", from_floor: 0 }, options).from_floor).toBe(0);
  });

  it("does not leak fields of another service type", () => {
    const row = buildLeadInsert({ service_type: "entsorgung", piano_type: "fluegel" }, options);
    expect(row).not.toHaveProperty("piano_type");
  });
});

describe("extractedToLeadInput", () => {
  it("renames the extraction schema onto the lead schema", () => {
    const input = extractedToLeadInput("umzug_privat", {
      first_name: "Max",
      last_name: "Müller",
      email: "Max@Example.com",
      phone: "079 123 45 67",
      special_notes: "Klavier vorhanden",
      preferred_time: "vormittags",
      from_has_elevator: false,
      to_has_elevator: true,
    });

    expect(input.customer_first_name).toBe("Max");
    expect(input.customer_email).toBe("max@example.com");
    expect(input.description).toBe("Klavier vorhanden");
    expect(input.preferred_time_slot).toBe("vormittags");
    expect(input.from_has_lift).toBe(false);
    expect(input.to_has_lift).toBe(true);
  });

  it("maps the single-address services onto the from_* columns", () => {
    for (const serviceType of ["reinigung", "raeumung", "entsorgung", "moebellift"]) {
      const input = extractedToLeadInput(serviceType, {
        address_street: "Musterweg",
        address_plz: "3000",
        address_city: "Bern",
      });
      expect(input.from_street).toBe("Musterweg");
      expect(input.from_plz).toBe("3000");
      expect(input.from_city).toBe("Bern");
    }
  });

  it("maps storage pickup onto the origin address", () => {
    const input = extractedToLeadInput("lagerung", {
      pickup_street: "Lagerweg",
      pickup_plz: "4000",
      pickup_city: "Basel",
      pickup_has_elevator: true,
    });
    expect(input.from_plz).toBe("4000");
    expect(input.from_city).toBe("Basel");
    expect(input.pickup_has_lift).toBe(true);
  });

  it("leaves fields the model never filled as null", () => {
    const input = extractedToLeadInput("umzug_privat", { first_name: "Max" });
    expect(input.customer_last_name).toBeNull();
    expect(input.to_city).toBeNull();
  });

  it("survives an unknown service type without inventing fields", () => {
    const input = extractedToLeadInput("etwas_neues", { first_name: "Max" });
    expect(input.service_type).toBe("etwas_neues");
    expect(input).not.toHaveProperty("from_street");
  });
});

describe("the two mappers together", () => {
  it("turns a model answer into a lead row with source=email", () => {
    const row = buildLeadInsert(
      extractedToLeadInput("umzug_privat", {
        first_name: "Max",
        last_name: "Müller",
        email: "max@example.com",
        phone: "0791234567",
        from_plz: "8000",
        from_city: "Zürich",
        to_plz: "6000",
        to_city: "Luzern",
        from_rooms: 3.5,
      }),
      options,
    );

    expect(row).toMatchObject({
      source: "email",
      status: "pending",
      customer_first_name: "Max",
      customer_email: "max@example.com",
      from_plz: "8000",
      from_city: "Zürich",
      to_city: "Luzern",
      from_rooms: 3.5,
    });
  });
});
