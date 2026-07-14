import { de, enGB, fr } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";
import { LOCALE_TAGS, type Locale } from "@/i18n/locale";

/**
 * Locale-driven formatting.
 *
 * Before i18n every call site hardcoded `de-CH` / `locale: de`. Money and dates on
 * a French offer must read French — "1'234.50" and "15 janvier 2026", not
 * "15. Januar 2026" — so every formatter takes the locale explicitly.
 *
 * Currency stays CHF in all three languages: the company invoices in Swiss francs
 * regardless of which language the customer reads. Only the *formatting* (grouping
 * separator, symbol placement) follows the locale.
 */

const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { de, fr, en: enGB };

/** date-fns locale object for `format(date, pattern, { locale: getDateFnsLocale(l) })`. */
export const getDateFnsLocale = (locale: Locale): DateFnsLocale => DATE_FNS_LOCALES[locale];

const toDate = (value: Date | string | number): Date =>
  value instanceof Date ? value : new Date(value);

/** 15.01.2026 · 15/01/2026 · 15/01/2026 */
export const formatDate = (value: Date | string | number, locale: Locale): string =>
  new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(toDate(value));

/** 15. Januar 2026 · 15 janvier 2026 · 15 January 2026 */
export const formatDateLong = (value: Date | string | number, locale: Locale): string =>
  new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDate(value));

export const formatDateTime = (value: Date | string | number, locale: Locale): string =>
  new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(value));

/**
 * CHF 1'234.50 — the amount is always Swiss francs; the locale only shapes the
 * grouping and symbol position.
 */
export const formatCurrency = (amount: number, locale: Locale): string =>
  new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: "currency",
    currency: "CHF",
  }).format(amount);

/** Bare amount without the CHF symbol — for table columns that carry it in the header. */
export const formatAmount = (amount: number, locale: Locale): string =>
  new Intl.NumberFormat(LOCALE_TAGS[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export const formatNumber = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(LOCALE_TAGS[locale]).format(value);

/** 7.7 % — VAT rate. */
export const formatPercent = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(LOCALE_TAGS[locale], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
