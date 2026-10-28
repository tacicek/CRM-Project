# Claude Code Prompt — Independent CRM Architecture and Product Strategy Audit

You are acting as an independent principal software architect, product strategist,
security reviewer, and vertical-SaaS analyst.

Work inside the current `CRM-Project` repository. Your job in this turn is to inspect the
actual system, challenge the proposed product direction, and produce a decision memo. You
are not being asked to implement anything yet.

Write the final report in **Turkish**. Technical identifiers, filenames, table names, and
code symbols may remain in their original language.

## Mission

Determine, from first-hand repository evidence, all of the following:

1. What the system really is today, technically and functionally.
2. Which parts are mature, incomplete, duplicated, legacy, unsafe, or only documented but
   not actually deployed.
3. Whether the proposed product direction is supported by the current architecture and
   data model.
4. What would make this product unusually valuable to paying companies rather than merely
   adding more ordinary CRM features.
5. Which technical, security, operational, UX, and commercial foundations must be fixed
   before external companies should depend on it.
6. Which product investments should be made first, delayed, changed, or rejected.

The purpose is not to confirm an earlier opinion. The purpose is to produce a genuinely
independent second opinion before any implementation decision is made.

## Explicit authorization and hard boundaries

This is a **read-only analysis task**.

- Do not edit, create, delete, rename, or format any repository file.
- Do not install or update dependencies.
- Do not commit, push, open a pull request, deploy, or change production configuration.
- Do not apply migrations or invoke write-capable database operations.
- Do not send emails, messages, webhooks, notifications, or requests to configured business
  providers.
- Do not access or print secret values, `.env` contents, tokens, API keys, credentials,
  customer data, or raw production dumps.
- Do not clean or reset the worktree. Treat every existing modification and untracked file
  as user-owned.
- Do not silently repair a problem while investigating it. Record the finding and propose
  a later remediation.
- Safe local read commands and safe, existing, non-destructive checks are allowed.
- You may run the existing app type-check, lint, and unit-test commands if they are safe in
  the current environment. Do not run a command that resets a database, requires production
  access, sends network traffic to business providers, or has uncertain side effects.
- If a useful check cannot safely be run, say exactly why and continue with static evidence.

Start with `git status --short`. Do not alter what you find.

## Independence and evidence rules

Use these labels consistently in your notes and final report:

- **Verified:** directly supported by current source, schema, configuration, or a command
  you safely ran.
- **Inference:** a reasoned conclusion from multiple verified observations.
- **Proposal:** a recommended future change, not current behavior.
- **Unknown:** cannot be proven from the repository or safe local checks.

For every material claim:

- cite the most relevant `path/to/file:line` reference;
- distinguish code that exists from code that is reachable and deployed;
- distinguish a migration file from a migration proven to be applied;
- distinguish current behavior from comments, roadmaps, or intended behavior;
- distinguish a security smell from a confirmed exploitable path;
- state uncertainty instead of filling gaps with assumptions.

Do not treat README files, old audits, migration comments, generated types, or roadmaps as
automatically current. Compare them with the implementation. Repository dates alone do not
prove production deployment. Future-dated or untracked migrations must be reported as such,
not counted as live fixes.

Read `CLAUDE.md` for repository rules and historical context, but independently verify its
descriptions of the product. Some documentation may lag behind the current routes, schema,
portal, tenancy behavior, test setup, or TypeScript configuration. In a conflict, explain
the conflict and prefer current executable code plus the current production-parity schema
evidence.

Do not begin with the candidate ideas below. First build an evidence-based inventory of the
current system. Only then evaluate the hypotheses.

## Mandatory discovery

### 1. Repository and documentation

Read completely, where present:

- `CLAUDE.md`
- `README.md`
- `docs/SISTEM_PRD.md`
- `docs/CRM_CUSTOMER_360_ROADMAP.md`
- documentation for inbound email, the customer portal, deployment, database access, and
  integration testing;
- current review/audit documents, while treating their findings as potentially stale.

Inspect repository status, relevant configuration, package scripts, dependency choices,
and deployment topology. Do not expose secrets while doing so.

### 2. Frontend and product surface

Inspect at least:

- `src/App.tsx` and every current route;
- authenticated company layout, auth/company/i18n/theme providers, navigation, module
  flags, guards, and role handling;
- `src/pages/firma/`, `src/pages/public/`, relevant feature components, hooks, validation,
  and shared libraries;
