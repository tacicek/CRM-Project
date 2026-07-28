/**
 * Every help article that exists, as a const tuple.
 *
 * This list is the gate. `WikiSearchIndex` is `Record<WikiSlug, …>` and the loader
 * tables are `Record<WikiSlug, () => Promise<…>>`, so a slug can only appear here once
 * all three locales are written. A half-translated article is a compile error, not a
 * rule someone has to remember.
 *
 * Adding an article: write de/fr/en bodies + the three index entries, then add the
 * slug here and its metadata to `wikiRegistry.ts`. `npm run wiki:validate` checks the
 * rest.
 */
export const WIKI_SLUGS = [
  // --- start ---------------------------------------------------------------------
  "start-hier",
  "anmelden-abmelden",
  "dashboard-uebersicht",
  "navigation-und-benachrichtigungen",
  "sprache-dashboard-vs-dokument",
  "typischer-arbeitstag",
  "rollen-und-rechte",

  // --- anfragen-kunden -------------------------------------------------------------
  "kunden-liste",
  "kundenkarte",

  // --- finanzen --------------------------------------------------------------------
  "finanzen-uebersicht",
  "zahlung-erfassen",
  "rechnungen-liste",
  "rechnung-erstellen",

  // --- offerten --------------------------------------------------------------------
  "offerten-liste",
  "offerte-erstellen",
  "offerte-detail",
  "offerte-bearbeiten",
  "offerte-version",
  "nachtrag",

  // --- anfragen --------------------------------------------------------------------
  "anfragen-liste",
  "anfrage-details",
  "anfrage-importieren",
  "email-eingang",

  // --- planung ---------------------------------------------------------------------
  "auftraege-liste",
  "auftrag-abschliessen",
  "kalender",
  "termin-erstellen",
] as const;

export type WikiSlug = (typeof WIKI_SLUGS)[number];

const SLUG_SET: ReadonlySet<string> = new Set(WIKI_SLUGS);

export const isWikiSlug = (value: string): value is WikiSlug => SLUG_SET.has(value);
