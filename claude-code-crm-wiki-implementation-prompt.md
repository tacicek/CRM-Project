# Claude Code prompt — Build the CRM in-app Wiki / Help Center

You are a senior product engineer, UX writer, information architect, accessibility
specialist, and QA engineer. Work directly in the current `CRM-Project` repository and
complete this task end to end. Do not stop after producing a plan or a documentation
outline. Implement the working in-app Wiki, write the actual help content, capture the
actual screenshots, validate the result, and leave the repository ready for review.

## Mission

Build a searchable, visual, multilingual in-app Wiki / Help Center for the CRM. It must
explain every user-facing section and the important end-to-end workflows using:

- real screenshots captured from the current application;
- the real interface labels and states;
- real `lucide-react` icon components, never emoji as instructional icons;
- very simple, respectful language for users who have limited experience with business
  software or low digital confidence;
- short, numbered instructions that show what to click, what happens next, and what not to
  do.

This is an operator manual, not developer documentation. A user should be able to complete
the ordinary workday without needing verbal training.

## Explicit authorization and boundaries

- You are explicitly authorized to make the multi-file changes required for this Wiki;
  do not pause merely because the change spans more than five files.
- You may add a dev-only browser automation dependency such as Playwright, and a dedicated
  local screenshot fixture/capture setup, when no suitable browser tool is already
  available.
- Do not commit, push, deploy, send emails, call external providers, or change production
  data.
- Do not add production database tables for Wiki content. The Wiki is static, typed,
  version-controlled content. Test-only infrastructure for safe screenshot generation is
  allowed.
- Do not change CRM business behaviour merely to make screenshots easier.
- Preserve all pre-existing user changes. Start with `git status`, treat every existing
  modification/untracked file as user-owned, and do not clean, reset, overwrite, or include
  unrelated changes.
- Never edit generated `dist/`, dependency caches, or `node_modules/` by hand.
- Follow `CLAUDE.md` and the repository conventions. No `any`, no barrel exports, no silent
  error swallowing, no hard-coded secrets, no frontend service-role key, and no RLS bypass.
- The current source code is the final truth. `docs/SISTEM_PRD.md` and
  `docs/CRM_CUSTOMER_360_ROADMAP.md` are valuable context, but parts of older documentation
  may lag behind the current routes and features. Verify every instruction against the
  current UI and domain code before documenting it.

## Repository context you must respect

- Frontend: React 18, Vite 7, strict TypeScript, React Router, Tailwind, shadcn/Radix.
- Icons: `lucide-react` is already installed and code-split as `vendor-icons`.
- Backend: Supabase/Postgres/Auth/Storage/Edge Functions.
- UI data access is mostly direct Supabase plus hooks; do not introduce a new Wiki backend.
- Operator UI is localized in German, French, and English through the existing lazy catalog
  system. Operator Wiki chrome uses `useT()` / `useI18n()`.
- Customer-facing pages choose the stored customer/document language through
  `documentI18nFor(...)`. Do not accidentally use the operator language in customer-view
  explanations or screenshots.
- Use the existing `folk-*` colour tokens, spacing, card style, typography, responsive
  conventions, and shadcn primitives. The Wiki must look native to this CRM.
- Existing active product areas now include Customer 360, offer versions, Nachtrag,
  pipeline tasks, payment ledger, customer portal, customer cases, communication threads,
  and lifecycle KPIs. Do not write the Wiki as if these were future ideas.
- The dedicated `supabase-test` DB suite has API/Auth disabled and is not automatically a UI
  screenshot environment. Do not point the application at it and assume login will work.
  Build or use a separately guarded, isolated, synthetic UI fixture environment if needed.

## Mandatory discovery before implementation

Before changing code:

1. Read `CLAUDE.md` completely.
2. Read the current `docs/SISTEM_PRD.md`, `docs/CRM_CUSTOMER_360_ROADMAP.md`,
   `docs/INBOUND_EMAIL_UEBERBLICK.md`, and the i18n README/instructions.
