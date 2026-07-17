import { describe, it, expect } from "vitest";
import {
  hasPianoTransportDetails,
  buildServiceDetails,
  type AuftragLead,
} from "@/lib/auftragLead";

// A cast-free AuftragLead factory (every Picked column set explicitly).
const makeLead = (overrides: Partial<AuftragLead> = {}): AuftragLead => ({
  service_type: "umzug",
  language: "de",
  description: null,
  estimated_duration_minutes: 120,
  from_street: "Bahnhofstrasse",
  from_house_number: "1",
  from_plz: "8000",
  from_city: "Zürich",
  from_floor: 2,
  from_has_lift: true,
  to_street: "Seestrasse",
  to_house_number: "2",
  to_plz: "8002",
  to_city: "Zürich",
  to_floor: 0,
  to_has_lift: false,
  from_rooms: 3,
  from_living_space_m2: 80,
  property_type: "wohnung",
  distance_km: 12,
  packing_service_needed: true,
  cleaning_service_needed: false,
  storage_needed: null,
  piano_type: null,
  piano_weight_kg: null,
  bathroom_count: 1,
  kitchen_type: "offen",
  has_balcony: true,
  has_garage: false,
  has_basement: null,
  has_attic: null,
  cleaning_windows: true,
  clearing_type: null,
  estimated_volume: null,
  has_heavy_items: null,
  heavy_items_description: null,
  storage_duration: null,
  storage_volume: null,
  ...overrides,
});

describe("hasPianoTransportDetails", () => {
  it("is true when piano_type is set (weight null)", () => {
    expect(hasPianoTransportDetails({ piano_type: "Flügel", piano_weight_kg: null })).toBe(true);
  });
  it("is true when piano_weight_kg is set (type null)", () => {
    expect(hasPianoTransportDetails({ piano_type: null, piano_weight_kg: 250 })).toBe(true);
  });
  it("is true when both are set", () => {
    expect(hasPianoTransportDetails({ piano_type: "Klavier", piano_weight_kg: 200 })).toBe(true);
  });
  it("is false when both are null", () => {
    expect(hasPianoTransportDetails({ piano_type: null, piano_weight_kg: null })).toBe(false);
  });
  it("treats weight 0 as present (0 is not null)", () => {
    expect(hasPianoTransportDetails({ piano_type: null, piano_weight_kg: 0 })).toBe(true);
  });
  it("does not treat piano_brand as a signal (only type/weight count)", () => {
    // piano_brand is not part of the rule — a lead with only a brand has null type+weight.
    const lead = makeLead({ piano_type: null, piano_weight_kg: null });
    expect(hasPianoTransportDetails(lead)).toBe(false);
  });
  it("does not mutate its input", () => {
    const input = { piano_type: "Flügel", piano_weight_kg: 250 };
    const snap = { ...input };
    hasPianoTransportDetails(input);
    expect(input).toEqual(snap);
  });
});

describe("buildServiceDetails", () => {
  it("writes piano_transport_needed=true for an umzug lead with piano data", () => {
    const details = buildServiceDetails(makeLead({ service_type: "umzug", piano_type: "Flügel" }));
    expect(details.piano_transport_needed).toBe(true);
  });
  it("writes piano_transport_needed=false for an umzug lead without piano data", () => {
    const details = buildServiceDetails(makeLead({ service_type: "umzug", piano_type: null, piano_weight_kg: null }));
    expect(details.piano_transport_needed).toBe(false);
    expect(typeof details.piano_transport_needed).toBe("boolean");
  });
  it("preserves piano_type / piano_weight_kg verbatim in the klaviertransport branch", () => {
    const details = buildServiceDetails(makeLead({ service_type: "klaviertransport", piano_type: "Flügel", piano_weight_kg: 300 }));
    expect(details.piano_type).toBe("Flügel");
    expect(details.piano_weight_kg).toBe(300);
  });
  it("keeps other umzug service-detail fields unchanged (raw nullable values)", () => {
    const details = buildServiceDetails(makeLead({ service_type: "umzug", packing_service_needed: true, cleaning_service_needed: false, storage_needed: null, distance_km: 12 }));
    expect(details.packing_service_needed).toBe(true);
    expect(details.cleaning_service_needed).toBe(false);
    expect(details.storage_needed).toBeNull();
    expect(details.distance_km).toBe(12);
  });
  it("emits the reinigung fields (no piano key on that branch)", () => {
    const details = buildServiceDetails(makeLead({ service_type: "reinigung", bathroom_count: 2, cleaning_windows: true }));
    expect(details.bathroom_count).toBe(2);
    expect(details.cleaning_windows).toBe(true);
    expect("piano_transport_needed" in details).toBe(false);
  });
  it("returns an empty object for an unknown service type", () => {
    expect(buildServiceDetails(makeLead({ service_type: "unbekannt" }))).toEqual({});
  });
  it("does not mutate its input", () => {
    const lead = makeLead({ service_type: "umzug", piano_type: "Flügel" });
    const snap = structuredClone(lead);
    buildServiceDetails(lead);
    expect(lead).toEqual(snap);
  });
});
