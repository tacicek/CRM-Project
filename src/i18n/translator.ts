import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale } from "@/i18n/locale";
import { de } from "@/i18n/catalog/de";
import { fr } from "@/i18n/catalog/fr";
import { en } from "@/i18n/catalog/en";

/**
 * German is the source of truth for the key set: `fr` and `en` are typed as
 * `Record<MessageKey, string>`, so a missing or misspelled key in a translation
 * is a compile error, not a silent English-looking German string at runtime.
 */
export type MessageKey = keyof typeof de;

export type TranslationParams = Record<string, string | number>;

const CATALOGS: Record<Locale, Record<MessageKey, string>> = { de, fr, en };

/**
 * Plural-aware key resolution.
 *
 * When `params.count` is present and the catalog holds `<key>#one` / `<key>#other`
 * variants, the correct one is picked with Intl.PluralRules for the target locale.
 * This is not cosmetic: French treats 0 as singular ("0 offre") while German and
 * English treat it as plural ("0 Offerten" / "0 offers"). Hardcoding `count === 1`
 * would silently produce wrong French.
 */
const resolveKey = (
  catalog: Record<MessageKey, string>,
  key: MessageKey,
  locale: Locale,
  params?: TranslationParams,
): string | undefined => {
  const direct = catalog[key];
  if (typeof params?.count === "number") {
    const category = new Intl.PluralRules(LOCALE_TAGS[locale]).select(params.count);
    const variant = `${key}#${category}` as MessageKey;
    const pluralised = catalog[variant] ?? catalog[`${key}#other` as MessageKey];
    if (typeof pluralised === "string") return pluralised;
  }
  return direct;
};

const PLACEHOLDER = /\{(\w+)\}/g;

const interpolate = (template: string, params?: TranslationParams): string => {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
};

export type Translator = (key: MessageKey, params?: TranslationParams) => string;

/**
 * Build a translator bound to one locale.
 *
 * Pure and framework-free on purpose — the same function backs the React
 * dashboard, the @react-pdf document renderers and any non-React caller. React
 * context is only a delivery mechanism for the *dashboard* locale; customer-facing
 * renderers construct their own translator from the document's stored language.
 *
 * Falls back to German for a key that is somehow absent at runtime (e.g. a stale
 * cached chunk after a deploy) rather than rendering a raw key at the customer.
 */
export const createTranslator = (locale: Locale): Translator => {
  const catalog = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
  const fallback = CATALOGS[DEFAULT_LOCALE];

  return (key, params) => {
    const template =
      resolveKey(catalog, key, locale, params) ??
      resolveKey(fallback, key, DEFAULT_LOCALE, params) ??
      key;
    return interpolate(template, params);
  };
};
