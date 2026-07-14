import { toLocale, type Locale } from "@/i18n/locale";
import { createTranslator, type Translator } from "@/i18n/translator";
import { getDateFnsLocale } from "@/i18n/format";

/**
 * The customer's language, read off the document itself.
 *
 * Every customer-facing artefact (offer, invoice, receipt, work order, e-mail,
 * public page) carries a `language` column that was frozen from the lead. This is
 * the ONLY correct source for those renderers — never the dashboard locale.
 *
 * The company default is the fallback for rows that predate the column or arrive
 * without a language (e.g. an import that didn't set one).
 */

interface HasLanguage {
  language?: string | null;
}

interface HasDefaultLanguage {
  default_language?: string | null;
}

export const resolveDocumentLocale = (
  row: HasLanguage | null | undefined,
  company?: HasDefaultLanguage | null
): Locale => {
  if (row?.language) return toLocale(row.language);
  if (company?.default_language) return toLocale(company.default_language);
  return toLocale(undefined);
};

/**
 * Everything a renderer needs to produce a document in the customer's language:
 * the translator, the locale tag and the date-fns locale, in one object.
 */
export interface DocumentI18n {
  locale: Locale;
  t: Translator;
  dateLocale: ReturnType<typeof getDateFnsLocale>;
}

export const createDocumentI18n = (
  row: HasLanguage | null | undefined,
  company?: HasDefaultLanguage | null
): DocumentI18n => {
  const locale = resolveDocumentLocale(row, company);
  return {
    locale,
    t: createTranslator(locale),
    dateLocale: getDateFnsLocale(locale),
  };
};

/** When the locale is already known (e.g. passed down as a prop into a PDF subtree). */
export const documentI18nFor = (locale: Locale): DocumentI18n => ({
  locale,
  t: createTranslator(locale),
  dateLocale: getDateFnsLocale(locale),
});
