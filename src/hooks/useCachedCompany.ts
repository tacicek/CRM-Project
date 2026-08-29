import { useCompanyContext } from "@/hooks/useCompanyContext";

// Der Lese-/Schreibzugriff auf `firma_company_cache` stand bis 2026-08-28 hier
// als `getCachedCompany()` / `setCachedCompany()`. Beide sind entfernt.
//
// `getCachedCompany()` war eine ZWEITE Antwort auf "welche Firma", und eine, die
// beim Mandantenwechsel nicht nachzieht: der CompanyProvider schreibt den Cache
// erst in einem Effekt NACH dem Rendern, und dieses Schreiben loest kein Rendern
// aus. `Besichtigungen.tsx` las so lange die alte Firma weiter, bis jemand neu
// lud. Den Cache schreibt und raeumt jetzt allein der CompanyProvider; gelesen
// wird er gar nicht mehr — dafuer gibt es den Kontext.

/**
 * Legacy-compatible hook: reads from CompanyContext instead of fetching independently.
 * This ensures the companyId returned here matches the one selected in the sidebar picker.
 */
export const useCachedCompany = (_select: string = "id") => {
  const { activeCompany, companyId, loading, refresh } = useCompanyContext();

  // activeCompany ONLY contains CompanyData (id, company_name, logo_url, is_verified,
  // default_language). Wer mehr braucht (plz, iban, street, …), nimmt
  // `useCompanyRecord(select)` — es laedt GENAU den aktiven Mandanten nach.
  // Die Felder mit `as unknown as T` vorzutaeuschen (stilles undefined) ist VERBOTEN.
  return {
    company: activeCompany,
    companyId,
    loading,
    setCompany: () => refresh(),
  };
};

/**
 * Simple hook to just get the cached company ID instantly.
 */
export const useCachedCompanyId = () => {
  const { companyId } = useCompanyContext();
  return companyId;
};
