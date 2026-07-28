/**
 * "Which help article explains the screen I am on?"
 *
 * Matching uses react-router's `matchPath`, which is already in the always-loaded
 * router chunk, so this costs no extra bytes and — more importantly — resolves `:id`
 * segments exactly the way the router that produced the URL does. A hand-rolled
 * matcher would eventually disagree with the router on some edge case.
 *
 * Order is significant: the first match wins, so patterns are listed most specific
 * first. `/firma/quittungen/:id/bearbeiten` must be tried before
 * `/firma/quittungen/:id`, which must be tried before `/firma/quittungen`. The
 * validator asserts the resulting resolutions by example rather than trusting a
 * specificity heuristic.
 */
import { matchPath } from "react-router-dom";
import { WIKI_REGISTRY } from "@/features/wiki/wikiRegistry";
import { WIKI_SLUGS, type WikiSlug } from "@/features/wiki/wikiSlugs";

export interface WikiRouteMapping {
  /** A react-router path pattern, matched with `end: true`. */
  pattern: string;
  slug: WikiSlug;
}

/**
 * Built from the registry so a route can never point at an article that does not
 * exist, and so adding `routes` to an article is the single place a mapping is
 * declared.
 *
 * Sorted by descending static-segment count, then by descending length: a pattern with
 * more literal segments is more specific than one with fewer, regardless of order in
 * the registry.
 */
const specificity = (pattern: string): number => {
  const segments = pattern.split("/").filter(Boolean);
  const staticSegments = segments.filter((s) => !s.startsWith(":")).length;
  return staticSegments * 100 + segments.length;
};

export const WIKI_ROUTE_MAP: readonly WikiRouteMapping[] = WIKI_SLUGS.flatMap((slug) =>
  WIKI_REGISTRY[slug].routes.map((pattern) => ({ pattern, slug })),
).sort((a, b) => specificity(b.pattern) - specificity(a.pattern));

/**
 * The article for a pathname, or `null` when the screen has no help yet.
 *
 * `null` is a real answer, not a failure: the header renders a link to the Wiki home
 * instead of pretending an unrelated article is relevant.
 */
export const helpArticleForPath = (pathname: string): WikiSlug | null => {
  for (const mapping of WIKI_ROUTE_MAP) {
    if (matchPath({ path: mapping.pattern, end: true }, pathname)) return mapping.slug;
  }
  return null;
};
