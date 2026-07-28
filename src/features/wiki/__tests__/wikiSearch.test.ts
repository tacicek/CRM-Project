import { describe, expect, it } from "vitest";
import { normalizeForSearch, searchWiki, synonymsFor, tokenize } from "@/features/wiki/wikiSearch";
import { WIKI_SLUGS, type WikiSlug } from "@/features/wiki/wikiSlugs";
import type { WikiSearchIndex } from "@/features/wiki/wikiTypes";

const ALL: readonly WikiSlug[] = WIKI_SLUGS;

/**
 * A tiny hand-built index, so ranking is asserted against known values rather than
 * against real content that will keep changing.
 *
 * Only the entries a test actually reasons about are spelled out; every other slug gets
 * a neutral filler. Listing all of them by hand would mean this ranking test breaks
 * every time an article is added, which tells you nothing about search.
 */
const OVERRIDES: Partial<Record<WikiSlug, WikiSearchIndex[WikiSlug]>> = {
  "start-hier": { title: "Hier starten", summary: "Der Einstieg.", keywords: ["start", "beginn"] },
  "anmelden-abmelden": {
    title: "Anmelden und abmelden",
    summary: "Anmeldung und Passwort.",
    keywords: ["login", "passwort", "zugang"],
  },
  "dashboard-uebersicht": {
    title: "Die Übersicht",
    summary: "Ihre Startseite mit Kacheln.",
    keywords: ["dashboard", "startseite"],
  },
  "rollen-und-rechte": {
    title: "Rollen und Rechte",
    summary: "Wer darf was.",
    keywords: ["rolle", "rechte", "inhaber"],
  },
};

const index: WikiSearchIndex = Object.fromEntries(
  WIKI_SLUGS.map((slug) => [
    slug,
    OVERRIDES[slug] ?? { title: `Platzhalter ${slug}`, summary: "Fuellwert.", keywords: ["zzzfiller"] },
  ]),
) as WikiSearchIndex;

describe("normalizeForSearch", () => {
  it("folds German umlauts BOTH ways", () => {
    // A German typist writes "Rueckgabe" as often as "Rückgabe"; stripping the diaeresis
    // alone would only produce "Ruckgabe" and lose the transliterated spelling.
    expect(normalizeForSearch("Rückgabe")).toBe("rueckgabe");
    expect(normalizeForSearch("Rueckgabe")).toBe("rueckgabe");
    expect(normalizeForSearch("Übersicht")).toBe("uebersicht");
    expect(normalizeForSearch("Straße")).toBe("strasse");
    expect(normalizeForSearch("Strasse")).toBe("strasse");
  });

  it("strips French accents", () => {
    expect(normalizeForSearch("créé")).toBe("cree");
    expect(normalizeForSearch("cree")).toBe("cree");
    expect(normalizeForSearch("Déménagement")).toBe("demenagement");
    expect(normalizeForSearch("À côté")).toBe("a cote");
  });

  it("lowercases and collapses punctuation to single spaces", () => {
    expect(normalizeForSearch("Vue  d'ensemble!")).toBe("vue d ensemble");
    expect(normalizeForSearch("E-Mail-Eingang")).toBe("e mail eingang");
  });
});

describe("tokenize", () => {
  it("drops single characters as noise", () => {
    expect(tokenize("a bc d ef")).toEqual(["bc", "ef"]);
  });

  it("returns nothing for an empty or punctuation-only query", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize("!!!")).toEqual([]);
  });
});

describe("synonymsFor", () => {
  it("links the words operators actually use interchangeably", () => {
    expect(synonymsFor("angebot")).toContain("offerte");
    expect(synonymsFor("offerte")).toContain("angebot");
    expect(synonymsFor("aufgabe")).toContain("wiedervorlage");
    expect(synonymsFor("invoice")).toContain("rechnung");
    expect(synonymsFor("facture")).toContain("rechnung");
    expect(synonymsFor("paiement")).toContain("zahlung");
    expect(synonymsFor("client")).toContain("kunde");
  });

  it("never lists a word as its own synonym", () => {
    expect(synonymsFor("offerte")).not.toContain("offerte");
  });

  it("returns an empty list for an unknown word", () => {
    expect(synonymsFor("zzzz")).toEqual([]);
  });
});

describe("searchWiki", () => {
  it("returns nothing for an empty query", () => {
    expect(searchWiki("", index, ALL)).toEqual([]);
    expect(searchWiki("   ", index, ALL)).toEqual([]);
  });

  it("ranks a title match above a keyword-only match", () => {
    const results = searchWiki("rollen", index, ALL);
    expect(results[0].slug).toBe("rollen-und-rechte");
  });

  it("finds an article through a synonym the article never uses", () => {
    // "dashboard" is a keyword of dashboard-uebersicht; "uebersicht" reaches it too.
    const results = searchWiki("dashboard", index, ALL);
    expect(results.map((r) => r.slug)).toContain("dashboard-uebersicht");
  });

  it("scores a synonym hit below the equivalent direct hit", () => {
    const direct = searchWiki("rolle", index, ALL).find((r) => r.slug === "rollen-und-rechte");
    const viaSynonym = searchWiki("berechtigung", index, ALL).find((r) => r.slug === "rollen-und-rechte");
    expect(direct).toBeDefined();
    expect(viaSynonym).toBeDefined();
    expect(viaSynonym!.score).toBeLessThan(direct!.score);
  });

  it("matches regardless of accents and case", () => {
    const withUmlaut = searchWiki("Übersicht", index, ALL);
    const without = searchWiki("uebersicht", index, ALL);
    expect(withUmlaut.map((r) => r.slug)).toEqual(without.map((r) => r.slug));
  });

  it("rewards a query whose every term matched", () => {
    const both = searchWiki("rollen rechte", index, ALL).find((r) => r.slug === "rollen-und-rechte");
    const one = searchWiki("rollen", index, ALL).find((r) => r.slug === "rollen-und-rechte");
    expect(both!.score).toBeGreaterThan(one!.score);
  });

  it("respects the allowed list, so a hidden module's article never surfaces", () => {
    const allowed = ALL.filter((s) => s !== "rollen-und-rechte");
    const results = searchWiki("rollen", index, allowed);
    expect(results.map((r) => r.slug)).not.toContain("rollen-und-rechte");
  });

  it("honours the limit", () => {
    expect(searchWiki("die", index, ALL, 2).length).toBeLessThanOrEqual(2);
  });

  it("is deterministic when scores tie", () => {
    const first = searchWiki("und", index, ALL);
    const second = searchWiki("und", index, ALL);
    expect(first.map((r) => r.slug)).toEqual(second.map((r) => r.slug));
  });

  it("carries the summary as the result excerpt", () => {
    const result = searchWiki("rollen", index, ALL)[0];
    expect(result.excerpt).toBe(index["rollen-und-rechte"].summary);
  });
});
