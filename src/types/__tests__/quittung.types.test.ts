import { describe, it, expect } from "vitest";
import {
  validateQuittungPositionen,
  isQuittungStatus,
  mapQuittungRow,
  type QuittungPosition,
} from "@/types/quittung.types";
import type { Database } from "@/integrations/supabase/types";

type QuittungRow = Database["public"]["Tables"]["quittungen"]["Row"];

const makeRow = (overrides: Partial<QuittungRow> = {}): QuittungRow => ({
  id: "q1",
  company_id: "c1",
  auftrag_id: null,
  offer_id: null,
  language: "de",
  quittung_nr: "Q-2026-0001",
  datum: "2026-02-01",
  customer_name: "Max Mustermann",
  customer_address: null,
  customer_destination: null,
  customer_email: null,
  customer_phone: null,
  positionen: [],
  zwischensumme: 100,
  mwst_satz: 8.1,
  mwst_betrag: 8.1,
  total: 108.1,
  rabatt: 0,
  gesamttotal: 108.1,
  kunde_unterschrift: null,
  teamchef_unterschrift: null,
  kunde_signed_at: null,
  teamchef_signed_at: null,
  status: "draft",
  betrag_noch_offen: false,
  pdf_url: null,
  notiz: null,
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  ...overrides,
});

const pos: QuittungPosition = {
  id: "p1",
  beschreibung: "Umzug pauschal",
  satz: "3 Std. × CHF 50",
  betrag: 150,
  checked: true,
  menge: 3,
  einheit: "Std",
  is_custom: false,
};

describe("validateQuittungPositionen", () => {
  it("accepts a valid list and preserves values", () => {
    expect(validateQuittungPositionen([pos])).toEqual({ ok: true, value: [pos] });
  });
  it("treats null/undefined as the valid empty list", () => {
    expect(validateQuittungPositionen(null)).toEqual({ ok: true, value: [] });
    expect(validateQuittungPositionen(undefined)).toEqual({ ok: true, value: [] });
  });
  it("accepts nullable menge/einheit", () => {
    expect(validateQuittungPositionen([{ ...pos, menge: null, einheit: null }]).ok).toBe(true);
  });
  it("fails closed on a non-array", () => {
    expect(validateQuittungPositionen("x")).toEqual({ ok: false });
    expect(validateQuittungPositionen({})).toEqual({ ok: false });
  });
  it("fails closed when ANY position is malformed (no silent filtering)", () => {
    expect(validateQuittungPositionen([pos, { id: "y" }])).toEqual({ ok: false });
    expect(validateQuittungPositionen([{ ...pos, betrag: NaN }])).toEqual({ ok: false });
    expect(validateQuittungPositionen([{ ...pos, checked: "yes" }])).toEqual({ ok: false });
    expect(validateQuittungPositionen([{ ...pos, satz: 5 }])).toEqual({ ok: false });
  });
  it("does not mutate its input", () => {
    const input = [{ ...pos }];
    validateQuittungPositionen(input);
    expect(input).toEqual([pos]);
  });
});

describe("isQuittungStatus", () => {
  it("accepts exactly the four DB-CHECK values", () => {
    for (const s of ["draft", "signed", "sent", "paid"]) expect(isQuittungStatus(s)).toBe(true);
  });
  it("rejects unknown/empty/non-string (no draft fallback)", () => {
    expect(isQuittungStatus("cancelled")).toBe(false);
    expect(isQuittungStatus("")).toBe(false);
    expect(isQuittungStatus(null)).toBe(false);
    expect(isQuittungStatus(undefined)).toBe(false);
    expect(isQuittungStatus(1)).toBe(false);
  });
});

describe("mapQuittungRow", () => {
  const pos: QuittungPosition = {
    id: "p1", beschreibung: "Umzug", satz: "3 Std.", betrag: 150,
    checked: true, is_custom: false,
  };

  it("maps a valid row to a Quittung, narrowing status + positionen", () => {
    // Input is written as a fresh object literal so it satisfies the DB row's `Json`
    // column type; `pos` (a named QuittungPosition) is the value we expect back out.
    const res = mapQuittungRow(
      makeRow({
        status: "sent",
        positionen: [{ id: "p1", beschreibung: "Umzug", satz: "3 Std.", betrag: 150, checked: true, is_custom: false }],
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.status).toBe("sent");
      expect(res.value.positionen).toEqual([pos]);
    }
  });

  it("fails closed on an out-of-range status (never coerced to draft)", () => {
    expect(mapQuittungRow(makeRow({ status: "cancelled" }))).toEqual({ ok: false, reason: "invalid_status" });
  });

  it("fails closed on malformed positionen", () => {
    const res = mapQuittungRow(makeRow({ positionen: [{ id: "x" }] }));
    expect(res).toEqual({ ok: false, reason: "invalid_positionen" });
  });

  it("preserves nullable auftrag_id/offer_id and quittung_nr", () => {
    const res = mapQuittungRow(makeRow({ auftrag_id: null, offer_id: null, quittung_nr: null }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.auftrag_id).toBeNull();
      expect(res.value.offer_id).toBeNull();
      expect(res.value.quittung_nr).toBeNull(); // no fabricated document number
    }
  });

  it("does not change financial snapshot values and does not mutate the row", () => {
    const row = makeRow({ zwischensumme: 100, mwst_betrag: 8.1, total: 108.1, gesamttotal: 108.1, rabatt: 5 });
    const snap = structuredClone(row);
    const res = mapQuittungRow(row);
    expect(row).toEqual(snap); // no mutation
    if (res.ok) {
      expect(res.value.zwischensumme).toBe(100);
      expect(res.value.total).toBe(108.1);
      expect(res.value.gesamttotal).toBe(108.1);
      expect(res.value.rabatt).toBe(5);
    }
  });
});
