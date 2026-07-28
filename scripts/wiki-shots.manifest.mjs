/**
 * What the capture script photographs, declaratively.
 *
 * One entry per image *family*: the script multiplies each by the locales and viewports
 * it declares, so a single entry can produce six files. Adding a screenshot to an article
 * means adding an entry here — never a new branch in the capture script.
 *
 * Selector guidance: prefer roles and structure over text. A `getByText("Übersicht")`
 * locator would need a per-locale variant and would silently pick the wrong element when
 * a translation changes; `getByRole("heading", { level: 1 })` works in all three
 * languages and is what the article is pointing at anyway.
 *
 * @typedef {"de"|"fr"|"en"} Locale
 * @typedef {"desktop"|"mobile"} Viewport
 *
 * @typedef {object} Shot
 * @property {string} id              File stem, e.g. "dashboard-uebersicht".
 * @property {string} route           Path to open, e.g. "/firma".
 * @property {boolean} [anonymous]    Capture WITHOUT a session (the sign-in page).
 * @property {Locale[]} [locales]     Defaults to all three.
 * @property {Viewport[]} [viewports] Defaults to ["desktop"].
 * @property {string} [clip]          CSS selector to crop to. Omit for the full viewport.
 * @property {number} [clipPad]       Extra pixels around the crop. Default 0.
 * @property {(page: import("playwright-core").Page) => Promise<void>} [prepare]
 *                                    Read-only interactions only — open a menu, switch a
 *                                    tab. Never submit, never delete.
 * @property {string} [readySelector] Must exist before the shot is taken.
 * @property {{selector: string, min: number}} [minCount]
 *                                    Structural proof the screen is not empty.
 * @property {string[]} [mask]        Selectors painted over before the PNG is written.
 */

