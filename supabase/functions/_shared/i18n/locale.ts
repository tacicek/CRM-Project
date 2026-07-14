/**
 * Locale primitives for customer-facing communication (emails, SMS).
 *
 * Deno edge functions cannot import from src/ — this module is the edge-side
 * counterpart of the frontend locale handling, following the same deliberate
 * duplication precedent as _shared/serviceLabels.ts vs src/lib/serviceLabels.ts.
 *
 * Source of the locale value at runtime:
 *   leads.language | offers.language | appointments.language | auftraege.language |
 *   rechnungen.language | quittungen.language, falling back to
 *   companies.default_language, falling back to DEFAULT_LOCALE.
 */

export const LOCALES = ["de", "fr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Type guard — true only for an exact supported locale code. */
export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/**
 * Narrow an untrusted DB column / request body value to a Locale.
 * Never throws; anything unrecognised (null, undefined, "DE-ch", 42, …) falls
 * back to German. Case and surrounding whitespace are tolerated, and a regional
 * tag ("fr-CH") is reduced to its primary subtag ("fr").
 */
export const toLocale = (v: unknown): Locale => {
  if (typeof v !== "string") return DEFAULT_LOCALE;
  const primary = v.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
};

/** BCP-47 tags used for Intl date/number formatting. Swiss variants on purpose. */
export const LOCALE_TAGS: Record<Locale, string> = {
  de: "de-CH",
  fr: "fr-CH",
  en: "en-GB",
};
