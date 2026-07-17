import { describe, it, expect } from "vitest";
import {
  validateAuftragItems,
  validateExtraServices,
  validateServiceDetails,
  mapAuftragRow,
  toAuftragPricingType,
  type AuftragItem,
  type AuftragExtraService,
  type AuftragQueryRow,
} from "@/lib/auftragSnapshot";

const item: AuftragItem = {
  id: "i1",
  position: 1,
  description: "Umzug",
  quantity: 2,
  unit: "Std",
  unit_price: 120,
  total: 240,
  price_type: "hourly",
};

const extra: AuftragExtraService = { id: "e1", description: "Entsorgung", quantity: 1, unit: "Pauschal", unit_price: 80 };

// Full, cast-free AuftragQueryRow factory (every generated column + both embeds are set
// explicitly, so the fixture always matches the real Row contract).
const makeQueryRow = (overrides: Partial<AuftragQueryRow> = {}): AuftragQueryRow => ({
  appointment_id: null,
  assigned_team_members: ["tm1"],
  auftrag_nummer: "A-2026-0001",
  company_id: "c1",
  completed_at: null,
  completion_notes: null,
  created_at: "2026-02-01T00:00:00Z",
  customer_email: "kunde@example.com",
  customer_name: "Max Mustermann",
  customer_phone: null,
  customer_reminder_sent: false,
  customer_reminder_sent_at: null,
  deleted_at: null,
  description: null,
  estimated_duration_minutes: 120,
  extra_services: [],
  from_address: "Bahnhofstrasse 1",
  hourly_rate: null,
  id: "a1",
  internal_notes: null,
  items: [],
  language: "de",
  lead_id: "l1",
  offer_id: "o1",
  pricing_type: "fixed",
  reminder_days_before: 1,
  reminder_sent_at: null,
  scheduled_date: "2026-02-10",
  scheduled_time: "09:00:00",
  service_details: {},
  service_type: "umzug",
  special_instructions: null,
  status: "geplant",
  subtotal: 1000,
  team_leader_id: "tm1",
  team_reminder_sent: false,
  title: "Umzug Mustermann",
  to_address: "Seestrasse 2",
  total: 1081,
  updated_at: "2026-02-01T00:00:00Z",
  vat_amount: 81,
  vat_rate: 8.1,
  offer: { id: "o1", title: "Offerte Mustermann" },
  team_leader: { first_name: "Anna", last_name: "Meier", email: null, phone: null },
  ...overrides,
});

describe("validateAuftragItems", () => {
  it("accepts a valid list and preserves values", () => {
    const r = validateAuftragItems([item]);
    expect(r).toEqual({ ok: true, value: [item] });
  });
  it("treats null/undefined as the valid empty list", () => {
    expect(validateAuftragItems(null)).toEqual({ ok: true, value: [] });
    expect(validateAuftragItems(undefined)).toEqual({ ok: true, value: [] });
  });
  it("accepts nullable unit/total", () => {
    const r = validateAuftragItems([{ ...item, unit: null, total: null, price_type: null }]);
    expect(r.ok).toBe(true);
  });
  it("fails closed on a non-array", () => {
    expect(validateAuftragItems("[]")).toEqual({ ok: false });
    expect(validateAuftragItems({})).toEqual({ ok: false });
  });
  it("fails closed when ANY item is malformed (no silent filtering)", () => {
    expect(validateAuftragItems([item, { id: "x" }])).toEqual({ ok: false });
    expect(validateAuftragItems([{ ...item, unit_price: "120" }])).toEqual({ ok: false });
    expect(validateAuftragItems([{ ...item, position: NaN }])).toEqual({ ok: false });
    expect(validateAuftragItems([{ ...item, quantity: Infinity }])).toEqual({ ok: false });
  });
  it("does not mutate its input", () => {
    const input = [{ ...item }];
    const snap = structuredClone(input);
    validateAuftragItems(input);
    expect(input).toEqual(snap);
  });
});

describe("validateExtraServices", () => {
  it("accepts a valid list and preserves values", () => {
    expect(validateExtraServices([extra])).toEqual({ ok: true, value: [extra] });
  });
  it("null/undefined → valid empty list", () => {
    expect(validateExtraServices(null)).toEqual({ ok: true, value: [] });
  });
  it("fails closed on non-array or malformed item", () => {
    expect(validateExtraServices({})).toEqual({ ok: false });
    expect(validateExtraServices([{ ...extra, unit_price: NaN }])).toEqual({ ok: false });
    expect(validateExtraServices([{ id: "e", description: "x" }])).toEqual({ ok: false });
  });
  it("does not mutate its input", () => {
    const input = [{ ...extra }];
    validateExtraServices(input);
    expect(input).toEqual([extra]);
  });
});

