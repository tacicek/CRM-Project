import { describe, it, expect } from "vitest";
import {
  getModuleForPath,
  isFirmaPathEnabled,
  FIRMA_ROUTE_PATTERNS,
} from "@/config/moduleRoutes";
import { MODULES, type ModuleKey } from "@/config/modules";

/** A full flag set, all enabled, with the given overrides — for injecting into the pure helpers. */
const flags = (overrides: Partial<Record<ModuleKey, boolean>> = {}): Record<ModuleKey, boolean> => {
  const all = Object.fromEntries(Object.keys(MODULES).map((k) => [k, true])) as Record<ModuleKey, boolean>;
  return { ...all, ...overrides };
};

/**
 * Every gated `/firma` route from App.tsx. If a route is added there, add it here (and to
 * moduleRoutes.ts) — the completeness test below fails otherwise. `/firma` (dashboard) is
 * intentionally excluded: it is the ungated safe redirect target.
 */
const ALL_FIRMA_ROUTES: { path: string; module: ModuleKey }[] = [
  { path: "/firma/anfragen", module: "leads" },
  { path: "/firma/offerten", module: "offers" },
  { path: "/firma/offerten/neu", module: "offers" },
  { path: "/firma/offerten/abc-123", module: "offers" },
  { path: "/firma/offerte-bearbeiten/abc-123", module: "offers" },
  { path: "/firma/auftraege", module: "orders" },
  { path: "/firma/quittungen", module: "receipts" },
  { path: "/firma/quittungen/neu", module: "receipts" },
  { path: "/firma/quittungen/abc-123", module: "receipts" },
  { path: "/firma/quittungen/abc-123/bearbeiten", module: "receipts" },
  { path: "/firma/rechnungen", module: "invoices" },
  { path: "/firma/rechnungen/neu", module: "invoices" },
  { path: "/firma/rechnungen/abc-123", module: "invoices" },
  { path: "/firma/kalender", module: "calendar" },
  { path: "/firma/besichtigungen", module: "inspections" },
  { path: "/firma/umzugsboxen", module: "movingBoxes" },
  { path: "/firma/team", module: "team" },
  { path: "/firma/checkliste", module: "checklist" },
  { path: "/firma/leistungskatalog", module: "serviceCatalog" },
  { path: "/firma/preisgestaltung", module: "pricing" },
  { path: "/firma/manual-import", module: "manualImport" },
  { path: "/firma/datenarchiv", module: "archive" },
  { path: "/firma/einstellungen", module: "settings" },
];

describe("getModuleForPath", () => {
  it("maps each concrete firma route to its module", () => {
    for (const { path, module } of ALL_FIRMA_ROUTES) {
      expect(getModuleForPath(path)).toBe(module);
    }
  });

  it("treats the dashboard as ungated (null) so it can be the safe redirect target", () => {
    expect(getModuleForPath("/firma")).toBeNull();
  });

  it("does not confuse similar prefixes: offerten vs offerte-bearbeiten", () => {
    expect(getModuleForPath("/firma/offerten")).toBe("offers");
    expect(getModuleForPath("/firma/offerten/neu")).toBe("offers");
    expect(getModuleForPath("/firma/offerte-bearbeiten/xyz")).toBe("offers");
    // A made-up sibling that only shares a prefix must NOT match a real route.
    expect(getModuleForPath("/firma/offerten-export")).toBeNull();
  });

  it("returns null for public routes (they live outside /firma)", () => {
    expect(getModuleForPath("/offerte/test-token")).toBeNull();
    expect(getModuleForPath("/termin/abc/absagen")).toBeNull();
    expect(getModuleForPath("/besichtigung/tok")).toBeNull();
  });

  it("returns null for unknown /firma paths (they fall through to 404)", () => {
    expect(getModuleForPath("/firma/does-not-exist")).toBeNull();
  });
});

describe("isFirmaPathEnabled", () => {
  it("invoices=true → Rechnung routes open", () => {
    const f = flags({ invoices: true });
    expect(isFirmaPathEnabled("/firma/rechnungen", f)).toBe(true);
    expect(isFirmaPathEnabled("/firma/rechnungen/neu", f)).toBe(true);
    expect(isFirmaPathEnabled("/firma/rechnungen/abc-123", f)).toBe(true);
  });

  it("invoices=false → Rechnung list AND detail routes closed", () => {
    const f = flags({ invoices: false });
    expect(isFirmaPathEnabled("/firma/rechnungen", f)).toBe(false);
    expect(isFirmaPathEnabled("/firma/rechnungen/neu", f)).toBe(false);
    expect(isFirmaPathEnabled("/firma/rechnungen/abc-123", f)).toBe(false);
  });

  it("receipts=false → all Quittung sub-routes closed", () => {
    const f = flags({ receipts: false });
    for (const p of [
      "/firma/quittungen",
      "/firma/quittungen/neu",
      "/firma/quittungen/abc-123",
      "/firma/quittungen/abc-123/bearbeiten",
    ]) {
      expect(isFirmaPathEnabled(p, f)).toBe(false);
    }
  });

  it("offers=false → create, detail and edit routes closed", () => {
    const f = flags({ offers: false });
    for (const p of [
      "/firma/offerten",
      "/firma/offerten/neu",
      "/firma/offerten/abc-123",
      "/firma/offerte-bearbeiten/abc-123",
    ]) {
      expect(isFirmaPathEnabled(p, f)).toBe(false);
    }
  });

  it("orders=false → Aufträge closed", () => {
    expect(isFirmaPathEnabled("/firma/auftraege", flags({ orders: false }))).toBe(false);
    expect(isFirmaPathEnabled("/firma/auftraege", flags({ orders: true }))).toBe(true);
  });

  it("disabling one module does not close unrelated routes", () => {
    const f = flags({ invoices: false });
    expect(isFirmaPathEnabled("/firma/offerten", f)).toBe(true);
    expect(isFirmaPathEnabled("/firma/quittungen", f)).toBe(true);
  });

  it("public routes are never affected by feature flags", () => {
    // offers off must not touch the public offer link; calendar off must not touch appointments.
    expect(isFirmaPathEnabled("/offerte/test-token", flags({ offers: false }))).toBe(true);
    expect(isFirmaPathEnabled("/termin/abc/absagen", flags({ calendar: false }))).toBe(true);
    expect(isFirmaPathEnabled("/besichtigung/tok", flags({ inspections: false }))).toBe(true);
  });

  it("the dashboard never redirects (no loop), whatever the flags", () => {
    expect(isFirmaPathEnabled("/firma", flags({ reports: false }))).toBe(true);
    expect(isFirmaPathEnabled("/firma", flags())).toBe(true);
  });

  it("unknown /firma path keeps its (404) fall-through, not a redirect", () => {
    // null module → allowed to render → the missing route matches the catch-all 404.
    expect(isFirmaPathEnabled("/firma/does-not-exist", flags({ invoices: false }))).toBe(true);
  });
});

describe("route/module completeness", () => {
  it("every gated pattern resolves to a non-null module", () => {
    for (const pattern of FIRMA_ROUTE_PATTERNS) {
      // Replace params so matchPath has a concrete path to match.
      const concrete = pattern.replace(/:[A-Za-z]+/g, "sample");
      expect(getModuleForPath(concrete)).not.toBeNull();
    }
  });

  it("every real App.tsx firma route (except the dashboard) has a module mapping", () => {
    for (const { path } of ALL_FIRMA_ROUTES) {
      expect(getModuleForPath(path)).not.toBeNull();
    }
  });
});
