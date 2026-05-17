import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanyData {
  id: string;
  company_name: string;
  logo_url: string | null;
  is_verified: boolean | null;
}

interface CompanyContextType {
  /** List of all companies the user belongs to */
  companies: CompanyData[];
  /** The currently active company */
  activeCompany: CompanyData | null;
  /** The ID of the active company */
  companyId: string | null;
  /** The user's role in the active company */
  role: string | null;
  /** True if fetching companies is in progress */
  loading: boolean;
  /** Switch to a different company */
  switchCompany: (companyId: string) => void;
  /** Force re-fetch companies */
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const ACTIVE_COMPANY_KEY = "crm_active_company_id";

const getActiveCompanyId = (): string | null => {
  try {
    return sessionStorage.getItem(ACTIVE_COMPANY_KEY);
  } catch {
    return null;
  }
};

const setActiveCompanyId = (id: string) => {
  try {
    sessionStorage.setItem(ACTIVE_COMPANY_KEY, id);
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const CompanyProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [memberships, setMemberships] = useState<Map<string, string>>(new Map());
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(
    getActiveCompanyId()
  );
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("company_members")
        .select(`company_id, role, companies!inner(id, company_name, logo_url, is_verified)`)
        .eq("user_id", user.id);

      if (error) throw error;

      const rows = (data ?? []) as unknown as Array<{
        company_id: string;
        role: string;
        companies: CompanyData;
      }>;

      const fetchedCompanies = rows.map((r) => r.companies);
      const roleMap = new Map<string, string>();
      rows.forEach((r) => roleMap.set(r.company_id, r.role));

      setCompanies(fetchedCompanies);
      setMemberships(roleMap);

      // Auto-select: restore from cache if available, otherwise pick first
      const cachedId = getActiveCompanyId();
      const cached = fetchedCompanies.find((c) => c.id === cachedId);
      if (cached) {
        setActiveCompanyIdState(cached.id);
        setActiveCompanyId(cached.id);
      } else if (fetchedCompanies.length > 0) {
        setActiveCompanyIdState(fetchedCompanies[0].id);
        setActiveCompanyId(fetchedCompanies[0].id);
      }
    } catch (err) {
      console.error("[CompanyProvider] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Preload all companies into sessionStorage cache so child hooks get instant data
  useEffect(() => {
    const active = companies.find((c) => c.id === activeCompanyId) ?? null;
    if (active) {
      try {
        sessionStorage.setItem("firma_company_cache", JSON.stringify(active));
      } catch {
        /* ignore */
      }
    }
  }, [companies, activeCompanyId]);

  const switchCompany = useCallback(
    (companyId: string) => {
      if (companies.some((c) => c.id === companyId)) {
        setActiveCompanyIdState(companyId);
        setActiveCompanyId(companyId);
      }
    },
    [companies]
  );

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;
  const role = activeCompany ? (memberships.get(activeCompany.id) ?? null) : null;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        companyId: activeCompanyId,
        role,
        loading,
        switchCompany,
        refresh: fetchCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useCompanyContext = (): CompanyContextType => {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompanyContext must be used inside <CompanyProvider>");
  }
  return ctx;
};

/**
 * Convenience hook: just get the active company + role.
 * Drop-in replacement for the old useCachedCompany() in most cases.
 */
export const useActiveCompany = () => {
  const { activeCompany, companyId, role, loading } = useCompanyContext();
  return {
    company: activeCompany,
    companyId,
    role,
    loading,
  };
};
