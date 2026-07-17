import { describe, it, expect } from "vitest";
import {
  parseAuftragStatus,
  serializeAuftragItems,
  serializeAuftragExtraServices,
  serializeAuftragServiceDetails,
  buildAuftragInsertPayload,
  buildAuftragUpdatePayload,
  applyAuftragRescheduleReset,
  stripAuftragSchedule,
  type AuftragPayloadSource,
  type AuftragUpdate,
} from "@/lib/auftragPayload";
import type { AuftragItem, AuftragExtraService } from "@/lib/auftragSnapshot";
import type { Database } from "@/integrations/supabase/types";

const item: AuftragItem = {
  id: "i1", position: 1, description: "Umzug", quantity: 2,
  unit: "Std", unit_price: 120, total: 240, price_type: "hourly",
};
const extra: AuftragExtraService = { id: "e1", description: "Entsorgung", quantity: 1, unit: "Pauschal", unit_price: 80 };

const makeSource = (overrides: Partial<AuftragPayloadSource> = {}): AuftragPayloadSource => ({
  companyId: "c1",
  offerId: "o1",
  leadId: "l1",
  title: "Umzug Mustermann",
  customerName: "Max Mustermann",
  customerEmail: "kunde@example.com",
  customerPhone: null,
  fromAddress: "Bahnhofstrasse 1",
  toAddress: "Seestrasse 2",
  scheduledDate: "2026-02-10",
  scheduledTime: "09:00",
  estimatedDurationMinutes: 120,
  description: null,
  specialInstructions: null,
  internalNotes: null,
  teamLeaderId: "tm1",
  assignedTeamMembers: ["tm1"],
  reminderDaysBefore: 1,
  status: "geplant",
  serviceType: "umzug",
  pricingType: "fixed",
  hourlyRate: null,
  subtotal: 1000,
  vatRate: 8.1,
  vatAmount: 81,
  total: 1081,
  completedAt: null,
  items: [item],
  extraServices: [extra],
  serviceDetails: { from_rooms: 3, packing_service_needed: true, note: null },
  ...overrides,
});

describe("parseAuftragStatus", () => {
  it("accepts the five valid statuses", () => {
    for (const s of ["geplant", "bestaetigt", "in_bearbeitung", "abgeschlossen", "storniert"]) {
      expect(parseAuftragStatus(s)).toEqual({ ok: true, value: s });
    }
  });
  it("rejects an unknown status (no geplant fallback)", () => {
    expect(parseAuftragStatus("cancelled")).toEqual({ ok: false });
  });
  it("rejects empty string / null / non-string", () => {
    expect(parseAuftragStatus("")).toEqual({ ok: false });
    expect(parseAuftragStatus(null)).toEqual({ ok: false });
    expect(parseAuftragStatus(3)).toEqual({ ok: false });
  });
});