3. Inspect `src/App.tsx`, `src/components/firma/FirmaLayout.tsx`,
   `src/config/modules.ts`, all `src/pages/firma/*.tsx`, all `src/pages/public/*.tsx`, the
   relevant feature hooks/components, and the current German source catalogs.
4. Inventory every visible nav item, nested detail/form route, important dialog, public
   customer page, role restriction, status transition, destructive action, and known
   limitation.
5. For each help article, identify the actual source route and source component(s). Never
   infer an action from a translation key alone; confirm that the current UI exposes it.
6. Run the existing type-check and unit test baseline before implementation. Record any
   pre-existing failure and do not hide it.

Do not ask me to choose a visual design, content hierarchy, or file layout. Make sound
decisions from the existing application and complete the work.

## Current route and section inventory to verify

The following inventory is a starting point, not permission to skip discovery.

### Visible operator navigation

Quick access:

- `/firma` — Overview / Dashboard
- `/firma/anfragen` — Requests / leads
- `/firma/email-import` — Inbound email review queue
- `/firma/kalender` — Calendar

Main area:

- `/firma/kunden` and `/firma/kunden/:id` — Customer list and Customer 360 card
- `/firma/aufgaben` — Follow-up tasks / Wiedervorlage
- `/firma/finanzen` — Finance overview and payment ledger
- `/firma/faelle` — Damage, complaint, recleaning, and service-change cases
- `/firma/posteingang` — Customer communication thread overview
- `/firma/kennzahlen` — Lifecycle KPIs
- `/firma/offerten` — Offers
- `/firma/auftraege` — Orders / jobs
- `/firma/quittungen` — Receipts
- `/firma/rechnungen` — Invoices

Operations:

- `/firma/besichtigungen` — Inspections and virtual inspections
- `/firma/umzugsboxen` — Moving-box rentals
- `/firma/team` — Team members, vehicles, equipment, and reminder settings
- `/firma/checkliste` — Checklist templates and PDFs

Administration:

- `/firma/leistungskatalog` — Service catalogue and offer templates
- `/firma/preisgestaltung` — Pricing configuration and surcharges
- `/firma/datenarchiv` — Export and controlled archive/purge
- `/firma/einstellungen` — Company, language, PDF, notifications, email, SMS, reminders,
  AGB, and AI settings

### Nested/operator routes that also need help coverage

- `/firma/manual-import`
- `/firma/offerten/neu`
- `/firma/offerten/:id`
- `/firma/offerte-bearbeiten/:offerId`
- `/firma/nachtrag/:id`
- `/firma/rechnungen/neu`, `/firma/rechnungen/:id`
- `/firma/quittungen/neu`, `/firma/quittungen/:id`, and the edit route

### Customer-facing routes staff must understand

- `/offerte/:token`
- `/nachtrag/:token`
- `/portal/:token` and `/portal`
- appointment cancellation/rescheduling/response routes
- inspection proposal response and `/besichtigung/:token`

The Wiki itself should be an authenticated operator feature, for example:

- `/firma/hilfe`
- `/firma/hilfe/:slug`

Use the final German navigation label `Hilfe & Anleitung`, with equivalent French and
English labels.

## Product and information architecture

### 1. Entry points

Add all of the following:

1. A clearly labelled `Hilfe & Anleitung` entry near the bottom of the CRM sidebar using
   the real Lucide `CircleHelp` (or the most semantically suitable equivalent) icon.
2. A contextual help action in the CRM header. It must map the current route, including
   detail routes, to the most relevant Wiki article. On narrow screens it may become an
   icon button, but it must retain an accessible label and tooltip.
3. A searchable Wiki home page with:
   - a prominent search box;
   - “What do you want to do?” task cards;
   - categories that mirror the CRM's mental model, not just an alphabetical list;
   - recently important or daily-use guides;
   - a beginner path called “Start here”.

Do not present an icon without a visible label in normal desktop navigation. Icons support
recognition; they do not replace words.

### 2. Recommended Wiki categories

