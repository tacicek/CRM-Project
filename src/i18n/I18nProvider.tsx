import React, { useCallback, useMemo, useState } from "react";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { isLocale, toLocale, type Locale } from "@/i18n/locale";
import { createTranslator } from "@/i18n/translator";
import { getDateFnsLocale } from "@/i18n/format";
import { I18nContext, type I18nContextValue } from "@/i18n/useI18n";

/**
 * Provides the DASHBOARD locale to everything under /firma/*.
 *
 * Source of truth is `companies.default_language`, which the company sets in
 * Einstellungen. A user may additionally override it for their own browser (a
 * French-speaking employee at a German-speaking company); that override lives in
 * localStorage and never leaves the device.
 *
 * Context and hooks live in useI18n.ts — this file exports only the component, so Fast
 * Refresh keeps working (same split as CompanyProvider / useCompanyContext).
 */

const OVERRIDE_KEY = "crm_ui_locale";

const readOverride = (): Locale | null => {
  try {
    const stored = localStorage.getItem(OVERRIDE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
};

const writeOverride = (locale: Locale | null) => {
  try {
    if (locale) localStorage.setItem(OVERRIDE_KEY, locale);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* private mode — the company default still applies */
  }
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const { activeCompany } = useCompanyContext();
  const [override, setOverrideState] = useState<Locale | null>(readOverride);

  const companyLocale = toLocale(activeCompany?.default_language);
  const locale = override ?? companyLocale;

  const setOverride = useCallback((next: Locale | null) => {
    writeOverride(next);
    setOverrideState(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: createTranslator(locale),
      dateLocale: getDateFnsLocale(locale),
      companyLocale,
      override,
      setOverride,
    }),
    [locale, companyLocale, override, setOverride]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
