/**
 * Locale primitives — the single source of truth for the frontend.
 *
 * The system has two independent language axes:
 *
 *  1. DASHBOARD locale — which language the *operator* (the company) works in.
 *     Source: `companies.default_language`, optionally overridden per browser.
 *     Scope: everything under /firma/*.
 *
 *  2. DOCUMENT locale — which language the *customer* is addressed in.
 *     Source: `leads.language`, frozen onto `offers.language` and inherited by
 *     appointments / auftraege / rechnungen / quittungen.
 *     Scope: PDFs, e-mails, SMS, public token pages.
 *
 * These two must never be conflated. A German-speaking operator sends a French
 * offer to a French customer; both axes are live at the same time in the same
 * browser tab. That is why every customer-facing renderer takes the locale as an
 * explicit argument instead of reading it from ambient React context.
 */

export const LOCALES = ["de", "fr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Swiss default. Also the DB default for every `language` column. */
export const DEFAULT_LOCALE: Locale = "de";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/**
 * Narrow an untrusted value (DB column, URL param, request body) to a Locale,
 * falling back to German. Never throws — a bad locale must degrade to a readable
 * document, not a crashed PDF.
 */
export const toLocale = (value: unknown): Locale =>
  isLocale(value) ? value : DEFAULT_LOCALE;

/** Endonyms — a language picker shows each language in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  de: "Deutsch",
  fr: "Français",
  en: "English",
};

/** BCP-47 tags, Swiss regional variants — drives Intl number/date formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  de: "de-CH",
  fr: "fr-CH",
  en: "en-GB",
};
