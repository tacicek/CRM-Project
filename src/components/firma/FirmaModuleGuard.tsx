import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isFirmaPathEnabled } from "@/config/moduleRoutes";

/**
 * Route-level feature-flag guard for `/firma/*`.
 *
 * Sits between [FirmaLayout] and the routed page ([Outlet]). If the current pathname
 * belongs to a disabled module it redirects to the dashboard (`/firma`) — the always-on
 * safe target, so there is never a redirect loop. Enabled and ungated paths (the
 * dashboard itself, unknown paths that fall through to 404) render normally.
 *
 * This is a UX/navigation control only, NOT authorization — data access stays enforced by
 * Supabase Auth + RLS. It is mounted inside the CRM layout, so public token routes (which
 * live outside that layout) are never affected.
 */
export const FirmaModuleGuard = () => {
  const { pathname } = useLocation();

  if (!isFirmaPathEnabled(pathname)) {
    return <Navigate to="/firma" replace />;
  }

  return <Outlet />;
};

export default FirmaModuleGuard;
