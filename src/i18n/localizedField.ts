/**
 * DB-authored content in the customer's language.
 *
 * Catalog items, AGB sections, checklist templates and company text blocks carry a
 * `translations` JSONB column of the shape:
 *
 *   { "fr": { "name": "Emballage", "description": "…" },
 *     "en": { "name": "Packing",   "description": "…" } }
 *
 * The German base column (`name`, `description`, …) stays the source of truth AND the
 * fallback — a missing translation must never render as an empty string in a document.
 * This is the TS counterpart of `i18n_text()` in SQL.
 *
 * Pure — no React, no context. The locale is always passed in explicitly, because the
 * value is on the DOCUMENT axis (the customer's language), never on the dashboard axis
 * (the operator's language). See src/i18n/README.md.
 */

import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";

/** A row that may carry a `translations` JSONB bundle next to its German base columns. */
interface TranslatableRow {
  translations?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Overloads: a non-nullable base column (e.g. `name`) can never resolve to null, so the
// caller does not have to re-assert it. A nullable one (e.g. `description`) still can.
export function localizedField<F extends string>(
  row: TranslatableRow & { [K in F]: string },
  field: F,
  locale: Locale,
): string;
export function localizedField<F extends string>(
  row: TranslatableRow & { [K in F]?: string | null },
  field: F,
  locale: Locale,
): string | null;
export function localizedField<F extends string>(
  row: TranslatableRow & { [K in F]?: string | null },
  field: F,
  locale: Locale,
): string | null {
  const base = row[field] ?? null;

  // German is the base column itself — there is nothing to look up.
  if (locale === DEFAULT_LOCALE) return base;

  const bundle = row.translations;
  if (!isRecord(bundle)) return base;

  const forLocale = bundle[locale];
  if (!isRecord(forLocale)) return base;

  const translated = forLocale[field];
  // An empty / whitespace-only translation is treated as missing → German base.
  return typeof translated === "string" && translated.trim() !== "" ? translated : base;
}

/**
 * Narrow a raw `translations` JSONB value (typed `Json` by the generated Supabase
 * types) into the editable shape the translation UI works with.
 *
 * Everything that is not a string survives as nothing rather than as garbage: a
 * malformed bundle degrades to "no translation", which falls back to German — the
 * same outcome as an absent bundle. No cast, no `any`.
 */
export const asTranslations = (
  value: unknown,
): Record<string, Record<string, string>> => {
  if (!isRecord(value)) return {};
  const out: Record<string, Record<string, string>> = {};
  for (const [locale, fields] of Object.entries(value)) {
    if (!isRecord(fields)) continue;
    const entry: Record<string, string> = {};
    for (const [field, text] of Object.entries(fields)) {
      if (typeof text === "string") entry[field] = text;
    }
    if (Object.keys(entry).length > 0) out[locale] = entry;
  }
  return out;
};
