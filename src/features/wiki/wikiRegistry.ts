/**
 * Locale-invariant metadata for every article, plus the pure helpers the UI needs.
 *
 * Kept free of prose so it can be imported by the header help button and the validator
 * without dragging article text into the bundle. The helpers are exported as plain
 * functions rather than hooks so they can be unit-tested in Vitest's `node`
 * environment, which is the repo's testing policy.
 */
import { MODULES, type ModuleKey } from "@/config/modules";
import { WIKI_CATEGORIES, type WikiArticleMeta, type WikiCategory } from "@/features/wiki/wikiTypes";
import { WIKI_SLUGS, type WikiSlug } from "@/features/wiki/wikiSlugs";

/** Commit the `start` category was written and screenshotted against. */
const VERIFIED_COMMIT = "dccef4b2";
const VERIFIED_ON = "2026-07-28";

export const WIKI_REGISTRY: Record<WikiSlug, WikiArticleMeta> = {
  "start-hier": {
    slug: "start-hier",
    category: "start",
    kind: "journey",
    icon: "start",
    routes: [],
    moduleKey: null,
    related: ["anmelden-abmelden", "typischer-arbeitstag", "navigation-und-benachrichtigungen"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "anmelden-abmelden": {
    slug: "anmelden-abmelden",
    category: "start",
    kind: "reference",
    icon: "signIn",
    routes: ["/auth", "/auth/reset-password"],
    moduleKey: null,
    related: ["navigation-und-benachrichtigungen", "rollen-und-rechte"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "dashboard-uebersicht": {
    slug: "dashboard-uebersicht",
    category: "start",
    kind: "reference",
    icon: "home",
    routes: ["/firma"],
    moduleKey: "reports",
    prerequisites: ["anmelden-abmelden"],
    related: ["typischer-arbeitstag", "navigation-und-benachrichtigungen"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "navigation-und-benachrichtigungen": {
    slug: "navigation-und-benachrichtigungen",
    category: "start",
    kind: "reference",
    icon: "guide",
    routes: [],
    moduleKey: null,
    related: ["dashboard-uebersicht", "sprache-dashboard-vs-dokument", "typischer-arbeitstag"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "sprache-dashboard-vs-dokument": {
    slug: "sprache-dashboard-vs-dokument",
    category: "start",
    kind: "reference",
    icon: "language",
    routes: [],
    moduleKey: null,
    related: ["navigation-und-benachrichtigungen", "rollen-und-rechte"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "typischer-arbeitstag": {
    slug: "typischer-arbeitstag",
    category: "start",
    kind: "journey",
    icon: "checklist",
    routes: [],
    moduleKey: null,
    prerequisites: ["dashboard-uebersicht"],
    related: ["dashboard-uebersicht", "navigation-und-benachrichtigungen", "start-hier"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "rollen-und-rechte": {
    slug: "rollen-und-rechte",
    category: "start",
    kind: "reference",
    icon: "permission",
    routes: [],
    moduleKey: null,
    related: ["anmelden-abmelden", "navigation-und-benachrichtigungen", "zahlung-erfassen"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },

  // --- Kunden ------------------------------------------------------------------------
  "kunden-liste": {
    slug: "kunden-liste",
    category: "anfragen-kunden",
    kind: "reference",
    icon: "customers",
    routes: ["/firma/kunden"],
    moduleKey: "contacts",
    related: ["kundenkarte", "finanzen-uebersicht"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "kundenkarte": {
    slug: "kundenkarte",
    category: "anfragen-kunden",
    kind: "reference",
    icon: "customers",
    routes: ["/firma/kunden/:id"],
    moduleKey: "contacts",
    prerequisites: ["kunden-liste"],
    related: ["kunden-liste", "rollen-und-rechte", "finanzen-uebersicht"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },

  // --- Finanzen ----------------------------------------------------------------------
  "finanzen-uebersicht": {
    slug: "finanzen-uebersicht",
    category: "finanzen",
    kind: "reference",
    icon: "finance",
    routes: ["/firma/finanzen"],
    moduleKey: "invoices",
    related: ["zahlung-erfassen", "rechnungen-liste", "rechnung-erstellen"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "zahlung-erfassen": {
    slug: "zahlung-erfassen",
    category: "finanzen",
    kind: "journey",
    icon: "finance",
    // The dialog has no route of its own — it opens from Finanzen and from an invoice.
    routes: [],
    moduleKey: "invoices",
    prerequisites: ["finanzen-uebersicht"],
    related: ["finanzen-uebersicht", "rechnung-erstellen", "rollen-und-rechte"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "rechnungen-liste": {
    slug: "rechnungen-liste",
    category: "finanzen",
    kind: "reference",
    icon: "invoices",
    routes: ["/firma/rechnungen"],
    moduleKey: "invoices",
    related: ["rechnung-erstellen", "zahlung-erfassen", "finanzen-uebersicht"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "rechnung-erstellen": {
    slug: "rechnung-erstellen",
    category: "finanzen",
    kind: "reference",
    icon: "invoices",
    routes: ["/firma/rechnungen/neu", "/firma/rechnungen/:id"],
    moduleKey: "invoices",
    prerequisites: ["rechnungen-liste"],
    related: ["rechnungen-liste", "zahlung-erfassen", "finanzen-uebersicht"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },

  // --- Planung -----------------------------------------------------------------------
  "auftraege-liste": {
    slug: "auftraege-liste",
    category: "planung",
    kind: "reference",
    icon: "orders",
    routes: ["/firma/auftraege"],
    moduleKey: "orders",
    related: ["auftrag-abschliessen", "kalender", "offerte-detail"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "auftrag-abschliessen": {
    slug: "auftrag-abschliessen",
    category: "planung",
    kind: "journey",
    icon: "orders",
    routes: [],
    moduleKey: "orders",
    prerequisites: ["auftraege-liste"],
    related: ["auftraege-liste", "rechnung-erstellen", "kalender"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "kalender": {
    slug: "kalender",
    category: "planung",
    kind: "reference",
    icon: "calendar",
    routes: ["/firma/kalender"],
    moduleKey: "calendar",
    related: ["termin-erstellen", "auftraege-liste", "kalender-abo"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "termin-erstellen": {
    slug: "termin-erstellen",
    category: "planung",
    kind: "reference",
    icon: "calendar",
    routes: [],
    moduleKey: "calendar",
    prerequisites: ["kalender"],
    related: ["kalender", "auftraege-liste", "anfragen-liste"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },

  // --- Einrichtung ---------------------------------------------------------------
  "kalender-abo": {
    slug: "kalender-abo",
    category: "einrichtung",
    kind: "journey",
    icon: "calendar",
    // Lives inside the Einstellungen screen, which has no article of its own yet —
    // /firma/einstellungen therefore stays in ROUTES_DEFERRED; claiming it here would
    // mark seven undocumented tabs as covered.
    routes: [],
    moduleKey: "calendar",
    prerequisites: ["kalender"],
    related: ["kalender", "termin-erstellen"],
    lastVerified: "2026-08-05",
    verifiedCommit: "93231580",
  },

  // --- Offerten ----------------------------------------------------------------------
  "offerten-liste": {
    slug: "offerten-liste",
    category: "offerten",
    kind: "reference",
    icon: "offer",
    routes: ["/firma/offerten"],
    moduleKey: "offers",
    related: ["offerte-erstellen", "offerte-detail", "offerte-version"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "offerte-erstellen": {
    slug: "offerte-erstellen",
    category: "offerten",
    kind: "reference",
    icon: "offer",
    routes: ["/firma/offerten/neu"],
    moduleKey: "offers",
    prerequisites: ["offerten-liste"],
    related: ["offerte-detail", "offerte-bearbeiten", "offerten-liste"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "offerte-detail": {
    slug: "offerte-detail",
    category: "offerten",
    kind: "reference",
    icon: "offer",
    routes: ["/firma/offerten/:id"],
    moduleKey: "offers",
    prerequisites: ["offerten-liste"],
    related: ["offerte-version", "nachtrag", "offerte-erstellen"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "offerte-bearbeiten": {
    slug: "offerte-bearbeiten",
    category: "offerten",
    kind: "reference",
    icon: "offer",
    routes: ["/firma/offerte-bearbeiten/:offerId"],
    moduleKey: "offers",
    prerequisites: ["offerte-detail"],
    related: ["offerte-version", "offerte-erstellen", "offerte-detail"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "offerte-version": {
    slug: "offerte-version",
    category: "offerten",
    kind: "journey",
    icon: "offer",
    // No route of its own — the flow starts from an offer's detail page.
    routes: [],
    moduleKey: "offers",
    prerequisites: ["offerte-detail"],
    related: ["offerte-detail", "offerte-bearbeiten", "nachtrag"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  // --- Anfragen ----------------------------------------------------------------------
  "anfragen-liste": {
    slug: "anfragen-liste",
    category: "anfragen-kunden",
    kind: "reference",
    icon: "inbox",
    routes: ["/firma/anfragen"],
    moduleKey: "manualImport",
    related: ["anfrage-details", "anfrage-importieren", "offerte-erstellen"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "anfrage-details": {
    slug: "anfrage-details",
    category: "anfragen-kunden",
    kind: "reference",
    icon: "inbox",
    routes: [],
    moduleKey: "manualImport",
    prerequisites: ["anfragen-liste"],
    related: ["anfragen-liste", "offerte-erstellen", "kundenkarte"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "anfrage-importieren": {
    slug: "anfrage-importieren",
    category: "anfragen-kunden",
    kind: "reference",
    icon: "inbox",
    routes: ["/firma/manual-import"],
    moduleKey: "manualImport",
    related: ["anfragen-liste", "email-eingang", "offerte-erstellen"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
  "email-eingang": {
    slug: "email-eingang",
    category: "anfragen-kunden",
    kind: "journey",
    icon: "mail",
    routes: ["/firma/email-import"],
    moduleKey: "inboundEmail",
    related: ["anfragen-liste", "anfrage-importieren", "offerte-erstellen"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },

  "nachtrag": {
    slug: "nachtrag",
    category: "offerten",
    kind: "journey",
    icon: "offer",
    routes: ["/firma/nachtrag/:id"],
    moduleKey: "offers",
    prerequisites: ["offerte-detail"],
    related: ["offerte-detail", "offerte-version", "offerten-liste"],
    lastVerified: VERIFIED_ON,
    verifiedCommit: VERIFIED_COMMIT,
  },
};

/**
 * CRM routes that must eventually have a help article. Derived from the nav in the
 * validator; listed here only where a route has no nav entry of its own (detail and
 * form routes, and the customer-facing pages staff have to understand).
 */
export const EXTRA_ROUTES_REQUIRING_HELP: readonly string[] = [
  "/firma/quittungen/neu",
  "/firma/quittungen/:id",
  "/firma/quittungen/:id/bearbeiten",
  "/auth",
  "/auth/reset-password",
  "/offerte/:token",
  "/nachtrag/:token",
  "/portal/:token",
  "/termin/:appointmentId/absagen",
  "/termin/:appointmentId/verschieben",
  "/termin/:appointmentId/antwort",
  "/besichtigung/:leadId/antwort",
  "/besichtigung/:token",
];

/**
 * Routes knowingly not documented yet.
 *
 * The validator asserts `requiredRoutes \ covered === DEFERRED` as an *exact* set, so
 * adding a CRM section without help fails the build, and removing an entry from this
 * list without writing the article fails too. Deferring is one visible reviewed line;
 * forgetting is impossible.
 */
export const ROUTES_DEFERRED: readonly string[] = [
  "/firma/aufgaben",
  "/firma/faelle",
  "/firma/posteingang",
  "/firma/kennzahlen",
  "/firma/quittungen",
  "/firma/besichtigungen",
  "/firma/umzugsboxen",
  "/firma/team",
  "/firma/checkliste",
  "/firma/leistungskatalog",
  "/firma/preisgestaltung",
  "/firma/datenarchiv",
  "/firma/einstellungen",
  "/firma/quittungen/neu",
  "/firma/quittungen/:id",
  "/firma/quittungen/:id/bearbeiten",
  "/offerte/:token",
  "/nachtrag/:token",
  "/portal/:token",
  "/termin/:appointmentId/absagen",
  "/termin/:appointmentId/verschieben",
  "/termin/:appointmentId/antwort",
  "/besichtigung/:leadId/antwort",
  "/besichtigung/:token",
];

type ModuleFlags = Readonly<Record<ModuleKey, boolean>>;

/**
 * Articles the operator may see. An article whose module is switched off is hidden
 * from the index and from search, exactly like its sidebar link — but the Wiki itself
 * always stays reachable, so `moduleKey: null` articles are never filtered.
 */
export const visibleArticles = (flags: ModuleFlags = MODULES): readonly WikiArticleMeta[] =>
  WIKI_SLUGS.map((slug) => WIKI_REGISTRY[slug]).filter(
    (meta) => meta.moduleKey === null || flags[meta.moduleKey],
  );

/** Visible articles grouped by category, in the declared category order. */
export const articlesByCategory = (
  flags: ModuleFlags = MODULES,
): readonly { category: WikiCategory; articles: readonly WikiArticleMeta[] }[] => {
  const visible = visibleArticles(flags);
  return WIKI_CATEGORIES.map((category) => ({
    category,
    articles: visible.filter((meta) => meta.category === category),
  })).filter((group) => group.articles.length > 0);
};

/**
 * Previous/next within the article's own category, following registry order. Returns
 * `null` at either end rather than wrapping — wrapping suggests a loop that isn't one.
 */
export const prevNextFor = (
  slug: WikiSlug,
  flags: ModuleFlags = MODULES,
): { prev: WikiArticleMeta | null; next: WikiArticleMeta | null } => {
  const meta = WIKI_REGISTRY[slug];
  const siblings = visibleArticles(flags).filter((a) => a.category === meta.category);
  const index = siblings.findIndex((a) => a.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? siblings[index - 1] : null,
    next: index < siblings.length - 1 ? siblings[index + 1] : null,
  };
};

/** The daily-use guides promoted on the home page, in the order they are shown. */
export const DAILY_GUIDES: readonly WikiSlug[] = [
  "typischer-arbeitstag",
  "dashboard-uebersicht",
  "navigation-und-benachrichtigungen",
];
