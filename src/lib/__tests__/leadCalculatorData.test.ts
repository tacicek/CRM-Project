import { describe, it, expect } from "vitest";
import {
  parseInventoryItems,
  parseDetailedFormData,
  type LeadInventoryItem,
} from "@/lib/leadCalculatorData";

const item: LeadInventoryItem = { kategorie: "Wohnzimmer", name: "Sofa", anzahl: 2 };

describe("parseInventoryItems", () => {
  it("null/undefined → valid null", () => {
    expect(parseInventoryItems(null)).toEqual({ ok: true, value: null });
    expect(parseInventoryItems(undefined)).toEqual({ ok: true, value: null });
  });
  it("valid array preserves values", () => {
    expect(parseInventoryItems([item, { ...item, gewicht_kg: 40, spezial: true, aufpreis_chf: 20 }]))
      .toEqual({ ok: true, value: [item, { kategorie: "Wohnzimmer", name: "Sofa", anzahl: 2, gewicht_kg: 40, spezial: true, aufpreis_chf: 20 }] });
  });
  it("non-array → invalid", () => {
    expect(parseInventoryItems("x")).toEqual({ ok: false });
    expect(parseInventoryItems({})).toEqual({ ok: false });
  });
  it("ANY malformed item → invalid (no silent filtering)", () => {
    expect(parseInventoryItems([item, { kategorie: "x", name: "y" }])).toEqual({ ok: false });
    expect(parseInventoryItems([{ ...item, anzahl: "2" }])).toEqual({ ok: false });
    expect(parseInventoryItems([{ ...item, anzahl: NaN }])).toEqual({ ok: false });
    expect(parseInventoryItems([{ ...item, gewicht_kg: Infinity }])).toEqual({ ok: false });
  });
  it("does not mutate its input", () => {
    const input = [{ ...item }];
    const snap = structuredClone(input);
    parseInventoryItems(input);
    expect(input).toEqual(snap);
  });
});

describe("parseDetailedFormData", () => {
  it("null/undefined → valid null", () => {
    expect(parseDetailedFormData(null)).toEqual({ ok: true, value: null });
    expect(parseDetailedFormData(undefined)).toEqual({ ok: true, value: null });
  });
  it("valid nested object (stockwerk string, inventar items) accepted", () => {
    const dfd = { auszug: { stockwerk: "floor_2" }, inventar: { items: [item], geschaetzte_kartons: 20 } };
    expect(parseDetailedFormData(dfd)).toEqual({ ok: true, value: dfd });
  });
  it("empty object accepted (all fields optional)", () => {
    expect(parseDetailedFormData({})).toEqual({ ok: true, value: {} });
  });
  it("non-object → invalid", () => {
    expect(parseDetailedFormData("x")).toEqual({ ok: false });
    expect(parseDetailedFormData([])).toEqual({ ok: false });
  });
  it("malformed financial inventar → invalid (fail-closed)", () => {
    expect(parseDetailedFormData({ inventar: { items: "nope" } })).toEqual({ ok: false });
    expect(parseDetailedFormData({ inventar: { items: [{ kategorie: "x" }] } })).toEqual({ ok: false });
    expect(parseDetailedFormData({ inventar: { schwere_gegenstaende: [{ name: "y" }] } })).toEqual({ ok: false });
    expect(parseDetailedFormData({ inventar: "not-object" })).toEqual({ ok: false });
  });
  it("does not mutate its input", () => {
    const input = { inventar: { items: [{ ...item }] } };
    const snap = structuredClone(input);
    parseDetailedFormData(input);
    expect(input).toEqual(snap);
  });
});
