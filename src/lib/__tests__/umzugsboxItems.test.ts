import { describe, it, expect } from "vitest";
import {
  parseBoxItemsSnapshot,
  mapUmzugsboxRentalRow,
  type UmzugsboxRentalRow,
} from "@/lib/umzugsboxItems";

describe("parseBoxItemsSnapshot", () => {
  it("null → legacy (fall back to box_type/box_quantity)", () => {
    expect(parseBoxItemsSnapshot(null)).toEqual({ ok: true, source: "legacy", value: null });
  });
  it("empty array → legacy", () => {
    expect(parseBoxItemsSnapshot([])).toEqual({ ok: true, source: "legacy", value: null });
  });
  it("undefined → invalid", () => {
    expect(parseBoxItemsSnapshot(undefined)).toEqual({ ok: false, reason: "invalid_box_items" });
  });
  it("non-array primitives/object → invalid", () => {
    expect(parseBoxItemsSnapshot("x")).toEqual({ ok: false, reason: "invalid_box_items" });
    expect(parseBoxItemsSnapshot(3)).toEqual({ ok: false, reason: "invalid_box_items" });
    expect(parseBoxItemsSnapshot(true)).toEqual({ ok: false, reason: "invalid_box_items" });
    expect(parseBoxItemsSnapshot({ type: "standard", quantity: 1 })).toEqual({ ok: false, reason: "invalid_box_items" });
  });
  it("valid single item", () => {
    expect(parseBoxItemsSnapshot([{ type: "standard", quantity: 2 }]))
      .toEqual({ ok: true, source: "items", value: [{ type: "standard", quantity: 2 }] });
  });
  it("valid multiple items, order preserved", () => {
    const r = parseBoxItemsSnapshot([
      { type: "wardrobe", quantity: 1 },
      { type: "book", quantity: 3 },
      { type: "fragile", quantity: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok && r.source === "items") {
      expect(r.value.map((i) => i.type)).toEqual(["wardrobe", "book", "fragile"]);
      expect(r.value.map((i) => i.quantity)).toEqual([1, 3, 2]);
    }
  });
  it("unknown legacy type is preserved (kept raw)", () => {
    const r = parseBoxItemsSnapshot([{ type: "legacy_kleiderbox", quantity: 1 }]);
    if (r.ok && r.source === "items") expect(r.value[0].type).toBe("legacy_kleiderbox");
  });
  it("whitespace-only type → invalid", () => {
    expect(parseBoxItemsSnapshot([{ type: "   ", quantity: 1 }])).toEqual({ ok: false, reason: "invalid_box_items" });
    expect(parseBoxItemsSnapshot([{ type: "", quantity: 1 }])).toEqual({ ok: false, reason: "invalid_box_items" });
  });
  it("string quantity → invalid", () => {
    expect(parseBoxItemsSnapshot([{ type: "standard", quantity: "2" }])).toEqual({ ok: false, reason: "invalid_box_items" });
  });
  it("zero / negative quantity → invalid", () => {
    expect(parseBoxItemsSnapshot([{ type: "standard", quantity: 0 }])).toEqual({ ok: false, reason: "invalid_box_items" });
    expect(parseBoxItemsSnapshot([{ type: "standard", quantity: -1 }])).toEqual({ ok: false, reason: "invalid_box_items" });
  });
  it("NaN / Infinity quantity → invalid", () => {
    expect(parseBoxItemsSnapshot([{ type: "standard", quantity: NaN }])).toEqual({ ok: false, reason: "invalid_box_items" });
    expect(parseBoxItemsSnapshot([{ type: "standard", quantity: Infinity }])).toEqual({ ok: false, reason: "invalid_box_items" });
  });
  it("positive fractional quantity → valid", () => {
    expect(parseBoxItemsSnapshot([{ type: "standard", quantity: 1.5 }]))
      .toEqual({ ok: true, source: "items", value: [{ type: "standard", quantity: 1.5 }] });
  });
  it("mixed array with one malformed item → entirely invalid (no silent filtering)", () => {
    expect(parseBoxItemsSnapshot([{ type: "standard", quantity: 1 }, { type: "book" }]))
      .toEqual({ ok: false, reason: "invalid_box_items" });
    expect(parseBoxItemsSnapshot([{ type: "standard", quantity: 1 }, "nope"]))
      .toEqual({ ok: false, reason: "invalid_box_items" });
  });
  it("extra keys are stripped from the output", () => {
    const r = parseBoxItemsSnapshot([{ type: "standard", quantity: 1, id: "x", selected: true }]);
    if (r.ok && r.source === "items") {
      expect(Object.keys(r.value[0]).sort()).toEqual(["quantity", "type"]);
    }
  });
  it("does not mutate its input", () => {
    const input = [{ type: "standard", quantity: 1, extra: "keep" }];
    const snap = structuredClone(input);
    parseBoxItemsSnapshot(input);
    expect(input).toEqual(snap);
  });
  it("output items are fresh objects (not the same reference as input)", () => {
    const input = [{ type: "standard", quantity: 1 }];
    const r = parseBoxItemsSnapshot(input);
    if (r.ok && r.source === "items") expect(r.value[0]).not.toBe(input[0]);
  });
  it("an invalid result carries no raw input", () => {
    const r = parseBoxItemsSnapshot([{ type: "book" }]);
    expect(r).toEqual({ ok: false, reason: "invalid_box_items" });
  });
});

// ---- Row → entry mapper ------------------------------------------------------------------

// Full, cast-free generated-Row factory (every column set explicitly, fixed values).
const makeRow = (overrides: Partial<UmzugsboxRentalRow> = {}): UmzugsboxRentalRow => ({
  actual_return_date: null,
  appointment_id: null,
  archived_at: null,
  assigned_team_member_id: null,
  box_description: null,
  box_items: [{ type: "standard", quantity: 2 }],
  box_quantity: 2,
  box_type: "standard",
  company_id: "c1",
  created_at: "2026-02-01T00:00:00Z",
  created_by: null,
  customer_email: null,
  customer_first_name: "Max",
  customer_last_name: "Mustermann",
  customer_notes: null,
  customer_notified: false,
  customer_notified_at: null,
  customer_phone: null,
  customer_pickup_request_at: null,
  delivered_by_team_member_id: null,
  delivery_address: "Bahnhofstrasse 1",
  delivery_city: "Zürich",
  delivery_date: "2026-02-10",
  delivery_plz: "8000",
  deposit_amount: 50,
  deposit_paid: false,
  expected_return_date: "2026-03-10",
  id: "r1",
  internal_notes: null,
  is_rental: true,
  lead_id: null,
  offer_id: null,
  picked_up_by_team_member_id: null,
  pickup_address: null,
  pickup_city: null,
  pickup_plz: null,
  pickup_scheduled_date: null,
  pickup_scheduled_time: null,
  reminder_days_before: 3,
  reminder_sent: false,
  reminder_sent_at: null,
  rental_price_per_day: 5,
  second_reminder_sent: false,
  second_reminder_sent_at: null,
  status: "delivered",
  updated_at: "2026-02-01T00:00:00Z",
  ...overrides,
});

describe("mapUmzugsboxRentalRow", () => {
  it("valid items → valid entry", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ box_items: [{ type: "wardrobe", quantity: 1 }, { type: "book", quantity: 3 }] }));
    expect(e.kind).toBe("valid");
    if (e.kind === "valid") {
      expect(e.rental.box_items).toEqual([{ type: "wardrobe", quantity: 1 }, { type: "book", quantity: 3 }]);
    }
  });
  it("null box_items → valid + box_items:null (legacy)", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ box_items: null }));
    expect(e.kind).toBe("valid");
    if (e.kind === "valid") expect(e.rental.box_items).toBeNull();
  });
  it("empty array → valid + box_items:null (legacy)", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ box_items: [] }));
    if (e.kind === "valid") expect(e.rental.box_items).toBeNull();
  });
  it("non-array box_items → invalid_snapshot, reason box_items", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ box_items: "bad" }));
    expect(e.kind).toBe("invalid_snapshot");
    if (e.kind === "invalid_snapshot") expect(e.reason).toBe("box_items");
  });
  it("mixed malformed array → invalid_snapshot", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ box_items: [{ type: "standard", quantity: 1 }, { type: "book" }] }));
    expect(e.kind).toBe("invalid_snapshot");
  });
  it("invalid entry carries no raw box_items (neither on entry nor on row)", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ box_items: "bad" }));
    expect("box_items" in e).toBe(false);
    if (e.kind === "invalid_snapshot") expect("box_items" in e.row).toBe(false);
  });
  it("unknown legacy type preserved in a valid entry", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ box_items: [{ type: "legacy_kleiderbox", quantity: 1 }] }));
    if (e.kind === "valid") expect(e.rental.box_items?.[0].type).toBe("legacy_kleiderbox");
  });
  it("preserves nullable scalars as null (no defaulting)", () => {
    const e = mapUmzugsboxRentalRow(makeRow({
      status: null, is_rental: null, deposit_paid: null, reminder_days_before: null,
      reminder_sent: null, customer_notified: null, created_at: null,
    }));
    expect(e.kind).toBe("valid");
    if (e.kind === "valid") {
      expect(e.rental.status).toBeNull();
      expect(e.rental.is_rental).toBeNull();
      expect(e.rental.deposit_paid).toBeNull();
      expect(e.rental.reminder_days_before).toBeNull();
      expect(e.rental.reminder_sent).toBeNull();
      expect(e.rental.customer_notified).toBeNull();
      expect(e.rental.created_at).toBeNull();
    }
  });
  it("preserves legacy box_quantity/box_type columns verbatim", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ box_quantity: 7, box_type: "archive" }));
    if (e.kind === "valid") {
      expect(e.rental.box_quantity).toBe(7);
      expect(e.rental.box_type).toBe("archive");
    }
  });
  it("preserves financial fields unchanged", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ deposit_amount: 120, rental_price_per_day: 9.5 }));
    if (e.kind === "valid") {
      expect(e.rental.deposit_amount).toBe(120);
      expect(e.rental.rental_price_per_day).toBe(9.5);
    }
  });
  it("preserves ids/customer/address/date fields", () => {
    const e = mapUmzugsboxRentalRow(makeRow({ id: "rX", company_id: "cX", delivery_date: "2026-05-01", customer_first_name: "Erika" }));
    if (e.kind === "valid") {
      expect(e.rental.id).toBe("rX");
      expect(e.rental.company_id).toBe("cX");
      expect(e.rental.delivery_date).toBe("2026-05-01");
      expect(e.rental.customer_first_name).toBe("Erika");
    }
  });
  it("does not mutate the input row", () => {
    const row = makeRow({ box_items: [{ type: "standard", quantity: 2 }] });
    const snap = structuredClone(row);
    mapUmzugsboxRentalRow(row);
    expect(row).toEqual(snap);
  });
  it("valid output box_items is a fresh array, not the row's reference", () => {
    const items = [{ type: "standard", quantity: 2 }];
    const row = makeRow({ box_items: items });
    const e = mapUmzugsboxRentalRow(row);
    if (e.kind === "valid") expect(e.rental.box_items).not.toBe(items);
  });
});