describe("serializeAuftragItems", () => {
  it("produces a JSON-safe array preserving values", () => {
    const r = serializeAuftragItems([item]);
    expect(r).toEqual({ ok: true, value: [{ id: "i1", position: 1, description: "Umzug", quantity: 2, unit: "Std", unit_price: 120, total: 240, price_type: "hourly" }] });
  });
  it("preserves nullable unit/total/price_type as null", () => {
    const r = serializeAuftragItems([{ ...item, unit: null, total: null, price_type: null }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([{ id: "i1", position: 1, description: "Umzug", quantity: 2, unit: null, unit_price: 120, total: null, price_type: null }]);
  });
  it("rejects NaN / Infinity numbers", () => {
    expect(serializeAuftragItems([{ ...item, unit_price: NaN }])).toEqual({ ok: false, reason: "invalid_items" });
    expect(serializeAuftragItems([{ ...item, total: Infinity }])).toEqual({ ok: false, reason: "invalid_items" });
    expect(serializeAuftragItems([{ ...item, position: NaN }])).toEqual({ ok: false, reason: "invalid_items" });
  });
  it("does not let unknown UI keys leak into the payload", () => {
    const withExtra = { ...item, bogus_ui_field: "leak", isSelected: true };
    const r = serializeAuftragItems([withExtra]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const entry = r.value[0];
      const keys = entry && typeof entry === "object" ? Object.keys(entry) : [];
      expect(keys).not.toContain("bogus_ui_field");
      expect(keys).not.toContain("isSelected");
    }
  });
  it("does not mutate its input", () => {
    const input = [{ ...item }];
    const snap = structuredClone(input);
    serializeAuftragItems(input);
    expect(input).toEqual(snap);
  });
});

describe("serializeAuftragExtraServices", () => {
  it("preserves valid extras", () => {
    expect(serializeAuftragExtraServices([extra])).toEqual({ ok: true, value: [{ id: "e1", description: "Entsorgung", quantity: 1, unit: "Pauschal", unit_price: 80 }] });
  });
  it("rejects invalid numbers", () => {
    expect(serializeAuftragExtraServices([{ ...extra, unit_price: NaN }])).toEqual({ ok: false, reason: "invalid_extra_services" });
  });
  it("does not mutate its input", () => {
    const input = [{ ...extra }];
    serializeAuftragExtraServices(input);
    expect(input).toEqual([extra]);
  });
});

describe("serializeAuftragServiceDetails", () => {
  it("accepts a flat primitive object", () => {
    expect(serializeAuftragServiceDetails({ from_rooms: 3, packing: true, kitchen: "offen" }))
      .toEqual({ ok: true, value: { from_rooms: 3, packing: true, kitchen: "offen" } });
  });
  it("preserves null values", () => {
    const r = serializeAuftragServiceDetails({ storage: null });
    expect(r).toEqual({ ok: true, value: { storage: null } });
  });
  it("rejects a nested object", () => {
    expect(serializeAuftragServiceDetails({ x: { y: 1 } })).toEqual({ ok: false, reason: "invalid_service_details" });
  });
  it("rejects an array value", () => {
    expect(serializeAuftragServiceDetails({ x: [1, 2] })).toEqual({ ok: false, reason: "invalid_service_details" });
  });
  it("rejects undefined values", () => {
    expect(serializeAuftragServiceDetails({ x: undefined })).toEqual({ ok: false, reason: "invalid_service_details" });
  });
  it("rejects NaN / Infinity", () => {
    expect(serializeAuftragServiceDetails({ x: NaN })).toEqual({ ok: false, reason: "invalid_service_details" });
    expect(serializeAuftragServiceDetails({ x: Infinity })).toEqual({ ok: false, reason: "invalid_service_details" });
  });
  it("does not mutate its input", () => {
    const input = { from_rooms: 3, note: null };
    const snap = structuredClone(input);
    serializeAuftragServiceDetails(input);
    expect(input).toEqual(snap);
  });
});

describe("buildAuftragInsertPayload", () => {
  const extraArg = { appointmentId: "appt1", language: "de" };

  it("builds a generated Insert from a valid source", () => {
    const r = buildAuftragInsertPayload(makeSource(), extraArg);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // compile-time contract: assignable to the generated Insert type
      const v: Database["public"]["Tables"]["auftraege"]["Insert"] = r.value;
      expect(v.company_id).toBe("c1");
      expect(v.status).toBe("geplant");
      expect(v.appointment_id).toBe("appt1");
      expect(v.language).toBe("de");
    }
  });
  it("emits the auftrag_nummer trigger sentinel (empty string)", () => {
    const r = buildAuftragInsertPayload(makeSource(), extraArg);
    if (r.ok) expect(r.value.auftrag_nummer).toBe("");
  });
  it("preserves nullable lead_id / offer_id", () => {
    const r = buildAuftragInsertPayload(makeSource({ leadId: null, offerId: null }), extraArg);
    if (r.ok) {
      expect(r.value.lead_id).toBeNull();
      expect(r.value.offer_id).toBeNull();
    }
  });
  it("passes financial snapshot values through unchanged", () => {
    const r = buildAuftragInsertPayload(makeSource({ subtotal: 1000, hourlyRate: 150, vatRate: 8.1, vatAmount: 81, total: 1081 }), extraArg);
    if (r.ok) {
      expect(r.value.subtotal).toBe(1000);
      expect(r.value.hourly_rate).toBe(150);
      expect(r.value.vat_rate).toBe(8.1);
      expect(r.value.vat_amount).toBe(81);
      expect(r.value.total).toBe(1081);
    }
  });
  it("uses the serializer output for the JSON columns", () => {
    const r = buildAuftragInsertPayload(makeSource(), extraArg);
    if (r.ok) {
      expect(r.value.items).toEqual([{ id: "i1", position: 1, description: "Umzug", quantity: 2, unit: "Std", unit_price: 120, total: 240, price_type: "hourly" }]);
      expect(r.value.extra_services).toEqual([{ id: "e1", description: "Entsorgung", quantity: 1, unit: "Pauschal", unit_price: 80 }]);
      expect(r.value.service_details).toEqual({ from_rooms: 3, packing_service_needed: true, note: null });
    }
  });
  it("fails on an invalid status", () => {
    expect(buildAuftragInsertPayload(makeSource({ status: "bogus" }), extraArg)).toEqual({ ok: false, reason: "invalid_status" });
  });
  it("fails on malformed JSON snapshots", () => {
    expect(buildAuftragInsertPayload(makeSource({ items: [{ ...item, unit_price: NaN }] }), extraArg)).toEqual({ ok: false, reason: "invalid_items" });
    expect(buildAuftragInsertPayload(makeSource({ serviceDetails: { x: [1] } }), extraArg)).toEqual({ ok: false, reason: "invalid_service_details" });
  });
  it("fails on non-finite financial values", () => {
    expect(buildAuftragInsertPayload(makeSource({ total: NaN }), extraArg)).toEqual({ ok: false, reason: "invalid_number" });
  });
  it("does not mutate the source", () => {
    const source = makeSource();
    const snap = structuredClone(source);
    buildAuftragInsertPayload(source, extraArg);
    expect(source).toEqual(snap);
  });
});

describe("buildAuftragUpdatePayload", () => {
  it("builds a generated Update and omits immutable/create-only fields", () => {
    const r = buildAuftragUpdatePayload(makeSource());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v: Database["public"]["Tables"]["auftraege"]["Update"] = r.value;
      const keys = Object.keys(v);
      expect(keys).not.toContain("auftrag_nummer");
      expect(keys).not.toContain("company_id");
      expect(keys).not.toContain("appointment_id");
      expect(keys).not.toContain("language");
    }
  });
  it("does not auto-add reminder-reset fields", () => {
    const r = buildAuftragUpdatePayload(makeSource());
    if (r.ok) {
      const keys = Object.keys(r.value);
      expect(keys).not.toContain("reminder_sent_at");
      expect(keys).not.toContain("team_reminder_sent");
      expect(keys).not.toContain("customer_reminder_sent");
      expect(keys).not.toContain("customer_reminder_sent_at");
    }
  });
  it("preserves nullable field semantics", () => {
    const r = buildAuftragUpdatePayload(makeSource({ offerId: null, teamLeaderId: null, customerPhone: null }));
    if (r.ok) {
      expect(r.value.offer_id).toBeNull();
      expect(r.value.team_leader_id).toBeNull();
      expect(r.value.customer_phone).toBeNull();
    }
  });
  it("passes financial snapshot values through unchanged", () => {
    const r = buildAuftragUpdatePayload(makeSource({ subtotal: 500, total: 540.5 }));
    if (r.ok) {
      expect(r.value.subtotal).toBe(500);
      expect(r.value.total).toBe(540.5);
    }
  });
  it("fails on invalid status / JSON", () => {
    expect(buildAuftragUpdatePayload(makeSource({ status: "" })).ok).toBe(false);
    expect(buildAuftragUpdatePayload(makeSource({ extraServices: [{ ...extra, quantity: Infinity }] }))).toEqual({ ok: false, reason: "invalid_extra_services" });
  });
  it("does not mutate the source", () => {
    const source = makeSource();
    const snap = structuredClone(source);
    buildAuftragUpdatePayload(source);
    expect(source).toEqual(snap);
  });
});