- Start here
- Requests, customers, and sales
- Offers and customer approval
- Planning and service delivery
- Invoices, receipts, and payments
- Customer service and communication
- Reports and daily control
- Setup and administration
- What the customer sees
- Status and terminology glossary

### 3. Required task-based journeys

Write cross-module guides for at least these real journeys:

1. A new email arrives → review it → approve/create the request → open the request → create
   an offer.
2. Enter a request manually → verify customer details → create and send an offer.
3. Draft offer → choose services/pricing/payment terms/AGB → preview → save or send.
4. Sent offer needs changes → create a new version instead of editing the locked version.
5. Customer accepts an offer → find/create the Auftrag → plan it in the calendar.
6. Accepted scope changes → create, send, and monitor a Nachtrag.
7. Create or confirm an inspection; explain virtual inspection and what the customer sees.
8. Complete an Auftrag → create an invoice or receipt → record payment.
9. Partial payment or overpayment → allocate it correctly; reverse a wrong payment using a
   counter-entry, not deletion.
10. Create a one-time customer portal link → send it safely → process an incoming customer
    data-change request → revoke access when necessary.
11. Handle an overdue follow-up task and record a lost reason correctly.
12. Register and close a damage/complaint/recleaning case with a traceable resolution.
13. Review unanswered communication threads and explain the current mail-client handoff.
14. Configure services/prices/checklists before preparing the first offer.
15. Export/archive data safely and understand which actions are irreversible or restricted.

Each journey must link to the relevant detailed section articles.

## Required article coverage

Create complete articles, not placeholders, for at least the following topics. Split or
merge them only when doing so clearly improves comprehension, while retaining total feature
coverage.

### Start and daily work

- Signing in, choosing the company, changing dashboard language, signing out
- Sidebar, notifications, sounds/push notifications, and mobile navigation
- A simple “typical workday” checklist
- Roles and permissions: owner, admin, member; describe only verified differences
- Status and terminology glossary

### Requests and Customer 360

- Dashboard / Overview
- Requests list: filters, request details, edit, delete restrictions, inspection, offer
- Manual import, including AI/voice extraction only if currently exposed
- Inbound email review: status tabs, extracted fields, approve, reject, retry, open lead
- Customer list: search, person/company/duplicate filters, activity and open amounts
- Customer card: contact, notes, totals, timeline, links to records
- Duplicate review and irreversible merge; owner/admin restriction
- Customer portal access and customer change requests
- Follow-up tasks, priorities, due/overdue, reopen, related request/offer
- Sales stages and lost reasons

### Offers and approval

- Offer list, filters, statuses, resend, calendar/Job actions
- Creating an offer: service dates, items, catalogue, moving calculator, optional services,
  price models, surcharges, payment terms, customer language, AGB, PDF preview
- Draft save versus send
- Offer detail, public link, PDF, customer view, viewed/accepted/rejected evidence
- Editing a draft
- Why a sent offer is locked
- Creating and understanding an offer revision/version
- Creating, editing, sending, accepting, and rejecting a Nachtrag
- What the customer sees on the public offer and Nachtrag pages

### Planning and service delivery

- Calendar views, filters, new/edit appointment, drag/resize if supported, recurring
  appointments, confirm/cancel/complete, export
- Inspections, appointment proposals, virtual inspection link, photos, analysis, completion
- Auftrag list, statuses, team assignment, extra services, completion, PDF, cancellation
- Moving-box rental lifecycle, pickup/return, deposit/document and overdue states
- Team members, vehicles, equipment, availability/week view, reminders
- Checklist templates, sections/items, drag/reorder, preview, PDF, copy between services

### Finance

- Invoice list and invoice creation/editing
- QR invoice/PDF/email and due date
- Finance overview: collected/open/overdue/drafts/credits/unmatched
- Recording full, partial, cash, QR, TWINT, card, and other payments
- Allocation, overpayment, unmatched amounts, and payment reversal
- Explain that invoice status follows recorded payments and is not a manual “paid” switch
- Receipts: draft, signatures if exposed, send, payment entry, PDF
- Credit notes and reminders/Mahnung, but only where the current UI exposes an action
- Never present receipt totals and invoice payments as two independent revenue sources

