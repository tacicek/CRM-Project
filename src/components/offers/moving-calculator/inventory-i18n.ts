import { createTranslator, type MessageKey } from "@/i18n/translator";
import type { Locale } from "@/i18n/locale";
import type { InventoryCategory, InventoryItem } from "./types";

/**
 * Display names for the moving-calculator inventory.
 *
 * `inventory-data.ts` keeps `name_de` on purpose — but it is a MATCHING KEY, not copy:
 * `useLeadDataMapper` fuzzy-matches it against the lead's German free text. Deleting it
 * would silently break that matching. So the German string stays as data, and everything
 * VISIBLE is resolved here, from the catalog, in the operator's language.
 *
 * Operator axis only: these names appear in the calculator panel, never on the customer's
 * PDF. A calculator row becomes an offer item through `offer_items.description`, which is
 * written separately in the customer's language.
 *
 * An id with no catalog entry falls back to `name_de` — a new item added to the data file
 * shows up in German rather than as a raw key, and never as an empty cell.
 */

const resolve = (key: string, fallback: string, locale: Locale): string => {
  const t = createTranslator(locale);
  const translated = t(key as MessageKey);
  // createTranslator echoes the key back when nothing matched — treat that as a miss.
  return translated === key ? fallback : translated;
};

export const inventoryCategoryName = (
  category: Pick<InventoryCategory, "id" | "name_de">,
  locale: Locale,
): string => resolve(`inventory.category.${category.id}`, category.name_de, locale);

export const inventoryItemName = (
  item: Pick<InventoryItem, "id" | "name_de">,
  locale: Locale,
): string => resolve(`inventory.item.${item.id}`, item.name_de, locale);