- current Customer 360, lead, offer, revision, amendment, appointment, order, invoice,
  receipt, payment, case, inbox, task, KPI, portal, inspection, team, box, catalogue, and
  pricing flows;
- mobile behavior, accessibility, localization, PWA/offline behavior, loading/error states,
  pagination, caching, and large or tightly coupled components.

Build a route and capability map from implementation, not from navigation labels alone.

### 3. Data and domain model

Inspect:

- the current production-parity/sanitized schema baseline and parity manifest;
- forward migrations, rollback files, grants, RLS policies, triggers, indexes, constraints,
  functions, views, cron/job definitions, generated Supabase types, and drift checks;
- tenant/company scoping and composite foreign keys;
- canonical customer resolution, document snapshots, immutable evidence, offer versions,
  amendments, task/pipeline history, payment ledger/allocation, portal sessions, cases,
  communication threads, retention, and KPI computation;
- obsolete Offerio tables, functions, roles, subscription/trial concepts, or parallel domain
  models that remain reachable.

Record approximate current counts where they are useful, but identify the exact source and
snapshot date of those counts.

### 4. Backend, Edge Functions, and integrations

Inspect all current Edge Function directories, `supabase/config.toml`, shared auth helpers,
deployment scripts, and external adapters.

For each sensitive endpoint or RPC category, determine:

- intended caller: anonymous customer, authenticated employee, cron/internal worker, webhook
  provider, or service role;
- how identity, membership, tenant, resource ownership, and input are verified;
- whether `verify_jwt=false` is intentional and compensated inside the function;
- whether service-role use can bypass RLS before ownership is proven;
- idempotency, retry, replay, rate limiting, abuse cost, logging, and failure behavior;
- secret storage and whether secret material can reach the browser;
- storage privacy, signed URL use, retention, upload validation, and cross-session ownership.

Do not claim that every `SECURITY DEFINER` function or every `verify_jwt=false` function is
vulnerable. Trace real bodies, grants, callers, and guards. Prioritize demonstrated paths.

Inventory current integrations such as email, AI providers, geodata, PDF/QR billing, and
any accounting, bank, calendar, messaging, telephony, or payment connection that is actually
implemented.

### 5. Reliability, testing, and operations

Inspect:

- CI workflows and what they do and do not gate;
- unit, integration, database, Edge Function, and browser/E2E coverage;
- whether the migration chain can recreate a clean environment;
- generated-type drift and Edge config/directory parity;
- error monitoring, structured logs, tracing, audit logs, metrics, backup/restore, incident
  readiness, and deployment repeatability;
- synchronous external side effects, trigger failure handling, background jobs, outbox,
  retries, dead-letter handling, and idempotency.

If you run checks, report the exact command and result. Separate pre-existing failures from
your analysis.

## Architecture questions to answer

1. Is the current Supabase-based modular monolith appropriate for the next stage?
2. Where does the UI bypass a coherent application/use-case layer?
3. Which business rules correctly belong in PostgreSQL for atomicity, and which orchestration
   is creating hidden coupling there?
4. What are the actual security boundaries: frontend guards, RLS, RPC grants, Edge auth,
   service role, storage, and public tokens?
5. Is the product truly single-tenant, multi-company, or an incomplete mixture of both?
6. If it is sold to multiple customers, should the first model be managed dedicated
   instances or a shared multi-tenant SaaS? What concrete capabilities are missing for each?
7. Where will list size, query patterns, `select(*)`, client-side aggregation, caching, or
   giant tables/components become a scaling problem?
8. What must be introduced for durable messaging, workflow automation, integrations, and
   AI actions without prematurely splitting into microservices?
9. What parts of the present architecture are unusually strong and should not be rewritten?
10. What are the top stop-ship risks before onboarding external companies?

Include a compact current-state architecture diagram and a proposed target architecture
diagram. Prefer a modular monolith unless evidence clearly justifies something else.

## Product and market analysis

If internet access is available, research the current market using primary/official sources
and include direct links plus the date checked. Do not rely on unsourced memory for current
features, prices, regulations, or integrations. If web access is unavailable, explicitly
separate repository analysis from unverified market assumptions.

Compare representative categories, not just generic CRM brands:

