import { describe, it, expect } from "vitest";
import { checklistSectionsToJson, parseChecklistSections, type ChecklistSection } from "@/lib/checklistTemplates";

const section = (over: Partial<ChecklistSection> = {}): ChecklistSection => ({
  id: "s1",
  timeline: "4 Wochen vorher",
  items: ["Kartons besorgen", "Umzugsfirma buchen"],
  order: 1,
  ...over,
});

/** Cast-free narrowing so tests can read a serialized section's keys. */
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

describe("checklistSectionsToJson", () => {
  it("empty array → empty JSON array", () => {
    expect(checklistSectionsToJson([])).toEqual([]);
  });
  it("single section → exact canonical shape", () => {
    expect(checklistSectionsToJson([section()])).toEqual([
      { id: "s1", timeline: "4 Wochen vorher", items: ["Kartons besorgen", "Umzugsfirma buchen"], order: 1 },
    ]);
  });
  it("multiple sections keep their order", () => {
    expect(checklistSectionsToJson([
      section({ id: "a", order: 1 }),
      section({ id: "b", order: 2 }),
      section({ id: "c", order: 3 }),
    ])).toEqual([
      { id: "a", timeline: "4 Wochen vorher", items: ["Kartons besorgen", "Umzugsfirma buchen"], order: 1 },
      { id: "b", timeline: "4 Wochen vorher", items: ["Kartons besorgen", "Umzugsfirma buchen"], order: 2 },
      { id: "c", timeline: "4 Wochen vorher", items: ["Kartons besorgen", "Umzugsfirma buchen"], order: 3 },
    ]);
  });
  it("item order is preserved", () => {
    expect(checklistSectionsToJson([section({ items: ["x", "y", "z"] })]))
      .toEqual([{ id: "s1", timeline: "4 Wochen vorher", items: ["x", "y", "z"], order: 1 }]);
  });
  it("unknown / Unicode text is preserved verbatim", () => {
    expect(checklistSectionsToJson([section({ timeline: "Prüfung ✓ — Größe", items: ["Klavier 🎹"] })]))
      .toEqual([{ id: "s1", timeline: "Prüfung ✓ — Größe", items: ["Klavier 🎹"], order: 1 }]);
  });
  it("empty strings are NOT changed by the serializer (cleanSections is a separate layer)", () => {
    expect(checklistSectionsToJson([section({ timeline: "", items: ["", "keep"] })]))
      .toEqual([{ id: "s1", timeline: "", items: ["", "keep"], order: 1 }]);
  });
  it("fractional finite order is preserved as-is", () => {
    expect(checklistSectionsToJson([section({ order: 1.5 })]))
      .toEqual([{ id: "s1", timeline: "4 Wochen vorher", items: ["Kartons besorgen", "Umzugsfirma buchen"], order: 1.5 }]);
  });
  it("extra runtime keys are not carried into the output", () => {
    const withExtra = { ...section(), bogus: "leak", checked: true };
    expect(checklistSectionsToJson([withExtra]))
      .toEqual([{ id: "s1", timeline: "4 Wochen vorher", items: ["Kartons besorgen", "Umzugsfirma buchen"], order: 1 }]);
  });
  it("does not mutate its input (sections or items)", () => {
    const input = [section({ items: ["a", "b"] })];
    const snap = structuredClone(input);
    checklistSectionsToJson(input);
    expect(input).toEqual(snap);
  });
  it("output array and section objects are fresh references", () => {
    const input = [section()];
    const out = checklistSectionsToJson(input);
    expect(out).not.toBe(input);
    if (Array.isArray(out)) expect(out[0]).not.toBe(input[0]);
  });
  it("output items array is a fresh reference", () => {
    const items = ["a", "b"];
    const out = checklistSectionsToJson([section({ items })]);
    if (Array.isArray(out) && isObj(out[0])) expect(out[0].items).not.toBe(items);
  });
});

describe("parseChecklistSections", () => {
  it("valid canonical sections → fresh ChecklistSection[], order preserved", () => {
    expect(parseChecklistSections([
      { id: "a", timeline: "t1", items: ["x"], order: 1 },
      { id: "b", timeline: "t2", items: ["y", "z"], order: 2 },
    ])).toEqual([
      { id: "a", timeline: "t1", items: ["x"], order: 1 },
      { id: "b", timeline: "t2", items: ["y", "z"], order: 2 },
    ]);
  });
  it("null / non-array / empty → null (no attachment)", () => {
    expect(parseChecklistSections(null)).toBeNull();
    expect(parseChecklistSections(undefined)).toBeNull();
    expect(parseChecklistSections("x")).toBeNull();
    expect(parseChecklistSections({})).toBeNull();
    expect(parseChecklistSections([])).toBeNull();
  });
  it("malformed section (bad id/timeline/items/order) → null (no silent filtering)", () => {
    expect(parseChecklistSections([{ id: 1, timeline: "t", items: [], order: 1 }])).toBeNull();
    expect(parseChecklistSections([{ id: "s", timeline: "t", items: [1], order: 1 }])).toBeNull();
    expect(parseChecklistSections([{ id: "s", timeline: "t", items: ["x"], order: "1" }])).toBeNull();
    expect(parseChecklistSections([{ id: "s", timeline: "t", items: ["x"], order: NaN }])).toBeNull();
    expect(parseChecklistSections([{ id: "a", timeline: "t", items: ["x"], order: 1 }, { id: "b" }])).toBeNull();
  });
  it("output items array is fresh and input is not mutated", () => {
    const input = [{ id: "s1", timeline: "4 Wochen", items: ["a", "b"], order: 1 }];
    const snap = structuredClone(input);
    const out = parseChecklistSections(input);
    expect(input).toEqual(snap);
    if (out) expect(out[0].items).not.toBe(input[0].items);
  });
});