### Customer care and reporting

- Cases: types, priorities, assignment/take-over, statuses, closing result and audit trail
- Inbox/communication threads: incoming/outgoing indicator, unanswered/open/done filters
- State the current limitation accurately: only preview text is stored and replying from the
  CRM is not yet configured; users must use their normal mail application
- KPI ranges, funnel numerator/denominator, durations, customers/LTV, cash/open claims,
  quality cases, lost reasons, inbox metrics
- Explain that offer-series KPIs count the series, not every revision

### Setup and administration

- Service catalogue: included/optional/other services, categories, units, templates
- Pricing: team rates, surcharges, service settings, templates, preview/reset/save
- Checklist setup
- Company profile, logo/signature, document template, operator language versus customer
  document language
- Notification/reminder settings
- Resend/Twilio/AI configuration without ever displaying or documenting a real key
- AGB/service template management
- Export and controlled archive/purge, role restriction, retention, and irreversible actions

Do not document `service_locations` or any database structure as a user-facing feature if
there is no current UI for it. Explain visible behaviour, not planned schema.

## Required article format

Every section article must contain:

1. **What this is for** — one short paragraph.
2. **When to use it** — two to five concrete examples.
3. **Before you begin** — prerequisites and permissions only when needed.
4. **Step by step** — numbered, one action per step, exact visible button/field labels.
5. **Real screenshot(s)** — overview plus focused screenshots for complex actions.
6. **What happens next** — status changes, automatic records/messages, and where to continue.
7. **Status meanings** — only where the screen has statuses.
8. **Common mistakes** — short prevention-oriented explanations.
9. **If something goes wrong** — safe recovery actions; never teach an RLS/security/accounting
   bypass.
10. **Related guides** and an “Open this screen” link when the route is safe and meaningful.

For destructive or irreversible actions, place a visually distinct warning immediately
before the relevant step. For role-restricted actions, show a `ShieldCheck` callout that
names the permitted role(s), based on verified code/RLS/RPC behaviour.

## Language and reading-level rules

- Provide complete content parity in German, French, and English. German is the source
  locale, consistent with the app, but French and English must not be partial or placeholder
  translations.
- German uses clear formal `Sie`, French uses `vous`, and English uses direct plain `you`.
- Aim for CEFR A2–B1 / approximately grade-6 reading level.
- Prefer short sentences, common words, active voice, and concrete verbs such as “Open”,
  “Choose”, “Check”, and “Save”.
- Explain unavoidable business terms such as Offerte, Auftrag, Nachtrag, Mahnung, Quittung,
  and Wiedervorlage in the glossary and on first use.
- Avoid developer words such as RPC, RLS, row, migration, JSON, token hash, database trigger,
  or state machine in operator-facing copy.
- Do not write paragraphs longer than three short sentences.
- Do not use emoji as headings, bullets, status symbols, or instructional icons.
- Use the exact localized labels visible in the current app. If a label differs between
  locale catalogs, the corresponding article must use that locale's actual label.
- Do not promise unsupported behaviour. Examples: do not say users can reply inside the
  CRM when Posteingang explicitly hands replies off to the normal mail client.

## Real icon requirements

- Use typed `lucide-react` components for Wiki categories, articles, task cards, warnings,
  permissions, tips, search, print, zoom, previous/next navigation, and the Help entry.
- Create a small, explicit typed icon registry. Do not dynamically import Lucide icons by
  arbitrary string and do not copy SVG source into content.
- Prefer the same icon already used by the real screen/action. When none exists, choose a
  stable semantic icon.
- Decorative icons use `aria-hidden="true"`; meaningful icon buttons require an accessible
  name and tooltip.
- Always pair category/action icons with text. Colour alone must never carry meaning.
- Do not mix a new Lucide Help link into an emoji-only nav in a visually broken way. If the
  clean integration requires converting the CRM sidebar's existing emoji menu markers to a
  consistent Lucide icon mapping, do that as one coherent, tested refactor while preserving
  labels, routes, badges, grouping, active states, and mobile behaviour. Do not replace
  unrelated emojis inside domain content merely for cosmetic consistency.

