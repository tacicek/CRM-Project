import { useEffect, useState, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { checkCrmAccess } from "@/lib/crmAccess";

const COMPANY_CACHE_KEY = "firma_company_cache";

interface CachedCompany {
  crm_enabled?: boolean | null;
  subscription_type?: string | null;
  subscription_expires_at?: string | null;
}

const getCachedCompany = (): CachedCompany | null => {
  try {
    const raw = sessionStorage.getItem(COMPANY_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

interface CrmGuardProps {
  children: ReactNode;
}

/**
 * Route-level guard for CRM-only pages.
 * Redirects to /firma/crm-upgrade if the company does not have active CRM or trial access.
 */
const CrmGuard = ({ children }: CrmGuardProps) => {
  const { user, isLoading: authLoading } = useAuth();

  const cached = getCachedCompany();
  const [accessState, setAccessState] = useState<"loading" | "allowed" | "denied">(
    cached ? (checkCrmAccess(cached) ? "allowed" : "denied") : "loading"
  );

  useEffect(() => {
    if (accessState !== "loading") return;
    if (authLoading || !user) return;

    const fetch = async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("crm_enabled, subscription_type, subscription_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        setAccessState("denied");
        return;
      }
      setAccessState(checkCrmAccess(data) ? "allowed" : "denied");
    };

    fetch();
  }, [user, authLoading, accessState]);

  if (accessState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accessState === "denied") {
    return <Navigate to="/firma/crm-upgrade" replace />;
  }

  return <>{children}</>;
};

export default CrmGuard;
