/**
 * The shape of an operator help article.
 *
 * Two halves, split on purpose:
 *
 *  - `WikiArticleMeta` is locale-invariant (icon, category, routes, related slugs). It
 *    lives once in the registry and is always loaded, because search and the header
 *    help button need it before any article body exists.
 *  - `WikiArticleBody` is the prose, one module per (slug × locale). It is the heavy
 *    part and is fetched only when an article is actually opened. Merging the three
 *    locales into one module would make reading a German article download the French
 *    and English text too.
 *
 * Article text is never a raw HTML string: blocks are a discriminated union so the
 * renderer can emit correct semantics (`<ol>` for steps, `<figure>` for screenshots,
 * `<table>` for statuses) and so the validator can compare structure across locales.
 */
import type { Locale } from "@/i18n/locale";
import type { ModuleKey } from "@/config/modules";
import type { WikiIconKey } from "@/features/wiki/wikiIcons";
import type { WikiSlug } from "@/features/wiki/wikiSlugs";

/** The ten top-level shelves of the help centre. */
export const WIKI_CATEGORIES = [
  "start",
  "anfragen-kunden",
  "offerten",
  "planung",
  "finanzen",
  "service-kommunikation",
  "berichte",
  "einrichtung",
  "kundensicht",
  "glossar",
] as const;

export type WikiCategory = (typeof WIKI_CATEGORIES)[number];

/**
 * A reference article explains one screen; a journey walks across several screens.
 * Journeys are listed separately on the home page because they answer "how do I get
 * this done?" rather than "what is this button?".
 */
export type WikiArticleKind = "reference" | "journey";

// ---------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------

/** One numbered instruction. `note` explains the consequence, never a second action. */
export interface WikiStep {
  /** The action, imperative and singular: "Klicken Sie auf **Offerte erstellen**." */
  text: string;
  /** Optional consequence or caveat shown under the step in muted type. */
  note?: string;
}

/**
 * A numbered callout drawn over a screenshot with CSS, positioned in percent so it
 * survives any rendered image size. The label is real text, never baked into the
 * bitmap — otherwise every locale would need its own annotated image.
 */
export interface WikiHotspot {
  /** 1-based marker number, matching the order the steps mention it. */
  n: number;
  /** Horizontal centre of the marker, 0–100, as a percentage of image width. */
  xPct: number;
  /** Vertical centre of the marker, 0–100, as a percentage of image height. */
  yPct: number;
  /** Short localized explanation shown in the legend under the figure. */
  label: string;
}

export interface WikiParagraphBlock {
  kind: "paragraph";
  /** At most three short sentences — the reading-level rule, enforced by the validator. */
  text: string;
}

export interface WikiHeadingBlock {
  kind: "heading";
  /** Rendered as <h3>; the article title is the only <h2>. Never skips a level. */
  text: string;
  /** Stable anchor id, identical across locales so a #hash survives a language switch. */
  id: string;
}

export interface WikiListBlock {
  kind: "list";
  /** `ordered` only when sequence matters; otherwise a plain bullet list. */
  ordered: boolean;
  items: readonly string[];
}

export interface WikiStepsBlock {
  kind: "steps";
  steps: readonly WikiStep[];
}

export interface WikiFigureBlock {
  kind: "figure";
  /** Path under /public, e.g. "/wiki/screenshots/de/dashboard-uebersicht-v1.webp". */
  src: string;
  /** Intrinsic pixel width — set as the img attribute so nothing shifts while loading. */
  width: number;
  /** Intrinsic pixel height. */
  height: number;
  /** Shown under the image. Says what the reader is looking at. */
  caption: string;
  /** For screen readers. Describes the content, never the word "screenshot". */
  alt: string;
  hotspots?: readonly WikiHotspot[];
}

/**
 * `danger` is reserved for irreversible actions (merge, purge). `permission` names the
 * roles that may perform a step. Both render an icon *and* a word — colour alone never
 * carries the meaning.
 */
export type WikiCalloutTone = "tip" | "warning" | "danger" | "permission";

export interface WikiCalloutBlock {
  kind: "callout";
  tone: WikiCalloutTone;
  /** Short bold lead, e.g. "Nicht umkehrbar". */
  title: string;
  text: string;
}

export interface WikiStatusRow {
  /** The status word exactly as the screen shows it. */
  status: string;
  /** What it means for the operator, in one sentence. */
  meaning: string;
  /** What the operator should do next, if anything. */
  next?: string;
}

export interface WikiStatusTableBlock {
  kind: "statusTable";
  /** Localized column headers, so the table is readable without the article text. */
  headers: { status: string; meaning: string; next: string };
  rows: readonly WikiStatusRow[];
}

export type WikiBlock =
  | WikiParagraphBlock
  | WikiHeadingBlock
  | WikiListBlock
  | WikiStepsBlock
  | WikiFigureBlock
  | WikiCalloutBlock
  | WikiStatusTableBlock;

export type WikiBlockKind = WikiBlock["kind"];

// ---------------------------------------------------------------------------------
// Article
// ---------------------------------------------------------------------------------

/** Locale-invariant metadata. Always loaded; never contains prose. */
export interface WikiArticleMeta {
  slug: WikiSlug;
  category: WikiCategory;
  kind: WikiArticleKind;
  icon: WikiIconKey;
  /**
   * CRM routes this article documents, as react-router patterns. Drives the header
   * help button and the validator's coverage check. An article that explains a screen
   * the operator cannot navigate to has an empty list.
   */
  routes: readonly string[];
  /**
   * The feature flag that hides this article when its module is switched off. `null`
   * for articles that are always relevant (glossary, "start here").
   */
  moduleKey: ModuleKey | null;
  /** Articles to read first. Rendered as a "Before you begin" list. */
  prerequisites?: readonly WikiSlug[];
  /** Further reading, rendered at the foot of the article. */
  related?: readonly WikiSlug[];
  /** ISO date (YYYY-MM-DD) the content was last checked against the running app. */
  lastVerified: string;
  /** Short commit hash the content was verified against. */
  verifiedCommit: string;
}

/** The localized prose. One module per (slug × locale). */
export interface WikiArticleBody {
  slug: WikiSlug;
  locale: Locale;
  /** Rendered as the page <h1>. */
  title: string;
  /** One sentence, shown in search results and on category cards. */
  summary: string;
  /** "What this is for" — a single short paragraph. */
  purpose: string;
  /** "When to use it" — two to five concrete situations. */
  whenToUse: readonly string[];
  blocks: readonly WikiBlock[];
  /** "What happens next" — status changes and where to continue. */
  whatHappensNext: readonly string[];
  /** "Common mistakes" — phrased as prevention, not blame. */
  commonMistakes: readonly string[];
  /** "If something goes wrong" — safe recovery only, never a security bypass. */
  ifSomethingGoesWrong: readonly string[];
}

/**
 * The searchable stub, one per (slug × locale). Small enough that a whole locale's
 * index is a single lazy chunk of a few kilobytes, so search works before any article
 * body has been fetched.
 */
export interface WikiIndexEntry {
  title: string;
  summary: string;
  /**
   * Words an operator might type instead of the title, including the labels of the
   * buttons this article explains. Lowercase; the validator enforces that.
   */
  keywords: readonly string[];
}

/** A whole locale's index. Typed against WikiSlug, so a missing entry fails the build. */
export type WikiSearchIndex = Record<WikiSlug, WikiIndexEntry>;
