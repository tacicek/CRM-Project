import { describe, expect, it } from "vitest";
import { helpArticleForPath, WIKI_ROUTE_MAP } from "@/features/wiki/wikiRouteMap";
import { WIKI_REGISTRY } from "@/features/wiki/wikiRegistry";
import { WIKI_SLUGS } from "@/features/wiki/wikiSlugs";

describe("WIKI_ROUTE_MAP", () => {
  it("is built from the registry, so it can never name a missing article", () => {
    for (const mapping of WIKI_ROUTE_MAP) {
      expect(WIKI_SLUGS, mapping.pattern).toContain(mapping.slug);
      expect(WIKI_REGISTRY[mapping.slug].routes, mapping.pattern).toContain(mapping.pattern);
    }
  });

  it("lists every route declared in the registry", () => {
    const declared = WIKI_SLUGS.flatMap((slug) => WIKI_REGISTRY[slug].routes);
    expect(WIKI_ROUTE_MAP.map((m) => m.pattern).sort()).toEqual([...declared].sort());
  });

  it("orders more specific patterns first", () => {
    // The matcher takes the first hit, so ordering IS the resolution rule.
    const staticSegments = (pattern: string) =>
      pattern.split("/").filter((s) => s && !s.startsWith(":")).length;

    for (let i = 1; i < WIKI_ROUTE_MAP.length; i += 1) {
      expect(
        staticSegments(WIKI_ROUTE_MAP[i - 1].pattern),
        `${WIKI_ROUTE_MAP[i - 1].pattern} before ${WIKI_ROUTE_MAP[i].pattern}`,
      ).toBeGreaterThanOrEqual(staticSegments(WIKI_ROUTE_MAP[i].pattern));
    }
  });
});

describe("helpArticleForPath", () => {
  it("resolves exact routes", () => {
    expect(helpArticleForPath("/firma")).toBe("dashboard-uebersicht");
    expect(helpArticleForPath("/auth")).toBe("anmelden-abmelden");
    expect(helpArticleForPath("/auth/reset-password")).toBe("anmelden-abmelden");
  });

  it("does not match a longer path against a shorter pattern", () => {
    // `end: true` matters: without it "/firma" would swallow every /firma/* route and
    // the header would offer the dashboard article on every single screen.
    //
    // Deliberately uses routes that are NOT documented, so this keeps testing the
    // matcher rather than the current content. As articles get written, swap these for
    // routes still listed in ROUTES_DEFERRED.
    expect(helpArticleForPath("/firma/quittungen")).toBeNull();
    expect(helpArticleForPath("/firma/team")).toBeNull();
  });

  it("matches a documented detail route through its :id segment", () => {
    // The header help button must work on detail screens, not only on list screens.
    expect(helpArticleForPath("/firma/kunden/e0000000-0000-4000-a000-000000000001")).toBe("kundenkarte");
    expect(helpArticleForPath("/firma/rechnungen/abc-123")).toBe("rechnung-erstellen");
    // …but the list route itself must still resolve to the list article.
    expect(helpArticleForPath("/firma/kunden")).toBe("kunden-liste");
    expect(helpArticleForPath("/firma/rechnungen")).toBe("rechnungen-liste");
    // …and the more specific literal wins over the :id pattern.
    expect(helpArticleForPath("/firma/rechnungen/neu")).toBe("rechnung-erstellen");
  });

  it("returns null for an undocumented screen rather than guessing", () => {
    expect(helpArticleForPath("/firma/nonexistent")).toBeNull();
    expect(helpArticleForPath("/")).toBeNull();
    expect(helpArticleForPath("")).toBeNull();
  });

  it("ignores a trailing slash the way the router does", () => {
    expect(helpArticleForPath("/firma/")).toBe("dashboard-uebersicht");
  });

  it("matches case-insensitively, exactly as the router does", () => {
    // `matchPath` defaults to caseSensitive: false, and the app's own <Route> elements
    // inherit that same default. Making the help lookup stricter than the router would
    // mean a URL that renders the dashboard offers no help for it.
    expect(helpArticleForPath("/FIRMA")).toBe("dashboard-uebersicht");
  });
});
