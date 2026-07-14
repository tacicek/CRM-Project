import {
  formatCurrency as formatCurrencyForLocale,
  formatDate as formatDateForLocale,
  formatDateLong as formatDateLongForLocale,
  formatNumber,
} from "@/i18n/format";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { createTranslator } from "@/i18n/translator";

/**
 * PDF-side formatting wrappers.
 *
 * They add exactly two things on top of @/i18n/format: the "-" placeholder for a missing
 * date (a PDF cell must not stay blank) and the Swiss round-franc notation. Everything
 * else — grouping separators, month names, currency placement — comes from the locale,
 * which is always the CUSTOMER's (OfferData.locale), never the operator's.
 */

/**
 * `locale` defaults to German ONLY for the one legacy dashboard caller
 * (components/offerte/SurchargeEditor.tsx, which renders in the operator's UI and is not
 * part of the document layer). Every PDF renderer passes the customer's locale explicitly.
 */
export const formatCurrency = (amount: number, locale: Locale = DEFAULT_LOCALE): string =>
  formatCurrencyForLocale(Number.isFinite(amount) ? amount : 0, locale);

/**
 * Swiss round-franc notation: whole amounts print as "CHF 280.–" instead of "CHF 280.00";
 * anything with rappen falls back to the full currency format.
 */
export const formatRoundedCurrency = (value: number, locale: Locale): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return formatCurrency(0, locale);
  return Number.isInteger(n) ? `CHF ${formatNumber(n, locale)}.–` : formatCurrency(n, locale);
};

/** Bare number for m²/m³ measures and hour counts — no currency, locale grouping. */
export const formatMeasure = (value: number, locale: Locale): string =>
  formatNumber(Number(value), locale);

export const formatDate = (dateString: string | undefined, locale: Locale): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDateForLocale(date, locale);
};

/**
 * Date in words ("14. April 2026" / "14 avril 2026" / "14 April 2026").
 * Required by SN 010 130 (Briefversand) for the letter layout.
 */
export const formatDateLong = (dateString: string | undefined, locale: Locale): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDateLongForLocale(date, locale);
};

export const formatTime = (minutes: number | undefined, locale: Locale): string | undefined => {
  if (!minutes && minutes !== 0) return undefined;
  const t = createTranslator(locale);
  return t("doc.time.hoursMinutes", {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
};