describe("applyAuftragRescheduleReset", () => {
  const base: AuftragUpdate = { title: "X", scheduled_date: "2026-02-10", scheduled_time: "09:00:00" };

  it("adds the four reminder-reset fields when the schedule changed", () => {
    const out = applyAuftragRescheduleReset(base, true);
    expect(out.team_reminder_sent).toBe(false);
    expect(out.reminder_sent_at).toBeNull();
    expect(out.customer_reminder_sent).toBe(false);
    expect(out.customer_reminder_sent_at).toBeNull();
  });
  it("returns the payload unchanged (no reminder fields) when the schedule did not change", () => {
    const out = applyAuftragRescheduleReset(base, false);
    expect("team_reminder_sent" in out).toBe(false);
    expect("reminder_sent_at" in out).toBe(false);
    expect(out).toBe(base);
  });
  it("does not mutate its input", () => {
    const input: AuftragUpdate = { ...base };
    const snap = structuredClone(input);
    applyAuftragRescheduleReset(input, true);
    expect(input).toEqual(snap);
  });
});

describe("stripAuftragSchedule", () => {
  it("removes the three schedule columns, keeps the rest", () => {
    const payload: AuftragUpdate = {
      title: "X", status: "geplant",
      scheduled_date: "2026-02-10", scheduled_time: "09:00:00", estimated_duration_minutes: 120,
    };
    const out = stripAuftragSchedule(payload);
    expect("scheduled_date" in out).toBe(false);
    expect("scheduled_time" in out).toBe(false);
    expect("estimated_duration_minutes" in out).toBe(false);
    expect(out.title).toBe("X");
    expect(out.status).toBe("geplant");
  });
  it("does not mutate its input", () => {
    const payload: AuftragUpdate = { title: "X", scheduled_date: "2026-02-10", scheduled_time: "09:00:00", estimated_duration_minutes: 120 };
    const snap = structuredClone(payload);
    stripAuftragSchedule(payload);
    expect(payload).toEqual(snap);
  });
});