## Screenshot requirements — non-negotiable

### What counts as a real screenshot

A screenshot must be captured from the current running React application at the current
commit. A recreated mock card, an AI-generated picture, a Figma-style approximation, or a
manually drawn replacement is not acceptable.

### Privacy and environment safety

- Never capture production, staging with real customers, or a developer's existing live
  company.
- Never connect a screenshot script to a non-loopback Supabase/API URL.
- Use only a dedicated, guarded local UI environment with clearly synthetic data such as
  `Max Muster`, `Sara Beispiel`, `Test Umzug AG`, `example.test` emails, and non-sensitive
  example values.
- The screenshot command must fail closed when its base URL is not loopback or when the
  expected dedicated local project marker/identity is absent.
- Do not reuse the destructive DB-test runner against an unidentified stack. If a separate
  Auth/API-enabled local Wiki fixture stack is needed, give it a unique project/container
  identity and ports, add explicit guards, and document start/bootstrap/capture/stop.
- No service keys, AI keys, Resend/Twilio credentials, access tokens, magic-link tokens,
  personal email addresses, real phone numbers, notification contents, or browser developer
  UI may appear in an image.
- For Settings screenshots, secret fields must be empty/masked and no network/devtools panel
  may be visible.
- Customer portal screenshots must use synthetic data and must not display the one-time link
  or session value.
- The capture flow must not send email/SMS/WhatsApp, call AI providers, or invoke destructive
  archive/delete actions.

### Capture quality

- Use deterministic fixture records covering meaningful non-empty states: request, customer,
  duplicate warning, draft/sent/viewed/accepted/rejected offers, a revision, a Nachtrag,
  appointments, Auftrag, invoice, partial payment, receipt, task, case, communication thread,
  box rental, and relevant admin settings.
- Freeze or control the clock for screenshots so “today”, due, overdue, and relative-date
  labels are repeatable.
- Wait for loading indicators and animations to finish before capture.
- Capture an overview screenshot for every visible top-level section.
- Capture focused element/dialog screenshots for complex flows. Do not shrink a whole
  1,500-pixel page into an unreadable image when a real locator crop explains the action
  better.
- Capture the Wiki screenshots in all three dashboard locales so the text inside the image
  matches the article locale. Use the same fixture state and crop across locales.
- Capture desktop at a consistent viewport such as 1440×1000. Also capture mobile examples
  for first-time navigation and at least the highest-frequency journeys: Requests, Offers,
  Calendar, Customers, Tasks, Finance, and the customer portal.
- Store final assets under a predictable path such as
  `public/wiki/screenshots/{de,fr,en}/...`.
- Keep only optimized WebP/AVIF assets in the repository. Use `sharp`, which is already a
  dependency, to remove metadata, preserve legibility, and keep normal images reasonably
  small. Temporary PNG files belong under `/tmp`, not the repository.
- Set explicit image width/height, use lazy loading below the fold, and prevent layout shift.
- Provide click/tap to zoom using existing Dialog primitives.
- Use localized captions and useful alt text. “Screenshot of the page” is not useful alt
  text.
- Prefer numbered HTML/CSS hotspots layered over the real image for callouts. Keep hotspot
  coordinates/data typed and localizable; do not bake translated explanatory text into the
  bitmap.

### Reproducible screenshot tooling

Create a documented and repeatable command, for example `npm run wiki:capture`, plus a
fixture/bootstrap command if necessary. It must:

1. verify the isolated local environment;
2. create/reset only its own synthetic records;
3. authenticate as a synthetic owner/member as needed;
4. switch locale deterministically;
5. navigate and prepare each documented state;
6. capture and optimize images;
7. stop with a clear error rather than writing blank/login/error screenshots;
8. never require committed credentials.

Prefer an already available browser automation capability. If none exists, add Playwright
as a dev dependency and use semantic role/label selectors rather than brittle CSS paths.
Do not fake screenshots if browser automation is blocked; solve the isolated local harness
properly and document any genuinely external blocker.

