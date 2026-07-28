import { describe, expect, it } from "vitest";
import { findActiveTabUrl, selectTabItems } from "@/lib/mobileNav";
import { FIRMA_QUICK_LINKS, type FirmaNavItem } from "@/config/firmaNav";

/** Alle Module an — als Proxy, damit der Test nicht bei jedem neuen Flag bricht. */
const ALL_ON: Record<string, boolean> = new Proxy(
  {},
  { get: () => true, has: () => true },
) as Record<string, boolean>;

describe("selectTabItems", () => {
  it("picks exactly the entries marked as mobileTab", () => {
    const urls = selectTabItems(FIRMA_QUICK_LINKS, ALL_ON).map((i) => i.url);
    expect(urls).toEqual([
      "/firma",
      "/firma/anfragen",
      "/firma/offerten",
      "/firma/kalender",
    ]);
  });

  it("never returns more than four — the fifth slot belongs to 'Mehr'", () => {
    expect(selectTabItems(FIRMA_QUICK_LINKS, ALL_ON).length).toBeLessThanOrEqual(4);
  });

  it("drops an entry whose module is switched off", () => {
    const off: Record<string, boolean> = new Proxy(
      {},
      { get: (_t, key) => key !== "offers" },
    ) as Record<string, boolean>;
    const urls = selectTabItems(FIRMA_QUICK_LINKS, off).map((i) => i.url);
    expect(urls).not.toContain("/firma/offerten");
    // Die uebrigen bleiben — ein abgeschaltetes Modul darf die Leiste nicht leeren.
    expect(urls).toContain("/firma");
  });

  it("keeps an entry without a moduleKey", () => {
    const item: FirmaNavItem = {
      titleKey: "nav.hilfe",
      url: "/firma/hilfe",
      icon: FIRMA_QUICK_LINKS[0].icon,
      moduleKey: null,
      mobileTab: true,
    };
    expect(selectTabItems([item], {}).map((i) => i.url)).toEqual(["/firma/hilfe"]);
  });

  it("ignores entries that are not marked", () => {
    const unmarked: FirmaNavItem = {
      titleKey: "nav.hilfe",
      url: "/firma/hilfe",
      icon: FIRMA_QUICK_LINKS[0].icon,
      moduleKey: null,
    };
    expect(selectTabItems([unmarked], ALL_ON)).toEqual([]);
  });
});

describe("findActiveTabUrl", () => {
  const tabs = ["/firma", "/firma/anfragen", "/firma/offerten", "/firma/kalender"];

  it("matches the overview only exactly", () => {
    expect(findActiveTabUrl("/firma", tabs)).toBe("/firma");
  });

  it("does not let /firma swallow every other route", () => {
    expect(findActiveTabUrl("/firma/kunden", tabs)).toBeNull();
    expect(findActiveTabUrl("/firma/einstellungen", tabs)).toBeNull();
  });

  it("marks the tab of a detail route", () => {
    expect(findActiveTabUrl("/firma/offerten/abc-123", tabs)).toBe("/firma/offerten");
    expect(findActiveTabUrl("/firma/anfragen/42", tabs)).toBe("/firma/anfragen");
  });

  it("prefers the longest matching prefix", () => {
    const withNested = [...tabs, "/firma/offerten/entwurf"];
    expect(findActiveTabUrl("/firma/offerten/entwurf/7", withNested)).toBe(
      "/firma/offerten/entwurf",
    );
  });

  it("does not match a partial path segment", () => {
    expect(findActiveTabUrl("/firma/offerten-archiv", tabs)).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(findActiveTabUrl("/auth", tabs)).toBeNull();
  });
});