describe("validateServiceDetails", () => {
  it("treats null/undefined as the valid empty object", () => {
    expect(validateServiceDetails(null)).toEqual({ ok: true, value: {} });
    expect(validateServiceDetails(undefined)).toEqual({ ok: true, value: {} });
  });
  it("accepts an empty object and a populated flat object, preserving values", () => {
    expect(validateServiceDetails({})).toEqual({ ok: true, value: {} });
    const d = { from_rooms: 3, from_has_lift: true, piano_type: null, note: "x" };
    expect(validateServiceDetails(d)).toEqual({ ok: true, value: d });
  });
  it("fails closed on an array", () => {
    expect(validateServiceDetails([])).toEqual({ ok: false });
    expect(validateServiceDetails([{ from_rooms: 3 }])).toEqual({ ok: false });
  });
  it("fails closed on primitives", () => {
    expect(validateServiceDetails("x")).toEqual({ ok: false });
    expect(validateServiceDetails(3)).toEqual({ ok: false });
    expect(validateServiceDetails(true)).toEqual({ ok: false });
  });
  it("fails closed on exotic objects (Date/Map/Set/class instance) — not JSON snapshots", () => {
    expect(validateServiceDetails(new Date()).ok).toBe(false);
    expect(validateServiceDetails(new Map()).ok).toBe(false);
    expect(validateServiceDetails(new Set()).ok).toBe(false);
    class Foo { a = 1; }
    expect(validateServiceDetails(new Foo()).ok).toBe(false);
  });
  it("accepts a null-prototype object (a shape JSON.parse can yield)", () => {
    const np = Object.create(null);
    np.from_rooms = 2;
    expect(validateServiceDetails(np).ok).toBe(true);
  });
  it("does not mutate its input", () => {
    const input = { from_rooms: 3, from_has_lift: true };
    const snap = structuredClone(input);
    validateServiceDetails(input);
    expect(input).toEqual(snap);
  });
});

