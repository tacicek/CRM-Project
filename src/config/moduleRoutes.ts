import { matchPath } from "react-router-dom";
import { MODULES, type ModuleKey } from "@/config/modules";

/**
 * Single source of truth mapping each gated `/firma` route to the feature-flag module
 * that controls it. Consumed by:
 *   - the route guard ([FirmaModuleGuard]) — closes disabled routes to direct URLs,
 *   - the sidebar ([FirmaLayout]) — hides nav items whose module is disabled,
 *   - unit tests — completeness and prefix-matching guarantees.
 *
 * This is NOT an authorization layer. Data access is enforced by Supabase Auth + RLS;
 * feature flags only shape navigation/UX and must never be relied on for security.
 *
 * `/firma` (the dashboard) is deliberately absent: it is the always-available safe
 * redirect target, so a disabled module can send the user there without a loop. The
 * `reports` flag is a dashboard *content* flag (it hides stats), not a route flag.
 * `contacts` and `integrations` have no route today (future modules — see modules.ts).
 */
type FirmaRouteModule = { pattern: string; module: ModuleKey };

const FIRMA_ROUTE_MODULES: readonly FirmaRouteModule[] = [
  { pattern: "/firma/anfragen", module: "leads" },
  { pattern: "/firma/offerten", module: "offers" },
  { pattern: "/firma/offerten/neu", module: "offers" },
  { pattern: "/firma/offerten/:id", module: "offers" },
  { pattern: "/firma/offerte-bearbeiten/:offerId", module: "offers" },
  { pattern: "/firma/auftraege", module: "orders" },
  { pattern: "/firma/quittungen", module: "receipts" },
  { pattern: "/firma/quittungen/neu", module: "receipts" },
  { pattern: "/firma/quittungen/:id", module: "receipts" },
  { pattern: "/firma/quittungen/:id/bearbeiten", module: "receipts" },
  { pattern: "/firma/rechnungen", module: "invoices" },
  { pattern: "/firma/rechnungen/neu", module: "invoices" },
  { pattern: "/firma/rechnungen/:id", module: "invoices" },
  { pattern: "/firma/kalender", module: "calendar" },
  { pattern: "/firma/besichtigungen", module: "inspections" },
  { pattern: "/firma/umzugsboxen", module: "movingBoxes" },
  { pattern: "/firma/team", module: "team" },
  { pattern: "/firma/checkliste", module: "checklist" },
  { pattern: "/firma/leistungskatalog", module: "serviceCatalog" },
  { pattern: "/firma/preisgestaltung", module: "pricing" },
  { pattern: "/firma/manual-import", module: "manualImport" },
  { pattern: "/firma/datenarchiv", module: "archive" },
  { pattern: "/firma/einstellungen", module: "settings" },
];

/**
 * The module gating a pathname, or `null` for ungated paths — the dashboard (`/firma`),
 * public routes, and unknown paths (which fall through to the 404 route). Uses React
 * Router's `matchPath` with `end: true`, so `/firma/offerten` never swallows
 * `/firma/offerten/neu` and `/firma/offerte-bearbeiten/:id` is never confused with it.
 */
export function getModuleForPath(pathname: string): ModuleKey | null {
  const hit = FIRMA_ROUTE_MODULES.find((r) => matchPath({ path: r.pattern, end: true }, pathname));
  return hit ? hit.module : null;
}

/** Whether a feature-flag module is enabled. `modules` is injectable for tests. */
export function isModuleEnabled(
  module: ModuleKey,
  modules: Record<ModuleKey, boolean> = MODULES,
): boolean {
  return modules[module];
}

/**
 * True when a `/firma` pathname may render: it is ungated (dashboard / unknown) or its
 * module is enabled. `modules` is injectable so the logic can be unit-tested without
 * mutating the real flags.
 */
export function isFirmaPathEnabled(
  pathname: string,
  modules: Record<ModuleKey, boolean> = MODULES,
): boolean {
  const module = getModuleForPath(pathname);
  return module === null || modules[module];
}

/** Canonical list of gated route patterns — used by the completeness test. */
export const FIRMA_ROUTE_PATTERNS: readonly string[] = FIRMA_ROUTE_MODULES.map((r) => r.pattern);
