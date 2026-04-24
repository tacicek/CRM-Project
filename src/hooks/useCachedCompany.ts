import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";

const COMPANY_CACHE_KEY = "firma_company_cache";

interface CachedCompanyData {
  id: string;
  company_name?: string;
  token_balance?: number;
  logo_url?: string | null;
  manual_import_enabled?: boolean;
  crm_enabled?: boolean;
  subscription_type?: string;
  subscription_expires_at?: string | null;
}

// Get cached company data
export const getCachedCompany = (): CachedCompanyData | null => {
  try {
    const cached = sessionStorage.getItem(COMPANY_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore cache errors
  }
  return null;
};

// Set cached company data
// Merges new data with existing cache to prevent losing fields like crm_enabled
// when a page only selects partial data (e.g., just "id")
export const setCachedCompany = (company: CachedCompanyData | null) => {
  try {
    if (company) {
      // Get existing cache and merge with new data
      // This prevents losing fields when a page only fetches partial data
      const existingCache = getCachedCompany();
      const mergedData = existingCache 
        ? { ...existingCache, ...company }
        : company;
      sessionStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(mergedData));
    } else {
      sessionStorage.removeItem(COMPANY_CACHE_KEY);
    }
  } catch {
    // Ignore cache errors
  }
};

/**
 * Hook to get company data with caching for instant page transitions.
 * Uses sessionStorage cache to avoid loading delays between page navigations.
 */
export const useCachedCompany = <T extends CachedCompanyData>(
  select: string = "id"
) => {
  const { user } = useAuth();

  const [company, setCompany] = useState<T | null>(() => {
    return getCachedCompany() as T | null;
  });
  const [loading, setLoading] = useState(() => !getCachedCompany());

  const fetchCompany = useCallback(async () => {
    if (!user) return;
    
    try {
      const data = await fetchSingleCompanyForUser<T>({
        userId: user.id,
        userEmail: user.email,
        select,
      });
      
      if (data) {
        setCompany(data);
        setCachedCompany(data);
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    } finally {
      setLoading(false);
    }
  }, [user, select]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  return {
    company,
    companyId: company?.id || null,
    loading,
    setCompany,
  };
};

/**
 * Simple hook to just get the cached company ID instantly.
 * Use this when you only need the company ID and don't want to trigger a fetch.
 */
export const useCachedCompanyId = () => {
  const cachedCompany = getCachedCompany();
  return cachedCompany?.id || null;
};

