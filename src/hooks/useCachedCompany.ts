import { useCompanyContext } from "@/hooks/useCompanyContext";

const COMPANY_CACHE_KEY = "firma_company_cache";

interface CachedCompanyData {
  id: string;
  company_name?: string;
  token_balance?: number;
  logo_url?: string | null;
  crm_enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Legacy cache helpers — kept for backwards compatibility
// ---------------------------------------------------------------------------

export const getCachedCompany = (): CachedCompanyData | null => {
  try {
    const cached = sessionStorage.getItem(COMPANY_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  return null;
};

export const setCachedCompany = (company: CachedCompanyData | null) => {
  try {
    if (company) {
      const existingCache = getCachedCompany();
      const mergedData = existingCache
        ? { ...existingCache, ...company }
        : company;
      sessionStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(mergedData));
    } else {
      sessionStorage.removeItem(COMPANY_CACHE_KEY);
    }
  } catch { /* ignore */ }
};

/**
 * Legacy-compatible hook: reads from CompanyContext instead of fetching independently.
 * This ensures the companyId returned here matches the one selected in the sidebar picker.
 */
export const useCachedCompany = (_select: string = "id") => {
  const { activeCompany, companyId, loading, refresh } = useCompanyContext();

  // activeCompany ONLY contains CompanyData (id, company_name, logo_url, is_verified).
  // If more fields (plz, iban, street, ...) are needed, fetch fresh via fetchSingleCompanyForUser
  // — faking their presence with `as unknown as T` (silent undefined) is FORBIDDEN.
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