- global CRM/revenue platforms;
- modern AI-native/composable CRM;
- revenue intelligence and customer-success platforms;
- field-service management products;
- moving-company software and virtual survey products;
- Swiss accounting, banking, QR-bill, eBill, and payment ecosystems.

At minimum, determine:

- which features are now commodity and will not create a moat;
- what leading products automate across lead, sale, delivery, success, and cash;
- where moving/cleaning/field-service products are ahead of this repository;
- where this repository already has a better foundation;
- which Swiss-local capabilities create a credible buying advantage;
- what target customer profile feels the pain most strongly;
- what measurable promise could justify switching from spreadsheets or an existing CRM;
- what should explicitly not be built in the next 12 months.

Do not attempt to list every CRM in the world. Choose representative leaders and vertical
products, explain the selection, and derive transferable patterns.

## Candidate product hypotheses to test — not assumptions

Evaluate each hypothesis only after completing current-state discovery. You may confirm,
modify, sequence later, or reject it.

### H1 — Positioning

Position the product not as a generic CRM, but as a **Swiss customer and revenue operating
system for moving, cleaning, storage, and adjacent field-service companies**.

Candidate measurable promise:

- respond to every new inquiry in under 60 seconds;
- turn a completed visual survey into a reviewable, margin-aware quote in under 15 minutes;
- identify missed or at-risk revenue in CHF;
- reconcile Swiss QR payments automatically;
- preserve traceable evidence for every scope change and completed job.

### H2 — Visual-to-Cash learning loop

Combine browser-based customer video/photo survey, access questions, AI inventory/volume/time
estimation, company pricing, crew/vehicle capacity, a three-option quote, customer acceptance,
deposit, field execution, actual time/cost/extras, invoicing, and payment reconciliation.

The proposed moat is not image recognition alone. It is the company-specific feedback loop
from estimate to operational and financial actuals. Determine whether the current schema
captures enough ground truth to support this, what is missing, and how model confidence and
human approval should work.

### H3 — Revenue Leak Radar

Translate unanswered leads, slow quotes, stale follow-ups, unviewed offers, underquoted work,
uncaptured extras, overdue invoices, unallocated payments, open cases, and recurring-service
risks into estimated CHF impact and one-click recommended actions.

Determine which signals are already reliable, which would produce misleading numbers, and
what minimum viable version can be built without fake precision.

### H4 — Governed AI Front Desk

Unify web, inbound email, WhatsApp, and later voice. Let AI identify/merge the customer,
qualify the request, ask for missing data, send a survey link, propose an appointment, draft
a quote or response, and escalate uncertain/high-impact actions for human approval.

Evaluate privacy, consent, language/Swiss-German constraints, audit, prompt/model registry,
evaluation, cost caps, replay, rollback, and permission boundaries.

### H5 — Swiss Money Autopilot

Build on the existing financial ledger with Swiss QR references, CAMT.053/054 import,
automatic reconciliation, partial/combined payments, dunning, Bexio first, then candidates
such as Abacus, eBill, and TWINT.

Verify what already exists and which integration order has the best value-to-effort ratio.

### H6 — Move-Day Truth / chain of proof

Provide an offline-capable crew experience with daily job packet, route, check-in/out, QR
inventory or box tracking, before/after condition photos, customer signature, scope extras,
amendment approval, incident capture, and later synchronization.

Evaluate whether a PWA is sufficient, what offline conflict model is required, and which
data should feed the estimate-versus-actual learning loop.

### H7 — Customer workspace / Portal 2.0

Turn the existing portal into a two-sided workspace for timeline, scope/inventory, documents,
uploads, appointment changes, payments, messaging, checklists, live status/ETA, amendments,
claims, reviews, and referrals.

Identify the smallest version that materially reduces office work without creating an
unmanageable customer-support surface.

### H8 — Recurring services

Add service contracts and recurring delivery for maintenance cleaning, storage, or similar
services: scope versions, recurring appointments, SLA/quality checks, renewals, health/risk,
price adjustment, and cross-sell.

Determine whether this strengthens the core vertical or distracts from moving operations.

### H9 — Commercialization model

Candidate model: begin with managed dedicated deployments for a narrow Swiss ICP, fast data
import/onboarding, a read-only “Revenue Leak Audit” as the acquisition product, and later a
real SaaS control plane. Consider fixed subscription, usage caps, and carefully bounded
outcome-based components.