## Suggested technical architecture

Use a small, maintainable, typed feature structure. Adapt names when the repository gives a
better fit, but preserve the principles below:

```text
src/
  pages/firma/Hilfe.tsx
  features/wiki/
    wikiTypes.ts
    wikiIcons.tsx
    wikiRegistry.ts
    wikiRouteMap.ts
    wikiSearch.ts
    components/
      WikiHome.tsx
      WikiArticleView.tsx
      WikiSearch.tsx
      WikiFigure.tsx
      WikiCallout.tsx
    content/
      de/<article>.ts
      fr/<article>.ts
      en/<article>.ts
scripts/
  validate-wiki.mjs
  capture-wiki-screenshots.mjs
public/wiki/screenshots/{de,fr,en}/...
docs/WIKI_MAINTENANCE.md
```

Do not create barrel `index.ts` files. Long localized article content should live in
dedicated lazy-loaded content modules rather than one giant component or the normal UI
catalog. Keep only short Wiki UI chrome labels in the existing i18n catalogs. Use
`satisfies` against explicit article types and avoid unsafe casts.

The article schema should support at least:

- stable slug/id;
- locale;
- title, short description, category, keywords/synonyms;
- related app routes and feature/module key;
- real Lucide icon key;
- estimated reading time or difficulty only if it helps users;
- prerequisites/permissions;
- typed step blocks, warning/tip/permission callouts, status tables;
- localized screenshots, captions, alt text, and optional numbered hotspots;
- related article slugs;
- last verified date/current commit metadata for maintenance.

Use `import.meta.glob` or an equivalent Vite-supported lazy mechanism so the full Wiki and
all screenshots do not inflate initial CRM startup. Do not introduce a CMS, remote search
service, or database-backed editor.

## Search and navigation behaviour

- Search localized titles, summaries, keywords, task names, button names, and common
  synonyms. Normalize case and diacritics. A small dependency-free ranking is sufficient.
- Include common term pairs, for example Angebot/Offerte, Aufgabe/Wiedervorlage,
  Rechnung/Invoice, Zahlung/Payment, Kunde/Customer, and their French equivalents.
- Search results must be keyboard accessible and show category plus a short excerpt.
- Add breadcrumbs, previous/next article, related guides, and a table of contents for longer
  articles.
- Preserve article anchors in the URL and restore scroll position sensibly.
- The contextual header help mapping must handle dynamic paths, not only exact routes.
- If a module is disabled by `MODULES`, hide its article from the normal Wiki index/search,
  while keeping the registry validation explicit. The Wiki itself must remain reachable.
- Add a print-friendly article layout and a real `Printer` icon action; printing must omit
  app navigation and interactive controls while retaining steps/captions.

## Accessibility and responsive requirements

- Meet WCAG 2.2 AA for the new Wiki UI.
- Semantic headings must not skip levels.
- Use proper `nav`, `main`, `article`, `figure`, `figcaption`, ordered lists, tables, and
  buttons/links.
- Keyboard users must be able to search, select results, navigate the table of contents,
  open/close screenshot zoom, and return to the triggering control.
- Maintain visible focus, sufficient contrast, 44×44 touch targets where practical, and
  reduced-motion support.
- Never rely on colour, screenshot position, or icon shape alone; captions and text must
  explain the action.
- The article layout must remain readable at 320px width, ordinary mobile sizes, tablet,
  and desktop. Avoid horizontal scrolling except in a deliberately scrollable data table.

## Known product truths the Wiki must explain accurately

Verify these in current code, then reflect them accurately:

- Customers are normally created/resolved from requests, offers, and documents; do not
  invent a manual “New customer” workflow if the current screen does not expose one.
- Customer merge is irreversible and restricted to owner/admin.
- A sent offer is content-locked. Changes require a new offer version/revision.
- A Nachtrag supplements an accepted offer and is accepted/rejected separately; it locks
  after sending.