/** @type {Shot[]} */
export const SHOTS = [
  {
    id: "anmeldung-formular",
    route: "/auth",
    anonymous: true,
    // The sign-in screen sits outside the dashboard's I18nProvider, so it is German for
    // every operator whatever their language. It is still captured once per locale: the
    // three files are identical today, but each article then references its own locale's
    // path (which the validator checks), and if /auth is ever localized the next capture
    // just produces the right images with no article edits. The French and English
    // captions say plainly that this screen is German.
    viewports: ["desktop", "mobile"],
    readySelector: "input#email",
    mask: ["input[type='password']"],
  },
  {
    id: "dashboard-uebersicht",
    route: "/firma",
    viewports: ["desktop", "mobile"],
    readySelector: "h1",
    // Five seeded requests; if RLS or the seed regressed this drops to zero and the run
    // fails instead of writing an empty-looking dashboard.
    minCount: { selector: "h1", min: 1 },
  },
  {
    id: "seitenleiste",
    route: "/firma",
    clip: "aside",
    readySelector: "aside a[href='/firma/hilfe']",
  },
  {
    id: "kopfzeile",
    route: "/firma",
    clip: "header",
    clipPad: 4,
    readySelector: "header h1",
  },
  {
    id: "hilfe-startseite",
    route: "/firma/hilfe",
    viewports: ["desktop", "mobile"],
    readySelector: "input[type='search']",
  },

  // --- Kunden ----------------------------------------------------------------------
  {
    id: "kunden-liste",
    route: "/firma/kunden",
    viewports: ["desktop", "mobile"],
    readySelector: "h1",
    // Five customers created by the lead trigger plus two seeded ones.
    minCount: { selector: "input[type='text'], input:not([type])", min: 1 },
  },
  {
    id: "kundenkarte",
    // The customer id belongs to the trigger, not to the fixtures, so it cannot be a
    // literal here. Open the list and click the first row instead — which is also how
    // an operator reaches the card.
    route: "/firma/kunden",
    readySelector: "h1",
    prepare: async (page) => {
      await page.locator("[role='button'], .cursor-pointer").first().click();
      await page.waitForURL(/\/firma\/kunden\/[0-9a-f-]{36}/, { timeout: 15000 });
      await page.waitForTimeout(900);
    },
  },

  // --- Finanzen --------------------------------------------------------------------
  {
    id: "finanzen-uebersicht",
    route: "/firma/finanzen",
    viewports: ["desktop", "mobile"],
    readySelector: "h1",
  },
  {
    id: "finanzen-zahlungseingaenge",
    route: "/firma/finanzen",
    readySelector: "h1",
    // Switch to the ledger tab. Read-only: it changes no data.
    prepare: async (page) => {
      await page.getByRole("button").filter({ hasText: /Zahlung|paiement|Payment/i }).first()
        .click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(700);
    },
  },

  // --- Rechnungen ------------------------------------------------------------------
  {
    id: "rechnungen-liste",
    route: "/firma/rechnungen",
    viewports: ["desktop", "mobile"],
    readySelector: "h1",
  },
  {
    id: "rechnung-formular",
    route: "/firma/rechnungen/neu",
    readySelector: "h1",
  },

  // --- Offerten --------------------------------------------------------------------
  {
    id: "offerten-liste",
    route: "/firma/offerten",
    viewports: ["desktop", "mobile"],
    readySelector: "h1",
    // Five displayed statuses live in the fixture; if the seed regressed this drops and
    // the run fails rather than writing a half-empty list.
    minCount: { selector: "tbody tr, [class*='rounded-xl']", min: 4 },
  },
  {
    id: "offerte-detail",
    // The accepted offer: it is the only state that shows "Nachtrag erstellen" and the
    // Auftrag button, which the detail article points at.
    route: "/firma/offerten/{acceptedOfferId}",
    readySelector: "h1",
  },
  {
    id: "offerte-version-gesperrt",
    // The superseded version 1 — shows the "neuere Version" banner and, because it is
    // locked, no send controls.
    route: "/firma/offerten/{supersededOfferId}",
    readySelector: "h1",
  },
  {
    id: "offerte-erstellen",
    route: "/firma/offerten/neu?leadId={leadId}",
    readySelector: "h1",
  },
  {
    id: "nachtrag-formular",
    route: "/firma/nachtrag/{nachtragId}",
    readySelector: "h1",
  },

  // --- Anfragen --------------------------------------------------------------------
  {
    id: "anfragen-liste",
    route: "/firma/anfragen",
    viewports: ["desktop", "mobile"],
    readySelector: "h1",
    minCount: { selector: "article", min: 3 },
  },
  {
    id: "anfrage-details",
    route: "/firma/anfragen",
    readySelector: "article",
    // Open the read-only detail dialog. Read-only interaction: nothing is submitted.
    prepare: async (page) => {
      await page.getByRole("button", { name: /^Details$/ }).first().click({ timeout: 8000 });
      await page.waitForSelector("[role='dialog']", { state: "visible", timeout: 8000 });
      await page.waitForTimeout(700);
    },
  },
  {
    id: "anfrage-importieren",
    route: "/firma/manual-import",
    readySelector: "textarea",
  },
  {
    id: "email-eingang",
    route: "/firma/email-import",
    viewports: ["desktop", "mobile"],
    readySelector: "h1",
  },

  // --- Aufträge & Kalender ---------------------------------------------------------
  {
    id: "auftraege-liste",
    route: "/firma/auftraege",
    viewports: ["desktop", "mobile"],
    readySelector: "h1",
    minCount: { selector: "tbody tr", min: 4 },
  },
  {
    id: "auftrag-formular",
    route: "/firma/auftraege",
    readySelector: "h1",
    // Open the work-order modal. Read-only: nothing is saved.
    prepare: async (page) => {
      // The three literals of `auftrag.new`, read from the catalogs rather than guessed:
      // "Neuer Auftrag" / "Nouveau mandat" / "New job".
      await page.getByRole("button", { name: /Neuer Auftrag|Nouveau mandat|New job/i })
        .first().click({ timeout: 8000 });
      await page.waitForSelector("[role='dialog']", { state: "visible", timeout: 8000 });
      await page.waitForTimeout(900);
    },
  },
  {
    id: "kalender",
    route: "/firma/kalender",
    viewports: ["desktop", "mobile"],
    readySelector: "h1",
    // Switch to the week view: the month grid opens on the 1st and the seeded
    // appointments fall below the fold, so a month screenshot teaches nothing.
    // `calendar.view.week` is "Woche" / "Semaine" / "Week".
    prepare: async (page) => {
      await page.getByRole("button", { name: /^(Woche|Semaine|Week)$/i })
        .first().click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1200);
    },
  },
  {
    id: "termin-formular",
    route: "/firma/kalender?newAppointment=true",
    readySelector: "[role='dialog']",
    prepare: async (page) => {
      await page.waitForTimeout(900);
    },
  },
];

/**
 * Viewport geometry, in the shape Playwright's `newContext` expects.
 *
 * Note the nesting: width/height go inside `viewport`. Passing them at the top level is
 * silently ignored and you get Chromium's 1280×720 default — which looks plausible in a
 * file listing and only shows up as a wrong-sized screenshot.
 *
 * Mobile is captured at deviceScaleFactor 2 so the small text stays legible when a reader
 * zooms; desktop stays at 1 to keep the repo small.
 */
export const VIEWPORTS = {
  desktop: {
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

export const ALL_LOCALES = ["de", "fr", "en"];
