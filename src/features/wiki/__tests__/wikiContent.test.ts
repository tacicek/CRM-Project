/**
 * The Wiki's anti-drift checks. Run as `npm run wiki:validate`.
 *
 * These live in a Vitest spec rather than in scripts/validate-wiki.mjs because every
 * check is an assertion about TypeScript *values* — the registry, the route map, all 21
 * article bodies. A .mjs script cannot import those, and regex-parsing TypeScript source
 * would break on any legal refactor. A validator that goes green when it should not is
 * worse than no validator, which is exactly the "patch instead of root cause" pattern
 * CLAUDE.md §2 forbids. scripts/validate-wiki.mjs exists as the documented entry point
 * and forwards to this file.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { FIRMA_NAV_ITEMS } from "@/config/firmaNav";
import { LOCALES, type Locale } from "@/i18n/locale";
import { WIKI_ICONS } from "@/features/wiki/wikiIcons";
import {
  EXTRA_ROUTES_REQUIRING_HELP,
  ROUTES_DEFERRED,
  WIKI_REGISTRY,
  prevNextFor,
} from "@/features/wiki/wikiRegistry";
import { WIKI_ROUTE_MAP, helpArticleForPath } from "@/features/wiki/wikiRouteMap";
import { WIKI_SLUGS, type WikiSlug } from "@/features/wiki/wikiSlugs";
import { loadArticleBody, loadSearchIndex } from "@/features/wiki/wikiContent";
import { WIKI_CATEGORIES, type WikiArticleBody, type WikiBlock } from "@/features/wiki/wikiTypes";
import { normalizeForSearch } from "@/features/wiki/wikiSearch";

/** Every body, in every locale, loaded once and shared across the checks below. */
const bodies = new Map<string, WikiArticleBody>();
for (const locale of LOCALES) {
  for (const slug of WIKI_SLUGS) {
    bodies.set(`${locale}:${slug}`, await loadArticleBody(slug, locale));
  }
}
const bodyOf = (slug: WikiSlug, locale: Locale): WikiArticleBody => {
  const found = bodies.get(`${locale}:${slug}`);
  if (!found) throw new Error(`no body loaded for ${locale}:${slug}`);
  return found;
};

const indexes = new Map<Locale, Awaited<ReturnType<typeof loadSearchIndex>>>();
for (const locale of LOCALES) indexes.set(locale, await loadSearchIndex(locale));

const figuresOf = (body: WikiArticleBody) =>
  body.blocks.filter((b): b is Extract<WikiBlock, { kind: "figure" }> => b.kind === "figure");

/** Every user-visible string in an article, for the hygiene scan. */
const allStrings = (body: WikiArticleBody): string[] => {
  const out = [body.title, body.summary, body.purpose, ...body.whenToUse, ...body.whatHappensNext, ...body.commonMistakes, ...body.ifSomethingGoesWrong];
  for (const block of body.blocks) {
    switch (block.kind) {
      case "paragraph":
      case "heading":
        out.push(block.text);
        break;
      case "list":
        out.push(...block.items);
        break;
      case "steps":
        for (const step of block.steps) out.push(step.text, step.note ?? "");
        break;
      case "figure":
        out.push(block.caption, block.alt, ...(block.hotspots ?? []).map((h) => h.label));
        break;
      case "callout":
        out.push(block.title, block.text);
        break;
      case "statusTable":
        out.push(block.headers.status, block.headers.meaning, block.headers.next);
        for (const row of block.rows) out.push(row.status, row.meaning, row.next ?? "");
        break;
    }
  }
  return out;
};

