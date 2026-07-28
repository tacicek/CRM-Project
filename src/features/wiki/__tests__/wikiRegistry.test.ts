import { describe, expect, it } from "vitest";
import { MODULES, type ModuleKey } from "@/config/modules";
import {
  articlesByCategory,
  prevNextFor,
  visibleArticles,
  WIKI_REGISTRY,
} from "@/features/wiki/wikiRegistry";
import { WIKI_SLUGS } from "@/features/wiki/wikiSlugs";
import { WIKI_CATEGORIES } from "@/features/wiki/wikiTypes";

const allOn = MODULES as Readonly<Record<ModuleKey, boolean>>;
const withOff = (key: ModuleKey): Readonly<Record<ModuleKey, boolean>> => ({ ...allOn, [key]: false });

describe("visibleArticles", () => {
  it("shows every article when all modules are on", () => {
    expect(visibleArticles(allOn).map((a) => a.slug).sort()).toEqual([...WIKI_SLUGS].sort());
  });

  it("hides an article whose module is switched off", () => {
    // dashboard-uebersicht is tied to `reports`, which is what hides the dashboard stats.
    const visible = visibleArticles(withOff("reports")).map((a) => a.slug);
    expect(visible).not.toContain("dashboard-uebersicht");
  });

  it("never hides an article that has no module", () => {
    // `moduleKey: null` exists so the help centre stays reachable even when every
    // feature flag is off. Turning modules off must not strand the reader.
    const everythingOff = Object.fromEntries(
      Object.keys(MODULES).map((key) => [key, false]),
    ) as Readonly<Record<ModuleKey, boolean>>;

    const visible = visibleArticles(everythingOff).map((a) => a.slug);
    const moduleless = WIKI_SLUGS.filter((slug) => WIKI_REGISTRY[slug].moduleKey === null);

    expect(moduleless.length).toBeGreaterThan(0);
    for (const slug of moduleless) expect(visible, slug).toContain(slug);
  });
});

describe("articlesByCategory", () => {
  it("returns categories in the declared order", () => {
    const categories = articlesByCategory(allOn).map((g) => g.category);
    const expectedOrder = WIKI_CATEGORIES.filter((c) => categories.includes(c));
    expect(categories).toEqual([...expectedOrder]);
  });

  it("omits a category that has no visible articles", () => {
    // Asserted as an invariant, not as a snapshot of which categories happen to be
    // written: every returned group must be non-empty, and no category that has articles
    // may be missing. Listing the current categories here would make this test fail every
    // time content is added, which says nothing about the grouping logic.
    const groups = articlesByCategory(allOn);
    for (const group of groups) {
      expect(group.articles.length, `category "${group.category}"`).toBeGreaterThan(0);
    }

    const withArticles = new Set(visibleArticles(allOn).map((a) => a.category));
    expect(new Set(groups.map((g) => g.category))).toEqual(withArticles);
  });

  it("places every visible article in exactly one category", () => {
    const flattened = articlesByCategory(allOn).flatMap((g) => g.articles.map((a) => a.slug));
    expect(new Set(flattened).size).toBe(flattened.length);
    expect(flattened.sort()).toEqual(visibleArticles(allOn).map((a) => a.slug).sort());
  });
});

describe("prevNextFor", () => {
  it("walks forwards and backwards through a category", () => {
    const start = articlesByCategory(allOn)[0].articles;
    expect(start.length).toBeGreaterThan(2);

    const middle = start[1].slug;
    expect(prevNextFor(middle, allOn).prev?.slug).toBe(start[0].slug);
    expect(prevNextFor(middle, allOn).next?.slug).toBe(start[2].slug);
  });

  it("stops at both ends instead of wrapping", () => {
    // Wrapping would suggest the guides form a loop. They do not.
    const start = articlesByCategory(allOn)[0].articles;
    expect(prevNextFor(start[0].slug, allOn).prev).toBeNull();
    expect(prevNextFor(start[start.length - 1].slug, allOn).next).toBeNull();
  });

  it("returns no neighbours for an article hidden by its module", () => {
    const flags = withOff("reports");
    expect(prevNextFor("dashboard-uebersicht", flags)).toEqual({ prev: null, next: null });
  });

  it("skips hidden articles when linking neighbours", () => {
    const flags = withOff("reports");
    for (const slug of WIKI_SLUGS) {
      const { prev, next } = prevNextFor(slug, flags);
      expect(prev?.slug, `${slug}.prev`).not.toBe("dashboard-uebersicht");
      expect(next?.slug, `${slug}.next`).not.toBe("dashboard-uebersicht");
    }
  });
});
