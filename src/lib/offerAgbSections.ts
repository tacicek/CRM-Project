/**
 * Read-boundary parser for AGB (Allgemeine Geschäftsbedingungen) sections before they
 * enter an offer PDF payload. AGB is a legal document the customer accepts — so this is
 * FAIL-CLOSED: a malformed section aborts PDF generation rather than printing a document
 * with wrong or incomplete terms.
 *
 * Both real sources feed this parser:
 *   - public: RPC `get_agb_sections_by_offer_token` (title/content already language-resolved)
 *   - firma:  `agb_sections` rows, title/content resolved via `localizedField` BEFORE parsing
 *
 * The parser is PURE and STRUCTURAL — it does not know about `translations` or locale
 * (resolution is the caller's job) and it does not sort: both queries already
 * `ORDER BY display_order`, so input order is preserved verbatim. Extra keys (company_id,
 * service_type, is_active, translations, …) are tolerated and dropped; the output carries
 * only the canonical fields. No cast, no silent default, no mutation.
 */

import type { OfferAgbSection } from "@/components/pdf/types/offer.types";
import { localizedField } from "@/i18n/localizedField";
import type { Locale } from "@/i18n/locale";

export type OfferAgbSectionsResult = { ok: true; value: OfferAgbSection[] } | { ok: false };

/** A raw `agb_sections` row: German base title/content next to the `translations` JSONB bundle. */
interface AgbSectionTranslatableRow {
  id: string;
  title: string;
  content: string;
  display_order: number | null;
  translations?: unknown;
}

/**
 * Resolve each AGB row's title/content to the DOCUMENT (customer) language via the canonical
 * `localizedField` helper — the same one the public RPC (SQL `i18n_text`) and the firma
 * download use, so all three surfaces agree. The German base column is the fallback, so a
 * missing translation never yields an empty legal string. `id` and `display_order` pass
 * through, order is preserved, and the raw `translations` bundle is dropped (never forwarded
 * to the PDF). Pure — no mutation. Validate the result with `parseOfferAgbSections` before use.
 */
export const localizeOfferAgbSections = (
  rows: AgbSectionTranslatableRow[],
  locale: Locale,
): OfferAgbSection[] =>
  rows.map((row) => ({
    id: row.id,
    title: localizedField(row, "title", locale),
    content: localizedField(row, "content", locale),
    display_order: row.display_order,
  }));

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * null/undefined → null (unspecified order, valid). A finite number is kept. NaN, Infinity
 * and any non-number are rejected (returns the `invalid` sentinel), failing the whole parse.
 */
const invalidOrder = Symbol("invalid-display-order");
const normalizeDisplayOrder = (v: unknown): number | null | typeof invalidOrder => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return invalidOrder;
};

export const parseOfferAgbSections = (raw: unknown): OfferAgbSectionsResult => {
  if (raw === null || raw === undefined) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false };

  const value: OfferAgbSection[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return { ok: false };
    // id/title/content are the legally material fields: a section missing any of them is
    // treated as malformed (never rendered as a blank/partial term).
    if (!isNonEmptyString(item.id)) return { ok: false };
    if (!isNonEmptyString(item.title)) return { ok: false };
    if (!isNonEmptyString(item.content)) return { ok: false };
    const order = normalizeDisplayOrder(item.display_order);
    if (order === invalidOrder) return { ok: false };
    value.push({ id: item.id, title: item.title, content: item.content, display_order: order });
  }
  return { ok: true, value };
};
