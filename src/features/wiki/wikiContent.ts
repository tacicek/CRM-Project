/**
 * Lazy loading for article bodies and per-locale search indexes.
 *
 * Explicit loader tables, no `import.meta.glob`. This follows the stance already taken
 * for the i18n catalogs in docs/I18N_LAZY_CATALOG_PLAN.md: a glob hides which modules
 * exist, so a missing file becomes a runtime `undefined` instead of a compile error.
 * Typing the tables as `Record<WikiSlug, …>` means a slug added without all three
 * locale bodies does not build.
 *
 * Article bodies deliberately get no `manualChunks` entry in vite.config.ts. They are
 * reached only through `import()`, so Rollup already emits one chunk each; naming them
 * as a group would fuse every article into a single chunk and make opening one article
 * download all of them in all three languages.
 */
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import type { WikiSlug } from "@/features/wiki/wikiSlugs";
import type { WikiArticleBody, WikiSearchIndex } from "@/features/wiki/wikiTypes";

type BodyLoader = () => Promise<{ default: WikiArticleBody }>;
type BodyTable = Record<WikiSlug, BodyLoader>;

const DE_BODIES: BodyTable = {
  "start-hier": () => import("@/features/wiki/content/de/start-hier"),
  "anmelden-abmelden": () => import("@/features/wiki/content/de/anmelden-abmelden"),
  "dashboard-uebersicht": () => import("@/features/wiki/content/de/dashboard-uebersicht"),
  "navigation-und-benachrichtigungen": () => import("@/features/wiki/content/de/navigation-und-benachrichtigungen"),
  "sprache-dashboard-vs-dokument": () => import("@/features/wiki/content/de/sprache-dashboard-vs-dokument"),
  "typischer-arbeitstag": () => import("@/features/wiki/content/de/typischer-arbeitstag"),
  "rollen-und-rechte": () => import("@/features/wiki/content/de/rollen-und-rechte"),
  "kunden-liste": () => import("@/features/wiki/content/de/kunden-liste"),
  "kundenkarte": () => import("@/features/wiki/content/de/kundenkarte"),
  "finanzen-uebersicht": () => import("@/features/wiki/content/de/finanzen-uebersicht"),
  "zahlung-erfassen": () => import("@/features/wiki/content/de/zahlung-erfassen"),
  "rechnungen-liste": () => import("@/features/wiki/content/de/rechnungen-liste"),
  "rechnung-erstellen": () => import("@/features/wiki/content/de/rechnung-erstellen"),
  "offerten-liste": () => import("@/features/wiki/content/de/offerten-liste"),
  "offerte-erstellen": () => import("@/features/wiki/content/de/offerte-erstellen"),
  "offerte-detail": () => import("@/features/wiki/content/de/offerte-detail"),
  "offerte-bearbeiten": () => import("@/features/wiki/content/de/offerte-bearbeiten"),
  "offerte-version": () => import("@/features/wiki/content/de/offerte-version"),
  "nachtrag": () => import("@/features/wiki/content/de/nachtrag"),
  "anfragen-liste": () => import("@/features/wiki/content/de/anfragen-liste"),
  "anfrage-details": () => import("@/features/wiki/content/de/anfrage-details"),
  "anfrage-importieren": () => import("@/features/wiki/content/de/anfrage-importieren"),
  "email-eingang": () => import("@/features/wiki/content/de/email-eingang"),
  "auftraege-liste": () => import("@/features/wiki/content/de/auftraege-liste"),
  "auftrag-abschliessen": () => import("@/features/wiki/content/de/auftrag-abschliessen"),
  "kalender": () => import("@/features/wiki/content/de/kalender"),
  "termin-erstellen": () => import("@/features/wiki/content/de/termin-erstellen"),
};

const FR_BODIES: BodyTable = {
  "start-hier": () => import("@/features/wiki/content/fr/start-hier"),
  "anmelden-abmelden": () => import("@/features/wiki/content/fr/anmelden-abmelden"),
  "dashboard-uebersicht": () => import("@/features/wiki/content/fr/dashboard-uebersicht"),
  "navigation-und-benachrichtigungen": () => import("@/features/wiki/content/fr/navigation-und-benachrichtigungen"),
  "sprache-dashboard-vs-dokument": () => import("@/features/wiki/content/fr/sprache-dashboard-vs-dokument"),
  "typischer-arbeitstag": () => import("@/features/wiki/content/fr/typischer-arbeitstag"),
  "rollen-und-rechte": () => import("@/features/wiki/content/fr/rollen-und-rechte"),
  "kunden-liste": () => import("@/features/wiki/content/fr/kunden-liste"),
  "kundenkarte": () => import("@/features/wiki/content/fr/kundenkarte"),
  "finanzen-uebersicht": () => import("@/features/wiki/content/fr/finanzen-uebersicht"),
  "zahlung-erfassen": () => import("@/features/wiki/content/fr/zahlung-erfassen"),
  "rechnungen-liste": () => import("@/features/wiki/content/fr/rechnungen-liste"),
  "rechnung-erstellen": () => import("@/features/wiki/content/fr/rechnung-erstellen"),
  "offerten-liste": () => import("@/features/wiki/content/fr/offerten-liste"),
  "offerte-erstellen": () => import("@/features/wiki/content/fr/offerte-erstellen"),
  "offerte-detail": () => import("@/features/wiki/content/fr/offerte-detail"),
  "offerte-bearbeiten": () => import("@/features/wiki/content/fr/offerte-bearbeiten"),
  "offerte-version": () => import("@/features/wiki/content/fr/offerte-version"),
  "nachtrag": () => import("@/features/wiki/content/fr/nachtrag"),
  "anfragen-liste": () => import("@/features/wiki/content/fr/anfragen-liste"),
  "anfrage-details": () => import("@/features/wiki/content/fr/anfrage-details"),
  "anfrage-importieren": () => import("@/features/wiki/content/fr/anfrage-importieren"),
  "email-eingang": () => import("@/features/wiki/content/fr/email-eingang"),
  "auftraege-liste": () => import("@/features/wiki/content/fr/auftraege-liste"),
  "auftrag-abschliessen": () => import("@/features/wiki/content/fr/auftrag-abschliessen"),
  "kalender": () => import("@/features/wiki/content/fr/kalender"),
  "termin-erstellen": () => import("@/features/wiki/content/fr/termin-erstellen"),
};