- The customer portal uses a one-time magic link. The generated link is shown once, and
  customer data changes wait for operator approval.
- Invoice paid/open state follows the payment ledger and allocations; users should not be
  trained to flip a paid status manually.
- Wrong payments are reversed with a counter-entry rather than deleted.
- Posteingang stores previews, not full message bodies, and cannot currently send replies.
- Customer-facing document/portal language and operator dashboard language are different
  concepts.
- Data archive/purge and accounting actions have role/status restrictions. Never encourage
  bypassing them.
- The application is a customer lifecycle CRM, not payroll, GPS, route optimization, or a
  marketplace/token/subscription platform.

## Maintenance and anti-drift requirements

Add `npm run wiki:validate` and a validation script that fails when:

- a visible CRM nav route has no Wiki article mapping;
- an article slug/category/icon is invalid or duplicated;
- one locale is missing an article/block required by the German source article;
- a related article or anchor is broken;
- a referenced screenshot file is missing;
- a screenshot has no localized caption/alt text;
- a route-to-help mapping points to a non-existent article;
- content contains forbidden placeholders such as TODO, lorem ipsum, “screenshot coming”,
  or fake example URLs.

Add focused tests for:

- route-pattern → article mapping, including detail routes;
- localized article parity;
- search normalization/ranking and synonyms;
- module filtering;
- image manifest/metadata;
- at least one keyboard/accessibility flow for search and screenshot zoom.

Write `docs/WIKI_MAINTENANCE.md` explaining, concisely:

- how to add/update an article in all locales;
- how to create/update synthetic screenshot state;
- how to run safe capture and validation;
- how to update route coverage after adding a CRM section;
- image naming/size/privacy rules;
- how reviewers confirm screenshots still match the current UI.

## Verification

At minimum, run and report:

1. `npm run type-check`
2. the CRM source lint scope (do not fix unrelated `vibecosystem` lint issues)
3. `npm test`
4. `npm run wiki:validate`
5. the screenshot capture command against the isolated local fixture environment
6. a production Vite build to an isolated `/tmp` output when practical
7. browser smoke checks for:
   - Wiki home/search;
   - a long article;
   - contextual help from an exact and dynamic CRM route;
   - locale switching;
   - screenshot zoom;
   - desktop and mobile layouts;
   - print layout;
   - keyboard navigation and basic automated accessibility checks.

Visually inspect representative screenshots. A command succeeding is not proof that the
image is useful: reject login screens, loaders, empty error states, cropped labels, tiny
text, exposed secrets, real personal data, or images that do not match the article.

## Definition of done

The task is complete only when all of these are true:

- The authenticated CRM has a native-looking Help/Wiki entry and contextual help.
- Every current visible section and important nested/public workflow is documented.
- The content is complete in German, French, and English.
- The wording is simple enough for a first-time, low-confidence software user.
- Instructional icons are real Lucide components with visible labels, not emoji.
- Real, readable, localized screenshots exist and were captured from the current app using
  synthetic local data only.
- The screenshots cover non-empty, useful states and complex dialogs where needed.
- Search, route context, related guides, zoom, responsive layout, accessibility, and print
  view work.
- Wiki content/assets are lazy-loaded and do not materially regress initial CRM loading.
- Validation prevents silent route/content/locale/image drift.
- No production data, credentials, keys, tokens, emails, or external side effects were used.
- Existing CRM workflows and the user's unrelated working-tree changes remain intact.
- Type-check, relevant lint, tests, Wiki validation, build, screenshot capture, and browser
  smoke checks have been run, with honest results.

## Final response format

Lead with the completed outcome. Then provide:

1. the implemented Wiki routes and entry points;
2. article and screenshot counts per locale/category;
3. the synthetic screenshot environment and exact maintenance commands;
4. key UX/accessibility decisions;
5. every verification command and its result;
6. any genuine remaining blocker, with no claim of completion if real screenshots or
   required locale content are missing;
7. a concise list of changed files grouped by purpose.

Do not call a scaffold, placeholder article set, screenshot manifest without images, or
German-only partial implementation “done”.
