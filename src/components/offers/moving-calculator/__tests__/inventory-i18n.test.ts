import { describe, expect, it } from "vitest";
import { INVENTORY_CATEGORIES } from "@/components/offers/moving-calculator/inventory-data";
import {
  inventoryCategoryName,
  inventoryItemName,
} from "@/components/offers/moving-calculator/inventory-i18n";
import { LOCALES } from "@/i18n/locale";

const ALL_ITEMS = INVENTORY_CATEGORIES.flatMap((c) => c.items);

describe("inventory display names", () => {
  it("every category and item resolves in every locale — no raw key, no empty cell", () => {
    for (const locale of LOCALES) {
      for (const category of INVENTORY_CATEGORIES) {
        const name = inventoryCategoryName(category, locale);
        expect(name.trim(), `${category.id} @ ${locale}`).not.toBe("");
        expect(name, `${category.id} @ ${locale}`).not.toContain("inventory.category.");
      }
      for (const item of ALL_ITEMS) {
        const name = inventoryItemName(item, locale);
        expect(name.trim(), `${item.id} @ ${locale}`).not.toBe("");
        expect(name, `${item.id} @ ${locale}`).not.toContain("inventory.item.");
      }
    }
  });

  it("German resolves to the same string the data file carries as its matching key", () => {
    // `name_de` must stay in sync with the German catalog: useLeadDataMapper matches the
    // lead's German free text against `name_de`, so a drift between the two would show the
    // operator one name and match on another.
    for (const item of ALL_ITEMS) {
      expect(inventoryItemName(item, "de"), item.id).toBe(item.name_de);
    }
  });

  it("actually translates — the regression was a German-only inventory", () => {
    const sofa = ALL_ITEMS.find((i) => i.id === "sofa_3");
    expect(sofa).toBeDefined();
    expect(inventoryItemName(sofa!, "de")).toBe("Sofa (3-Sitzer)");
    expect(inventoryItemName(sofa!, "fr")).toBe("Canapé (3 places)");
    expect(inventoryItemName(sofa!, "en")).toBe("Sofa (3-seater)");
  });

  it("falls back to the German name for an id that has no catalog entry", () => {
    // A new row added to inventory-data.ts must degrade to German, never to a raw key.
    const unknown = { id: "not_in_catalog_yet", name_de: "Neues Möbelstück" };
    for (const locale of LOCALES) {
      expect(inventoryItemName(unknown, locale)).toBe("Neues Möbelstück");
    }
  });
});