Compare this with immediately building a shared multi-tenant SaaS. Account for provisioning,
entitlements, migrations, backups, observability, support, data residency, billing, and
upgrade orchestration.

## Generate additional ideas

Do not stop at the hypotheses above. Generate at least five additional ideas discovered
from repository assets, data that is already collected, workflow gaps, competitor gaps, or
Swiss-local requirements.

Reject novelty for novelty's sake. An idea is valuable only if it has:

- a clear target user and painful job to be done;
- a measurable business outcome;
- a believable path from the current system;
- acceptable privacy/security implications;
- a reason it is difficult for a generic CRM to copy or deliver well.

## Required scoring method

Score every candidate initiative from 1–5 on:

- customer pain;
- revenue/retention impact;
- differentiation;
- current-system readiness;
- implementation effort, where 5 means hardest;
- operational/security risk, where 5 means riskiest;
- time to first measurable value;
- evidence confidence.

Show the reasoning behind the score. Do not use a weighted total that hides important
trade-offs. Mark hard dependencies and mutually exclusive choices.

## Options, not a predetermined rewrite

For the recommended direction, compare at least these options:

1. **Minimal extension:** preserve current boundaries and add only the highest-value feature.
2. **Progressive modularization:** introduce application services, durable jobs/outbox,
   adapters, observability, and security standards while delivering product increments.
3. **Structural change:** larger data/platform/tenancy redesign.

For each, state:

- customer value;
- engineering effort;
- migration and regression risk;
- security/operations effect;
- reversibility;
- prerequisites;
- when the option is justified and when it is not.

Do not recommend microservices, a rewrite, a plugin marketplace, a custom foundation model,
or a generic CRM platform unless repository and market evidence makes that choice clearly
superior.

## Required final report

Return one self-contained Turkish report with the following sections:

1. **Yönetici özeti** — no more than ten decisive bullets.
2. **İnceleme kapsamı ve yöntem** — files/areas inspected, checks run, limitations.
3. **Sistemin gerçek mevcut mimarisi** — diagram, layers, counts, major dependencies.
4. **Uçtan uca mevcut ürün akışları** — what works today and where each flow stops.
5. **Korunması gereken güçlü temeller**.
6. **Mimari ve veri-modeli borçları** — severity and business consequence.
7. **Security/tenant/privacy review** — P0/P1/P2, verified versus suspected, with evidence.
8. **Reliability, testing, CI/CD, and operational readiness**.
9. **Current global and vertical market patterns** — official citations when available.
10. **Capability gap matrix** — current, partial, absent, legacy, or unknown.
11. **Hypothesis verdict table** — confirm, modify, postpone, reject, or more evidence needed.
12. **Additional original product ideas**.
13. **Prioritized impact/effort/readiness/risk matrix**.
14. **Recommended target architecture** — diagram and incremental transition, no code.
15. **Roadmap** — 0–6 weeks, 6–12 weeks, 3–6 months, 6–12 months. State team-size
    assumptions and dependencies.
16. **Go-to-market and packaging recommendation** — ICP, buying trigger, onboarding,
    deployment model, proof-of-value offer, and measurable promises.
17. **What not to build in the next 12 months**.
18. **Open questions and evidence still needed**.
19. **Final decision** — choose exactly one:
    - `GO`
    - `GO WITH CONDITIONS`
    - `NO-GO`
    - `MORE EVIDENCE NEEDED`

For the final decision, specify:

- decision scope — exactly what is or is not being approved;
- the three strongest reasons;
- blocking conditions;
- the first reversible step;
- confidence level from 0–100%;
- what new evidence would most likely change the decision.

## Quality bar

- Lead with conclusions, not a diary of commands.
- Be candid. Do not flatter the existing system or exaggerate problems.
- Prefer a smaller number of decisive recommendations over a feature dump.
- Explain why each recommendation matters commercially, not only technically.
- Use tables where comparison helps and concise prose elsewhere.
- Cite local evidence with exact file and line references.
- Cite current external claims with direct official links and the date checked.
- Never present estimated market data, price, compliance, or deployment status as fact
  without a source.
- Explicitly identify contradictions between documentation and implementation.
- Do not ask questions mid-analysis. Make safe assumptions, finish the review, and place
  unresolved questions at the end.

## Final instruction

Do not implement anything in this turn. Inspect the repository once, produce the full
evidence-based decision memo, and stop. We will review the report together before deciding
whether to plan or build any feature.