describe("wiki registry", () => {
  it("has no duplicate slugs", () => {
    // A const tuple can legally repeat a value; the type system will not catch it.
    expect(new Set(WIKI_SLUGS).size).toBe(WIKI_SLUGS.length);
  });

  it("uses well-formed slugs", () => {
    for (const slug of WIKI_SLUGS) {
      expect(slug, `slug "${slug}"`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("gives every article a valid category and a real icon", () => {
    for (const slug of WIKI_SLUGS) {
      const meta = WIKI_REGISTRY[slug];
      expect(WIKI_CATEGORIES, `category of ${slug}`).toContain(meta.category);
      expect(WIKI_ICONS, `icon of ${slug}`).toHaveProperty(meta.icon);
    }
  });

  it("resolves every related and prerequisite slug, and never self-references", () => {
    for (const slug of WIKI_SLUGS) {
      const meta = WIKI_REGISTRY[slug];
      for (const other of [...(meta.related ?? []), ...(meta.prerequisites ?? [])]) {
        expect(WIKI_SLUGS, `${slug} points at ${other}`).toContain(other);
        expect(other, `${slug} references itself`).not.toBe(slug);
      }
    }
  });

  it("records a plausible verification date and commit", () => {
    for (const slug of WIKI_SLUGS) {
      const meta = WIKI_REGISTRY[slug];
      expect(meta.lastVerified, `lastVerified of ${slug}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(meta.verifiedCommit, `verifiedCommit of ${slug}`).toMatch(/^[0-9a-f]{7,40}$/);
    }
  });

  it("returns null at the ends of a category rather than wrapping", () => {
    const startSlugs = WIKI_SLUGS.filter((s) => WIKI_REGISTRY[s].category === "start");
    expect(prevNextFor(startSlugs[0]).prev).toBeNull();
    expect(prevNextFor(startSlugs[startSlugs.length - 1]).next).toBeNull();
  });
});

describe("route coverage — the anti-drift spine", () => {
  it("documents every visible CRM route, or defers it explicitly", () => {
    // The nav is imported, not restated, so a new CRM section cannot be added without
    // this check noticing. Deferring is one reviewed line in ROUTES_DEFERRED; forgetting
    // is impossible.
    const required = new Set<string>([
      ...FIRMA_NAV_ITEMS.map((item) => item.url).filter((url) => url !== "/firma/hilfe"),
      ...EXTRA_ROUTES_REQUIRING_HELP,
    ]);
    const covered = new Set(WIKI_ROUTE_MAP.map((m) => m.pattern));
    const uncovered = [...required].filter((route) => !covered.has(route)).sort();

    expect(uncovered).toEqual([...ROUTES_DEFERRED].sort());
  });

  it("never maps a route to an article that does not exist", () => {
    for (const mapping of WIKI_ROUTE_MAP) {
      expect(WIKI_SLUGS, `route ${mapping.pattern}`).toContain(mapping.slug);
    }
  });

  it("has no duplicate route patterns", () => {
    const patterns = WIKI_ROUTE_MAP.map((m) => m.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it("resolves concrete paths to the right article", () => {
    // Asserted by example rather than by trusting the specificity heuristic.
    expect(helpArticleForPath("/firma")).toBe("dashboard-uebersicht");
    expect(helpArticleForPath("/auth")).toBe("anmelden-abmelden");
    expect(helpArticleForPath("/auth/reset-password")).toBe("anmelden-abmelden");
    // Detail routes resolve through their :id segment…
    expect(helpArticleForPath("/firma/offerten/123")).toBe("offerte-detail");
    // …and the more specific literal still wins over the :id pattern.
    expect(helpArticleForPath("/firma/offerten/neu")).toBe("offerte-erstellen");
    // A screen with no article yet is a real answer, not a crash.
    expect(helpArticleForPath("/firma/nonsense")).toBeNull();
    expect(helpArticleForPath("/firma/quittungen")).toBeNull();
  });
});

describe("locale parity", () => {
  it("gives every locale the same block structure as the German source", () => {
    for (const slug of WIKI_SLUGS) {
      const de = bodyOf(slug, "de");
      for (const locale of LOCALES.filter((l) => l !== "de")) {
        const other = bodyOf(slug, locale);
        expect(other.blocks.length, `${locale}/${slug} block count`).toBe(de.blocks.length);
        expect(
          other.blocks.map((b) => b.kind),
          `${locale}/${slug} block kinds`,
        ).toEqual(de.blocks.map((b) => b.kind));
      }
    }
  });

  it("keeps step, row, item and hotspot counts identical across locales", () => {
    for (const slug of WIKI_SLUGS) {
      const de = bodyOf(slug, "de");
      for (const locale of LOCALES.filter((l) => l !== "de")) {
        const other = bodyOf(slug, locale);
        de.blocks.forEach((block, i) => {
          const mirror = other.blocks[i];
          const where = `${locale}/${slug} block ${i}`;
          if (block.kind === "steps" && mirror.kind === "steps") {
            expect(mirror.steps.length, `${where} steps`).toBe(block.steps.length);
          }
          if (block.kind === "list" && mirror.kind === "list") {
            expect(mirror.items.length, `${where} items`).toBe(block.items.length);
            expect(mirror.ordered, `${where} ordered`).toBe(block.ordered);
          }
          if (block.kind === "statusTable" && mirror.kind === "statusTable") {
            expect(mirror.rows.length, `${where} rows`).toBe(block.rows.length);
          }
          if (block.kind === "callout" && mirror.kind === "callout") {
            expect(mirror.tone, `${where} tone`).toBe(block.tone);
          }
        });
      }
    }
  });

  it("keeps heading anchors identical across locales, so a #hash survives a language switch", () => {
    for (const slug of WIKI_SLUGS) {
      const idsFor = (locale: Locale) =>
        bodyOf(slug, locale)
          .blocks.filter((b): b is Extract<WikiBlock, { kind: "heading" }> => b.kind === "heading")
          .map((b) => b.id);
      const de = idsFor("de");
      expect(new Set(de).size, `${slug} has duplicate anchors`).toBe(de.length);
      for (const locale of LOCALES.filter((l) => l !== "de")) {
        expect(idsFor(locale), `${locale}/${slug} anchors`).toEqual(de);
      }
    }
  });

  it("keeps hotspot numbers and positions identical across locales", () => {
    // Only the label may differ: the same fixture state and crop is captured in every
    // locale, so a marker that moves means one locale's article is out of date.
    for (const slug of WIKI_SLUGS) {
      const de = figuresOf(bodyOf(slug, "de"));
      for (const locale of LOCALES.filter((l) => l !== "de")) {
        const other = figuresOf(bodyOf(slug, locale));
        expect(other.length, `${locale}/${slug} figure count`).toBe(de.length);
        de.forEach((figure, i) => {
          const mirror = other[i];
          const spots = figure.hotspots ?? [];
          const mirrorSpots = mirror.hotspots ?? [];
          expect(mirrorSpots.length, `${locale}/${slug} figure ${i} hotspots`).toBe(spots.length);
          spots.forEach((spot, j) => {
            expect(
              { n: mirrorSpots[j].n, x: mirrorSpots[j].xPct, y: mirrorSpots[j].yPct },
              `${locale}/${slug} figure ${i} hotspot ${j}`,
            ).toEqual({ n: spot.n, x: spot.xPct, y: spot.yPct });
          });
        });
      }
    }
  });

  it("labels every body with its own slug and locale", () => {
    for (const locale of LOCALES) {
      for (const slug of WIKI_SLUGS) {
        const body = bodyOf(slug, locale);
        expect(body.slug, `${locale}/${slug} slug field`).toBe(slug);
        expect(body.locale, `${locale}/${slug} locale field`).toBe(locale);
      }
    }
  });

  it("gives every locale a complete, non-empty search index", () => {
    for (const locale of LOCALES) {
      const index = indexes.get(locale)!;
      expect(Object.keys(index).sort(), `${locale} index slugs`).toEqual([...WIKI_SLUGS].sort());
      for (const slug of WIKI_SLUGS) {
        const entry = index[slug];
        expect(entry.title.trim(), `${locale}/${slug} title`).not.toBe("");
        expect(entry.summary.trim(), `${locale}/${slug} summary`).not.toBe("");
        expect(entry.keywords.length, `${locale}/${slug} keywords`).toBeGreaterThanOrEqual(3);
        for (const keyword of entry.keywords) {
          // Search normalizes before comparing; an upper-case keyword would still match,
          // but a mixed-case list is a sign someone pasted UI labels without thinking.
          expect(keyword, `${locale}/${slug} keyword "${keyword}"`).toBe(keyword.toLowerCase());
          expect(normalizeForSearch(keyword).trim(), `${locale}/${slug} keyword "${keyword}"`).not.toBe("");
        }
      }
    }
  });

  it("uses the index title as the article title", () => {
    for (const locale of LOCALES) {
      const index = indexes.get(locale)!;
      for (const slug of WIKI_SLUGS) {
        expect(index[slug].title, `${locale}/${slug}`).toBe(bodyOf(slug, locale).title);
      }
    }
  });
});

describe("screenshots", () => {
  it("references a file that exists, in the article's own locale folder", () => {
    for (const locale of LOCALES) {
      for (const slug of WIKI_SLUGS) {
        for (const figure of figuresOf(bodyOf(slug, locale))) {
          expect(figure.src, `${locale}/${slug}`).toMatch(/^\/wiki\/screenshots\/(de|fr|en)\//);
          expect(figure.src.split("/")[3], `${locale}/${slug} figure locale folder`).toBe(locale);
          expect(figure.src, `${locale}/${slug}`).toMatch(/\.(webp|avif)$/);
          const onDisk = path.join(process.cwd(), "public", figure.src);
          expect(existsSync(onDisk), `missing file for ${locale}/${slug}: ${figure.src}`).toBe(true);
        }
      }
    }
  });

  it("declares the real pixel dimensions of every image", async () => {
    // Guards against layout shift: a re-capture at a different viewport that silently
    // leaves the old numbers in the article would reintroduce CLS for every reader.
    for (const locale of LOCALES) {
      for (const slug of WIKI_SLUGS) {
        for (const figure of figuresOf(bodyOf(slug, locale))) {
          const meta = await sharp(path.join(process.cwd(), "public", figure.src)).metadata();
          expect(
            { width: meta.width, height: meta.height },
            `${locale}/${slug} declares wrong size for ${figure.src}`,
          ).toEqual({ width: figure.width, height: figure.height });
        }
      }
    }
  });

  it("gives every image a useful caption and alt text", () => {
    for (const locale of LOCALES) {
      for (const slug of WIKI_SLUGS) {
        for (const figure of figuresOf(bodyOf(slug, locale))) {
          expect(figure.caption.trim(), `${locale}/${slug} caption`).not.toBe("");
          expect(figure.alt.trim().length, `${locale}/${slug} alt is too short to be useful`).toBeGreaterThanOrEqual(20);
          // "Screenshot of the page" tells a screen-reader user nothing.
          expect(figure.alt, `${locale}/${slug} alt starts with a filler word`).not.toMatch(
            /^(screenshot|bildschirmfoto|capture d'écran|image|bild)\b/i,
          );
        }
      }
    }
  });

  it("keeps hotspot coordinates inside the image", () => {
    for (const locale of LOCALES) {
      for (const slug of WIKI_SLUGS) {
        for (const figure of figuresOf(bodyOf(slug, locale))) {
          for (const spot of figure.hotspots ?? []) {
            expect(spot.xPct, `${locale}/${slug} hotspot ${spot.n} x`).toBeGreaterThanOrEqual(0);
            expect(spot.xPct, `${locale}/${slug} hotspot ${spot.n} x`).toBeLessThanOrEqual(100);
            expect(spot.yPct, `${locale}/${slug} hotspot ${spot.n} y`).toBeGreaterThanOrEqual(0);
            expect(spot.yPct, `${locale}/${slug} hotspot ${spot.n} y`).toBeLessThanOrEqual(100);
            expect(spot.label.trim(), `${locale}/${slug} hotspot ${spot.n} label`).not.toBe("");
          }
        }
      }
    }
  });
});

describe("content hygiene", () => {
  const FORBIDDEN = /\bTODO\b|\bFIXME\b|lorem ipsum|screenshot (coming|folgt|suit)|\bplatzhalter\b|\bXXX\b|example\.com/i;

  it("contains no placeholders, and no fake example.com URLs", () => {
    for (const locale of LOCALES) {
      for (const slug of WIKI_SLUGS) {
        for (const text of allStrings(bodyOf(slug, locale))) {
          // NOTE: `example.test` is deliberately allowed — it is the sanctioned synthetic
          // domain used by the screenshot fixtures and quoted in the articles.
          expect(FORBIDDEN.test(text), `${locale}/${slug}: forbidden placeholder in "${text.slice(0, 80)}"`).toBe(false);
        }
      }
    }
  });

  it("contains no developer vocabulary in operator-facing copy", () => {
    // "trigger" is deliberately NOT a bare word here: in English it is an ordinary verb
    // ("a PDF attachment does not trigger it"), and banning it produced a false positive
    // on correct copy. Only the database sense is jargon, so that is what is matched.
    const JARGON =
      /\b(RLS|RPC|JSON|UUID|row level security|state machine|token hash)\b|\b(database|db|sql)[ -]trigger\b|\bmigration\b/i;
    for (const locale of LOCALES) {
      for (const slug of WIKI_SLUGS) {
        for (const text of allStrings(bodyOf(slug, locale))) {
          expect(JARGON.test(text), `${locale}/${slug}: developer term in "${text.slice(0, 80)}"`).toBe(false);
        }
      }
    }
  });

  it("gives every article the full ten-section skeleton", () => {
    for (const locale of LOCALES) {
      for (const slug of WIKI_SLUGS) {
        const body = bodyOf(slug, locale);
        const where = `${locale}/${slug}`;
        expect(body.purpose.trim(), `${where} purpose`).not.toBe("");
        expect(body.whenToUse.length, `${where} whenToUse`).toBeGreaterThanOrEqual(2);
        expect(body.whenToUse.length, `${where} whenToUse is too long to scan`).toBeLessThanOrEqual(5);
        expect(body.blocks.length, `${where} blocks`).toBeGreaterThan(0);
        expect(body.whatHappensNext.length, `${where} whatHappensNext`).toBeGreaterThanOrEqual(1);
        expect(body.commonMistakes.length, `${where} commonMistakes`).toBeGreaterThanOrEqual(1);
        expect(body.ifSomethingGoesWrong.length, `${where} ifSomethingGoesWrong`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
