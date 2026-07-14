import { createContext, useContext } from "react";
import type { Locale as DateFnsLocale } from "date-fns";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { createTranslator, type Translator } from "@/i18n/translator";
import { getDateFnsLocale } from "@/i18n/format";

/**
 * Dashboard locale — the language the OPERATOR works in.
 *
 * Context + hooks only, no component: keeps Fast Refresh working, same split as
 * useCompanyContext.tsx / CompanyProvider.tsx. The provider lives in I18nProvider.tsx.
 *
 * This context must NOT reach customer-facing renderers. A PDF or an e-mail is written
 * in the CUSTOMER's language, which is stored on the document row — see
 * `createDocumentI18n` in src/i18n/documentLocale.ts. Reading the dashboard locale in a
 * PDF would send a German operator's language to a French customer.
 */

export interface I18nContextValue {
  /** Active dashboard locale. */
  locale: Locale;
  /** Translate a key in the dashboard locale. */
  t: Translator;
  /** date-fns locale object for `format(…, { locale })`. */
  dateLocale: DateFnsLocale;
  /** The company-wide default, before any personal override. */
  companyLocale: Locale;
  /** Personal override, or null when following the company default. */
  override: Locale | null;
  /** Set (or clear, with null) the personal override. */
  setOverride: (locale: Locale | null) => void;
}

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/**
 * Falls back to a German translator when used outside the provider instead of throwing:
 * some shared primitives (date-picker, toasts, error boundaries) render on both the
 * dashboard and the public pages, and a hard throw there would replace a readable page
 * with a blank one.
 */
export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    t: createTranslator(DEFAULT_LOCALE),
    dateLocale: getDateFnsLocale(DEFAULT_LOCALE),
    companyLocale: DEFAULT_LOCALE,
    override: null,
    setOverride: () => {},
  };
};

/** Shorthand for the common case: `const t = useT();` */
export const useT = (): Translator => useI18n().t;
