import { describe, it, expect } from "vitest";
import { parseOfferAgbSections, localizeOfferAgbSections } from "@/lib/offerAgbSections";
import { mapOfferToPdfData, type LegacyOfferData } from "@/components/pdf/utils/mapOfferData";
import type { OfferAgbSection } from "@/components/pdf/types/offer.types";

const section = (over: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  id: "a1",
  title: "Haftung",
  content: "Der Frachtführer haftet nur für grobe Fahrlässigkeit.",
  display_order: 1,
  ...over,
});

describe("parseOfferAgbSections", () => {
  it("treats null / undefined / [] as valid 'no AGB'", () => {
    expect(parseOfferAgbSections(null)).toEqual({ ok: true, value: [] });
    expect(parseOfferAgbSections(undefined)).toEqual({ ok: true, value: [] });
    expect(parseOfferAgbSections([])).toEqual({ ok: true, value: [] });
  });

  it("accepts valid sections and returns only the canonical fields", () => {
    const result = parseOfferAgbSections([section({ id: "x", title: "T", content: "C", display_order: 3 })]);
    expect(result).toEqual({
      ok: true,
      value: [{ id: "x", title: "T", content: "C", display_order: 3 }],
    });
  });

  it("preserves input order verbatim (does NOT re-sort by display_order)", () => {
    const raw = [
      section({ id: "b", display_order: 5 }),
      section({ id: "a", display_order: 1 }),
      section({ id: "c", display_order: 3 }),
    ];
    const result = parseOfferAgbSections(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("allows null display_order and normalizes missing display_order to null", () => {
    const result = parseOfferAgbSections([
      section({ id: "n", display_order: null }),
      { id: "m", title: "T", content: "C" }, // display_order absent
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].display_order).toBeNull();
      expect(result.value[1].display_order).toBeNull();
    }
  });

  it("rejects a non-array", () => {
    expect(parseOfferAgbSections({}).ok).toBe(false);
    expect(parseOfferAgbSections("nope").ok).toBe(false);
    expect(parseOfferAgbSections(42).ok).toBe(false);
  });

  it("rejects a section that is not an object", () => {
    expect(parseOfferAgbSections(["nope"]).ok).toBe(false);
    expect(parseOfferAgbSections([null]).ok).toBe(false);
    expect(parseOfferAgbSections([[section()]]).ok).toBe(false);
  });

  it("rejects a missing / empty / whitespace-only id, title or content", () => {
    for (const field of ["id", "title", "content"] as const) {
      expect(parseOfferAgbSections([section({ [field]: undefined })]).ok).toBe(false);
      expect(parseOfferAgbSections([section({ [field]: "" })]).ok).toBe(false);
      expect(parseOfferAgbSections([section({ [field]: "   " })]).ok).toBe(false);
      expect(parseOfferAgbSections([section({ [field]: 123 })]).ok).toBe(false);
    }
  });

  it("rejects a non-finite or non-numeric display_order (NaN / Infinity / string)", () => {
    expect(parseOfferAgbSections([section({ display_order: NaN })]).ok).toBe(false);
    expect(parseOfferAgbSections([section({ display_order: Infinity })]).ok).toBe(false);
    expect(parseOfferAgbSections([section({ display_order: -Infinity })]).ok).toBe(false);
    expect(parseOfferAgbSections([section({ display_order: "1" })]).ok).toBe(false);
  });

  it("fails the WHOLE result if any single section is malformed", () => {
    const result = parseOfferAgbSections([section({ id: "ok1" }), section({ title: "" }), section({ id: "ok2" })]);
    expect(result.ok).toBe(false);
  });

  it("tolerates extra keys and drops them from the output", () => {
    const result = parseOfferAgbSections([
      section({ company_id: "c1", service_type: "umzug", is_active: true, translations: { fr: {} } }),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value[0]).sort()).toEqual(["content", "display_order", "id", "title"]);
    }
  });

  it("does not mutate the input", () => {
    const raw = [section({ company_id: "keep" })];
    const snapshot = JSON.parse(JSON.stringify(raw));
    parseOfferAgbSections(raw);
    expect(raw).toEqual(snapshot);
  });
});

// ── Mapper carry-through (the PDF-payload wiring) ──────────────────────────────────────
const baseOffer = (agbSections?: OfferAgbSection[] | null): LegacyOfferData => ({
  id: "11111111-2222-3333-4444-555555555555",
  title: "Privatumzug",
  customer_first_name: "Anna",
  customer_last_name: "Muster",
  customer_email: "anna@example.com",
  subtotal: 1000,
  vat_rate: 8.1,
  vat_amount: 81,
  total: 1081,
  created_at: "2026-07-16T00:00:00.000Z",
  items: [{ description: "Umzug pauschal", quantity: 1, unit: "Pauschale", unit_price: 1000, total: 1000 }],
  company: { company_name: "Hirschen Umzug", plz: "6003", city: "Luzern", email: "info@example.com" },
  agbSections,
});

// ── Email/document-locale parity (localizeOfferAgbSections) ────────────────────────────
const row = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  title: "Haftung",
  content: "Deutscher Basistext.",
  display_order: 1,
  translations: {
    fr: { title: "Responsabilité", content: "Texte français." },
    en: { title: "Liability", content: "English text." },
  },
  ...over,
});

