import { createContext, useContext } from "react";

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

// CompanyContext wird vom CompanyProvider (siehe hooks/CompanyProvider.tsx) befüllt.
// Getrennt gehalten, damit diese Datei nur Non-Component-Exports hat (Fast-Refresh).
export const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

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
