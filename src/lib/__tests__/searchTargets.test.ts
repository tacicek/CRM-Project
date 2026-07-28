import { describe, expect, it } from "vitest";
import { buildNavTargets, filterTargets } from "@/lib/searchTargets";
import { FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS } from "@/config/firmaNav";

const ALL_ON: Record<string, boolean> = new Proxy({}, { get: () => true }) as Record<
  string,
  boolean
>;

/** Uebersetzt einen Schluessel auf sein letztes Segment — reicht zum Filtern im Test. */
const translate = (key: string) => key.split(".").pop() ?? key;

describe("buildNavTargets", () => {
  it("contains every visible destination exactly once", () => {
    const targets = buildNavTargets(FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, ALL_ON);
    const urls = targets.map((target) => target.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("includes destinations that have no mobile tab", () => {
    const urls = buildNavTargets(FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, ALL_ON).map((t) => t.url);
    expect(urls).toContain("/firma/email-import");
    expect(urls).toContain("/firma/hilfe");
  });

  it("drops destinations whose module is off", () => {
    const off: Record<string, boolean> = new Proxy(
      {},
      { get: (_target, key) => key !== "offers" },
    ) as Record<string, boolean>;
    const urls = buildNavTargets(FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, off).map((t) => t.url);
    expect(urls).not.toContain("/firma/offerten");
    expect(urls).toContain("/firma");
  });

  it("keeps an entry without a moduleKey even when nothing is enabled", () => {
    const nothing: Record<string, boolean> = new Proxy({}, { get: () => false }) as Record<
      string,
      boolean
    >;
    const urls = buildNavTargets(FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, nothing).map((t) => t.url);
    expect(urls).toEqual(["/firma/hilfe"]);
  });
});

describe("filterTargets", () => {
  const targets = buildNavTargets(FIRMA_NAV_GROUPS, FIRMA_QUICK_LINKS, ALL_ON);

  it("returns everything for an empty query", () => {
    expect(filterTargets(targets, "", translate)).toHaveLength(targets.length);
  });

  it("ignores case and surrounding whitespace", () => {
    const spaced = filterTargets(targets, "  KUNDEN ", translate);
    const plain = filterTargets(targets, "kunden", translate);
    expect(spaced).toEqual(plain);
    expect(spaced.length).toBeGreaterThan(0);
  });

  it("returns nothing for a query that matches no label", () => {
    expect(filterTargets(targets, "zzzznichts", translate)).toEqual([]);
  });

  it("does not mutate the input", () => {
    const before = [...targets];
    filterTargets(targets, "kunden", translate);
    expect(targets).toEqual(before);
  });
});
