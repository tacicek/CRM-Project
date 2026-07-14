/**
 * i18n entry point for customer-facing edge function output.
 *
 * Usage in an edge function:
 *   import { createTranslator, formatDate, formatCurrency, toLocale } from "../_shared/i18n/index.ts";
 *   const locale = toLocale(offer.language ?? company.default_language);
 *   const t = createTranslator(locale);
 *   const subject = t("email.offer.subject", { companyName, offerNumber });
 */

import { catalogs, de, type MessageKey } from "./catalog.ts";
import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale } from "./locale.ts";

export { DEFAULT_LOCALE, isLocale, LOCALE_TAGS, LOCALES, toLocale } from "./locale.ts";
export type { Locale } from "./locale.ts";
export { catalogs, de, en, fr } from "./catalog.ts";
export type { MessageKey } from "./catalog.ts";

/** Values allowed as interpolation arguments. */
export type TranslationParams = Record<string, string | number>;

/** Replace every `{placeholder}` for which a param was supplied. */
const interpolate = (template: string, params?: TranslationParams): string => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
};

export type Translator = (key: MessageKey, params?: TranslationParams) => string;

/**
 * Type guard for a dynamically built key (e.g. `"service." + row.service_type`).
 * German is the source of truth for the key set, so membership is checked against it.
 * Lets callers narrow a string to MessageKey without an unchecked cast.
 */
export const isMessageKey = (key: string): key is MessageKey => key in de;

/**
 * Translate a service type in the recipient's language.
 * Unknown types (a service the catalog does not know) fall back to the raw DB value rather
 * than to a German label — a wrong language is worse than an untranslated identifier.
 */
export const translateServiceType = (
  serviceType: string | null | undefined,
  t: Translator,
): string => {
  if (!serviceType) return "";
  const key = `service.${serviceType.toLowerCase()}`;
  return isMessageKey(key) ? t(key) : serviceType;
};

/** Translate an appointment type (besichtigung | service | follow_up | meeting | blocked). */
export const translateAppointmentType = (
  appointmentType: string | null | undefined,
  t: Translator,
  fallback: string,
): string => {
  if (!appointmentType) return fallback;
  const key = `appointmentType.${appointmentType.toLowerCase()}`;
  return isMessageKey(key) ? t(key) : fallback;
};

/**
 * Build a translator bound to one locale.
 * A key missing from the target catalog falls back to German — a customer must
 * never be shown a raw key. The key set is type-enforced in catalog.ts, so this
 * fallback only matters if a catalog is mutated at runtime.
 */
export const createTranslator = (locale: Locale): Translator => {
  const table = catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
  return (key, params) => {
    const template = table[key] ?? de[key];
    if (template === undefined) {
      console.error(`[i18n] Missing message key: ${key} (locale: ${locale})`);
      return "";
    }
    return interpolate(template, params);
  };
};

/** "14.07.2026" — numeric date in the customer's locale. */
export const formatDate = (value: string | Date, locale: Locale): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(LOCALE_TAGS[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/** "Dienstag, 14. Juli 2026" — long, weekday-first date used in appointment emails. */
export const formatDateLong = (value: string | Date, locale: Locale): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(LOCALE_TAGS[locale], {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

/** "14.07.2026, 09:30" — date plus wall-clock time. */
export const formatDateTime = (value: string | Date, locale: Locale): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(LOCALE_TAGS[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Currency is ALWAYS CHF — only the number/symbol formatting follows the locale.
 * de-CH → "CHF 1'250.00", fr-CH → "1 250.00 CHF", en-GB → "CHF 1,250.00".
 */
export const formatCurrency = (amount: number, locale: Locale): string =>
  new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

/** Plain number formatting (no currency symbol) — e.g. hourly rates inside a sentence. */
export const formatNumber = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(LOCALE_TAGS[locale]).format(value);