const EN_BODIES: BodyTable = {
  "start-hier": () => import("@/features/wiki/content/en/start-hier"),
  "anmelden-abmelden": () => import("@/features/wiki/content/en/anmelden-abmelden"),
  "dashboard-uebersicht": () => import("@/features/wiki/content/en/dashboard-uebersicht"),
  "navigation-und-benachrichtigungen": () => import("@/features/wiki/content/en/navigation-und-benachrichtigungen"),
  "sprache-dashboard-vs-dokument": () => import("@/features/wiki/content/en/sprache-dashboard-vs-dokument"),
  "typischer-arbeitstag": () => import("@/features/wiki/content/en/typischer-arbeitstag"),
  "rollen-und-rechte": () => import("@/features/wiki/content/en/rollen-und-rechte"),
  "kunden-liste": () => import("@/features/wiki/content/en/kunden-liste"),
  "kundenkarte": () => import("@/features/wiki/content/en/kundenkarte"),
  "finanzen-uebersicht": () => import("@/features/wiki/content/en/finanzen-uebersicht"),
  "zahlung-erfassen": () => import("@/features/wiki/content/en/zahlung-erfassen"),
  "rechnungen-liste": () => import("@/features/wiki/content/en/rechnungen-liste"),
  "rechnung-erstellen": () => import("@/features/wiki/content/en/rechnung-erstellen"),
  "offerten-liste": () => import("@/features/wiki/content/en/offerten-liste"),
  "offerte-erstellen": () => import("@/features/wiki/content/en/offerte-erstellen"),
  "offerte-detail": () => import("@/features/wiki/content/en/offerte-detail"),
  "offerte-bearbeiten": () => import("@/features/wiki/content/en/offerte-bearbeiten"),
  "offerte-version": () => import("@/features/wiki/content/en/offerte-version"),
  "nachtrag": () => import("@/features/wiki/content/en/nachtrag"),
  "anfragen-liste": () => import("@/features/wiki/content/en/anfragen-liste"),
  "anfrage-details": () => import("@/features/wiki/content/en/anfrage-details"),
  "anfrage-importieren": () => import("@/features/wiki/content/en/anfrage-importieren"),
  "email-eingang": () => import("@/features/wiki/content/en/email-eingang"),
  "auftraege-liste": () => import("@/features/wiki/content/en/auftraege-liste"),
  "auftrag-abschliessen": () => import("@/features/wiki/content/en/auftrag-abschliessen"),
  "kalender": () => import("@/features/wiki/content/en/kalender"),
  "termin-erstellen": () => import("@/features/wiki/content/en/termin-erstellen"),
};

const BODY_TABLES: Record<Locale, BodyTable> = {
  de: DE_BODIES,
  fr: FR_BODIES,
  en: EN_BODIES,
};

const INDEX_LOADERS: Record<Locale, () => Promise<{ default: WikiSearchIndex }>> = {
  de: () => import("@/features/wiki/content/searchIndex.de"),
  fr: () => import("@/features/wiki/content/searchIndex.fr"),
  en: () => import("@/features/wiki/content/searchIndex.en"),
};

/**
 * In-flight and settled promises, keyed by `${locale}:${slug}`.
 *
 * A rejected promise is evicted rather than kept: a chunk fetch that failed because
 * the network blinked must be retryable. Caching the rejection would make one bad
 * moment permanent for the rest of the session.
 */
const bodyCache = new Map<string, Promise<WikiArticleBody>>();
const indexCache = new Map<Locale, Promise<WikiSearchIndex>>();

export const loadArticleBody = (slug: WikiSlug, locale: Locale): Promise<WikiArticleBody> => {
  const key = `${locale}:${slug}`;
  const cached = bodyCache.get(key);
  if (cached) return cached;

  const table = BODY_TABLES[locale] ?? BODY_TABLES[DEFAULT_LOCALE];
  const pending = table[slug]()
    .then((module) => module.default)
    .catch((error: unknown) => {
      bodyCache.delete(key);
      throw error;
    });

  bodyCache.set(key, pending);
  return pending;
};

export const loadSearchIndex = (locale: Locale): Promise<WikiSearchIndex> => {
  const cached = indexCache.get(locale);
  if (cached) return cached;

  const loader = INDEX_LOADERS[locale] ?? INDEX_LOADERS[DEFAULT_LOCALE];
  const pending = loader()
    .then((module) => module.default)
    .catch((error: unknown) => {
      indexCache.delete(locale);
      throw error;
    });

  indexCache.set(locale, pending);
  return pending;
};

/** Exposed for the validator, which loads every body in every locale to compare structure. */
export const bodyLoaderTable = (locale: Locale): BodyTable => BODY_TABLES[locale];