describe("mapAuftragRow", () => {
  it("maps a valid row to a valid entry with parsed snapshots", () => {
    // Inputs are fresh object literals (they satisfy the row's `Json` columns); `item`/`extra`
    // are the named domain values we expect the mapper to hand back out.
    const entry = mapAuftragRow(makeQueryRow({ items: [{ ...item }], extra_services: [{ ...extra }], service_details: { from_rooms: 3 } }));
    expect(entry.kind).toBe("valid");
    if (entry.kind === "valid") {
      expect(entry.items).toEqual([item]);
      expect(entry.extraServices).toEqual([extra]);
      expect(entry.serviceDetails).toEqual({ from_rooms: 3 });
    }
  });
  it("preserves a null offer relation (no fake offer)", () => {
    const entry = mapAuftragRow(makeQueryRow({ offer: null }));
    expect(entry.row.offer).toBeNull();
  });
  it("preserves a null team_leader relation", () => {
    const entry = mapAuftragRow(makeQueryRow({ team_leader: null }));
    expect(entry.row.team_leader).toBeNull();
  });
  it("preserves nullable lead_id / offer_id", () => {
    const entry = mapAuftragRow(makeQueryRow({ lead_id: null, offer_id: null }));
    expect(entry.row.lead_id).toBeNull();
    expect(entry.row.offer_id).toBeNull();
  });
  it("preserves a null assigned_team_members (no coercion to [])", () => {
    const entry = mapAuftragRow(makeQueryRow({ assigned_team_members: null }));
    expect(entry.row.assigned_team_members).toBeNull();
  });
  it("preserves null reminder fields (no coercion to 0/false)", () => {
    const entry = mapAuftragRow(makeQueryRow({ reminder_days_before: null, team_reminder_sent: null }));
    expect(entry.row.reminder_days_before).toBeNull();
    expect(entry.row.team_reminder_sent).toBeNull();
  });
  it("preserves a null created_at (no fabricated date)", () => {
    const entry = mapAuftragRow(makeQueryRow({ created_at: null }));
    expect(entry.row.created_at).toBeNull();
  });
  it("treats empty items/extras/details as a valid empty snapshot", () => {
    const entry = mapAuftragRow(makeQueryRow({ items: [], extra_services: [], service_details: {} }));
    expect(entry.kind).toBe("valid");
    if (entry.kind === "valid") {
      expect(entry.items).toEqual([]);
      expect(entry.extraServices).toEqual([]);
      expect(entry.serviceDetails).toEqual({});
    }
  });
  it("treats null JSON columns as a valid empty snapshot", () => {
    const entry = mapAuftragRow(makeQueryRow({ items: null, extra_services: null, service_details: null }));
    expect(entry.kind).toBe("valid");
    if (entry.kind === "valid") {
      expect(entry.items).toEqual([]);
      expect(entry.extraServices).toEqual([]);
      expect(entry.serviceDetails).toEqual({});
    }
  });
  it("fails closed on malformed items (reason: items)", () => {
    const entry = mapAuftragRow(makeQueryRow({ items: [{ id: "x" }] }));
    expect(entry.kind).toBe("invalid_snapshot");
    if (entry.kind === "invalid_snapshot") expect(entry.reason).toBe("items");
  });
  it("fails closed on malformed extra_services (reason: extra_services)", () => {
    const entry = mapAuftragRow(makeQueryRow({ extra_services: [{ id: "e", description: "x" }] }));
    expect(entry.kind).toBe("invalid_snapshot");
    if (entry.kind === "invalid_snapshot") expect(entry.reason).toBe("extra_services");
  });
  it("fails closed on a service_details array (reason: service_details)", () => {
    const entry = mapAuftragRow(makeQueryRow({ service_details: [{ from_rooms: 3 }] }));
    expect(entry.kind).toBe("invalid_snapshot");
    if (entry.kind === "invalid_snapshot") expect(entry.reason).toBe("service_details");
  });
  it("fails closed on a service_details primitive (reason: service_details)", () => {
    const entry = mapAuftragRow(makeQueryRow({ service_details: "nope" }));
    expect(entry.kind).toBe("invalid_snapshot");
    if (entry.kind === "invalid_snapshot") expect(entry.reason).toBe("service_details");
  });
  it("uses deterministic precedence: items wins when several fields are malformed", () => {
    const entry = mapAuftragRow(makeQueryRow({ items: "bad", extra_services: "bad", service_details: "bad" }));
    expect(entry.kind).toBe("invalid_snapshot");
    if (entry.kind === "invalid_snapshot") expect(entry.reason).toBe("items");
  });
  it("does not carry raw JSON on an invalid entry", () => {
    const entry = mapAuftragRow(makeQueryRow({ items: [{ id: "x" }] }));
    expect("items" in entry).toBe(false);
    expect("extraServices" in entry).toBe(false);
    expect("serviceDetails" in entry).toBe(false);
    expect("items" in entry.row).toBe(false);
    expect("extra_services" in entry.row).toBe(false);
    expect("service_details" in entry.row).toBe(false);
  });
  it("preserves financial snapshot fields unchanged", () => {
    const entry = mapAuftragRow(makeQueryRow({ subtotal: 1000, hourly_rate: 150, vat_rate: 8.1, vat_amount: 81, total: 1081 }));
    expect(entry.row.subtotal).toBe(1000);
    expect(entry.row.hourly_rate).toBe(150);
    expect(entry.row.vat_rate).toBe(8.1);
    expect(entry.row.vat_amount).toBe(81);
    expect(entry.row.total).toBe(1081);
  });
  it("preserves the status enum value", () => {
    const entry = mapAuftragRow(makeQueryRow({ status: "abgeschlossen" }));
    expect(entry.row.status).toBe("abgeschlossen");
  });
  it("keeps a null status null (no fallback to geplant)", () => {
    const entry = mapAuftragRow(makeQueryRow({ status: null }));
    expect(entry.row.status).toBeNull();
  });
  it("does not mutate the input row", () => {
    const row = makeQueryRow({ items: [{ ...item }], extra_services: [{ ...extra }], service_details: { from_rooms: 3 } });
    const snap = structuredClone(row);
    mapAuftragRow(row);
    expect(row).toEqual(snap);
  });
  it("preserves valid items/extras/details values verbatim", () => {
    const details = { from_rooms: 4, from_has_lift: false, distance_km: 12.5 };
    const entry = mapAuftragRow(makeQueryRow({ items: [{ ...item }], extra_services: [{ ...extra }], service_details: details }));
    if (entry.kind === "valid") {
      expect(entry.items[0]).toEqual(item);
      expect(entry.extraServices[0]).toEqual(extra);
      expect(entry.serviceDetails).toEqual(details);
    }
  });
});

describe("toAuftragPricingType", () => {
  it("passes through the three valid pricing types", () => {
    expect(toAuftragPricingType("fixed")).toBe("fixed");
    expect(toAuftragPricingType("hourly")).toBe("hourly");
    expect(toAuftragPricingType("estimate")).toBe("estimate");
  });
  it("maps null and unknown/legacy strings to null (no invented default)", () => {
    expect(toAuftragPricingType(null)).toBeNull();
    expect(toAuftragPricingType("")).toBeNull();
    expect(toAuftragPricingType("pauschal")).toBeNull();
  });
});