describe("localizeOfferAgbSections", () => {
  it("DE (base locale) returns the German base title/content", () => {
    const [s] = localizeOfferAgbSections([row()], "de");
    expect(s.title).toBe("Haftung");
    expect(s.content).toBe("Deutscher Basistext.");
  });

  it("FR resolves title and content to French", () => {
    const [s] = localizeOfferAgbSections([row()], "fr");
    expect(s.title).toBe("Responsabilité");
    expect(s.content).toBe("Texte français.");
  });

  it("EN resolves title and content to English", () => {
    const [s] = localizeOfferAgbSections([row()], "en");
    expect(s.title).toBe("Liability");
    expect(s.content).toBe("English text.");
  });

  it("falls back to the German base when the locale has no translation", () => {
    const [s] = localizeOfferAgbSections([row({ translations: {} })], "fr");
    expect(s.title).toBe("Haftung");
    expect(s.content).toBe("Deutscher Basistext.");
  });

  it("falls back per-field on a partial translation (title only)", () => {
    const [s] = localizeOfferAgbSections([row({ translations: { fr: { title: "Responsabilité" } } })], "fr");
    expect(s.title).toBe("Responsabilité");
    expect(s.content).toBe("Deutscher Basistext.");
  });

  it("preserves section order and passes id/display_order through", () => {
    const rows = [row({ id: "b", display_order: 5 }), row({ id: "a", display_order: 1 })];
    const out = localizeOfferAgbSections(rows, "fr");
    expect(out.map((s) => s.id)).toEqual(["b", "a"]);
    expect(out.map((s) => s.display_order)).toEqual([5, 1]);
  });

  it("never forwards the raw translations bundle into the output", () => {
    const out = localizeOfferAgbSections([row()], "fr");
    expect(Object.keys(out[0]).sort()).toEqual(["content", "display_order", "id", "title"]);
  });

  it("does not mutate the input rows", () => {
    const rows = [row()];
    const snapshot = JSON.parse(JSON.stringify(rows));
    localizeOfferAgbSections(rows, "fr");
    expect(rows).toEqual(snapshot);
  });

  it("composes with parseOfferAgbSections: a valid localized result passes", () => {
    const result = parseOfferAgbSections(localizeOfferAgbSections([row()], "fr"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0].title).toBe("Responsabilité");
  });

  it("composes with parseOfferAgbSections: an empty base (malformed) localized result is rejected", () => {
    // No fr translation AND an empty German base → localizes to "" → parser fails closed.
    const result = parseOfferAgbSections(
      localizeOfferAgbSections([row({ content: "", translations: {} })], "fr"),
    );
    expect(result.ok).toBe(false);
  });
});

describe("mapOfferToPdfData — AGB carry-through", () => {
  it("carries valid AGB sections 1:1 into PdfOfferData", () => {
    const agb: OfferAgbSection[] = [{ id: "a1", title: "Haftung", content: "…", display_order: 1 }];
    const result = mapOfferToPdfData(baseOffer(agb));
    expect(result.agbSections).toEqual(agb);
  });

  it("maps a missing AGB to null (no AGB page rendered)", () => {
    expect(mapOfferToPdfData(baseOffer(undefined)).agbSections).toBeNull();
    expect(mapOfferToPdfData(baseOffer(null)).agbSections).toBeNull();
  });
});
