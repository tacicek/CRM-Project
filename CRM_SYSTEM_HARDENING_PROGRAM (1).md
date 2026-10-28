# CRM System Hardening and Product Certification Program

**Project:** CRM Hirschen / Offerio-derived CRM  
**Prepared from snapshot bundles:** CRM, Offerte, Logic, i18n, Wiki, Edge, DB, Docs  
**Program objective:** turn the current daily-use CRM into a deliberately multi-tenant, multilingual, security-hardened system whose customer-facing and financial workflows are demonstrably correct end to end.

---

## 0. Operating role

Act as a principal product engineer, PostgreSQL/RLS security engineer, document-system engineer, and release auditor. Work from the actual repository and production evidence, not from comments or intended architecture. Treat a UI control, configuration entry, migration file, type definition, and documentation statement as an untrusted claim until its effect is traced to the final computation, persisted row, generated document, outgoing message, or authorization decision.

The job is not merely to identify defects. The job is to remove their causes incrementally, prove each corrected contract, and leave permanent gates that stop the same defect class from returning.

Do not attempt a single giant rewrite or a single giant PR. Execute this program in ranked, reviewable tranches. Each tranche must leave the system in a deployable state and must have its own evidence bundle.

---

## 1. Definition of “production-grade” for this CRM

The CRM is considered certified only when all of the following are true:

1. A user working in company A can never read, mutate, send, print, export, or schedule data under company B unless explicitly authorized for B and B is the selected active tenant.
2. A German-speaking operator can create, preview, send, expose publicly, accept, convert, invoice, and receipt a French- or English-speaking customer without German customer-facing text leaking into the chain.
3. Every monetary label and control that appears in the UI or a document reaches the calculation it claims to govern; otherwise it does not exist.
4. Every customer-facing document is reproducible from a frozen, auditable snapshot. Later template edits cannot silently change what a customer was shown.
5. Every Edge Function and `SECURITY DEFINER` RPC has one explicit, tested authorization model. The self-hosted gateway configuration is not treated as an authorization boundary when it is not one.
6. The repository, deployed Edge source, database schema, migration state, configuration, generated Supabase types, and current documentation describe the same system.
7. Removed Offerio marketplace/billing functionality has no active runtime, deployment, route, grant, config entry, current documentation claim, or user-visible branding. Historical append-only migrations and truthful post-mortems remain intact.
8. A failure is visible and actionable. No silent fallback, swallowed exception, default German text, stale query response, or “success” toast may conceal a failed side effect.
9. Each business module has a named owner, lifecycle contract, tenant contract, language contract, data-integrity checks, security boundary, and release evidence.
10. Production changes are reproducible and attributable; manual changes without a ledger cease from the new baseline onward.

Absolute zero defects cannot be promised by prose. The deliverable is a system of contracts and release gates that makes silent, cross-tenant, mixed-language, or deployment-drift defects difficult to introduce and quick to detect.

---

## 2. Verified starting findings that set the priority

These are starting facts from the supplied snapshot and the dated production-truth capture. Re-verify them against the current checkout and current production before changing anything.

### F-001 — tenant selection is split-brain and can affect legal/financial output

**VERIFIED in snapshot.** `logic/src/lib/fetchSingleCompanyForUser.ts` does not read the currently selected company. With more than one membership, it guesses by matching login e-mail and otherwise returns the newest company. Multiple `/firma` pages still call it.

A concrete high-risk example exists in `crm/src/pages/firma/Rechnungen.tsx`: invoice-list data is scoped through the active company context while full company identity, address, IBAN, and related document fields are fetched through `fetchSingleCompanyForUser()`. The two sources can resolve to different companies.

**Risk:** a document or detail surface can combine company A business rows with company B creditor identity, bank details, or branding. This outranks ordinary UI defects.

### F-002 — the French offer selector is a lying surface

**VERIFIED in snapshot.** `offerte/src/pages/firma/OfferteErstellen.tsx` and `OfferteBearbeiten.tsx` persist `offers.language`, but changing the picker only changes locale state. Text already generated or snapshotted into title, item descriptions, payment terms, or terms remains in its previous language unless the operator rewrites it manually.

The create page comment claims that title, item descriptions, payment terms, AGB, PDF, and e-mail resolve the document locale. The picker does not actually rebase all those stored texts.

**Risk:** an offer marked `fr` can produce a mixed German/French customer document and e-mail while the UI claims French.

### F-003 — the offer spell checker is German-only but is called for every document locale

**VERIFIED in snapshot.** `logic/src/lib/spellCheckService.ts` sends only `{ fields }`. `edge/supabase/functions/spell-check-ai/index.ts` hardcodes German/Swiss-German correction rules, including German noun capitalization and `ß → ss`, and explicitly says not to translate.

**Risk:** French or English content is processed under German orthographic rules and may be damaged or incorrectly “corrected.”

### F-004 — translation storage exists, but the document pipeline does not consistently consume it

**VERIFIED in snapshot.** The multilingual migration adds translation payloads for company defaults, service items, AGB sections, checklist templates, and Leistungsübersicht templates. Runtime offer creation still reads raw company/template payment and terms fields in several paths. `ContentTranslationDialog` is wired to Leistungskatalog but not actually wired to AGB and checklist management. The checklist e-mail attachment reads raw checklist fields rather than localized translation payloads.

**Risk:** translation columns create confidence without guaranteeing translated output. Public view, PDF, and e-mail attachment can disagree.

### F-005 — silent German fallback hides missing customer-document data

**VERIFIED in snapshot.** `i18n/src/i18n/localizedField.ts` falls back to the German base value when a requested translation is absent or blank.

That fallback can be useful for operator preview, but it is unsafe as a final-send policy. A French offer can silently pass with German legal, catalog, checklist, or payment text.

**Required distinction:** resilient preview may fall back; customer send/publication must run a strict readiness check and identify every missing mandatory translation.

### F-006 — sent terms are not guaranteed to be frozen at first send

**VERIFIED in snapshot.** Public token RPCs can resolve current active AGB/checklist templates. Acceptance evidence hashes the content available at acceptance. Therefore a template edit between first send and customer acceptance can alter what the public page displays and what is later evidenced, even when the original PDF/e-mail attachment was different.

**Risk:** weak evidentiary integrity and irreproducible customer documents.

### F-007 — the self-hosted Edge gateway is open; handler self-auth is the real boundary

**VERIFIED in dated production capture, NEEDS CURRENT PRODUCTION CHECK.** The 2026-08-09 production-truth record measured `VERIFY_JWT=false` and only CORS on the Kong functions route. Per-function `verify_jwt` declarations in `supabase/config.toml` did not form the live boundary.

**Risk:** every deployed function is internet-reachable at the gateway. Security depends entirely on each handler's own JWT/member, capability-token, signed-webhook, cron-secret, or deliberately-public checks.

### F-008 — repository, config, and production Edge inventory disagree

**VERIFIED in dated production capture, NEEDS CURRENT PRODUCTION CHECK.** The 2026-08-10 capture showed deployed functions without repo source (`accept-lead`, `hello`, `main`), config entries without source, source functions missing from config, and source-only functions not deployed. Several deployed hashes differed from the current snapshot.

**Risk:** code review cannot establish what production executes; retired Offerio functionality can survive only in production.

### F-009 — the codebase is already multi-tenant in reality

**VERIFIED in snapshot and supplied production facts.** `CompanyProvider` / `useCompanyContext` support multiple companies and active-company switching. Production has two companies. `companies`, `company_members`, `company_id`, membership helpers, and tenant-scoped RLS are no longer removable Offerio residue; they are the security spine.

**Decision:** deliberately re-embrace tenancy. Remove single-company guessing, not tenant structure.

### F-010 — the old CRM entitlement flag is semantically inconsistent

**VERIFIED in snapshot.** `CrmGuard` is effectively a no-op because the fork is described as a standalone CRM, while `import-manual-lead` and `extract-anfrage-ai` still reject companies whose `crm_enabled` is false. `manual_import_monthly_fee` is fetched by the UI but not used to govern a coherent product rule.

**Risk:** the UI offers a feature while the backend rejects it with an old Offerio entitlement concept.

### F-011 — active Offerio residue still exists, but not every “portal” or company table is residue

**VERIFIED in snapshot.** Active strings remain in calendar/ICS product IDs and the virtual viewing footer. Old website layout/legal/marketing files contain Offerio branding and appear unreferenced. `supabase/config.toml` and deployment inventory retain removed marketplace-era function names.

At the same time, the current `/portal` is a substantial CRM customer area using magic-link/session RPCs. It must be classified by behavior and product decision, not deleted merely because the word “portal” appears.

### F-012 — there is no trustworthy applied-migration history

**VERIFIED from supplied documentation.** Migration files are append-only but have historically been applied manually, and file presence does not prove production application. Edge Functions are also manually deployed.

**Risk:** schema and runtime claims remain probabilistic until measured.

---

## 3. Non-negotiable constraints

1. Do not mutate existing historical `offers` or `offer_items` through repair migrations, backfills, normalization scripts, or language conversion. Produce read-only exception reports for existing records. New behavior applies to future drafts/versions.
2. Do not resurrect Stripe, billing, token balances, subscription tiers, marketplace lead distribution, public partner registration, or removed Offerio portal behavior.
3. Do not weaken RLS, table grants, function grants, or tenant checks to make a feature work.
4. Never expose `service_role` to browser code. Every service-role query must carry its own explicit tenant boundary.
5. Existing migrations are immutable. Corrections use new forward migrations.
6. No silent `try/catch`, swallowed side effects, fallback success, `as any`, untyped RPC bypass, production `console.log`, or barrel exports.
7. Dashboard language and customer-document language remain separate axes. Customer-facing renderers receive locale explicitly and never read operator locale from React context.
8. SIX-normed QR-invoice labels remain normed and are not freely translated.
9. No from-scratch rewrite unless a bounded subsystem is proven impossible to repair incrementally.
10. No production write, deploy, e-mail, token revocation, or data cleanup during audit/preflight stages.
11. Historical migrations and truthful post-mortems may retain the Offerio name. “Zero residue” applies to active runtime, deployment, configuration, current product documentation, active UI, and user-visible output—not to erasing history.
12. Sent customer documents must become immutable snapshots; editing a sent business document must create an explicit new revision/successor rather than silently changing the represented content.

---

## 4. Architectural decisions

### D-001 — deliberate multi-tenancy

The system must be treated as a multi-tenant CRM, even if it serves only two companies today.

- Active tenant selection is explicit.
- No `/firma` code may discover or guess a company.
- Every query cache key includes `companyId` where data is tenant-owned.
- Tenant switching cancels/invalidates prior requests and clears tenant-scoped transient state.
- Every browser mutation is scoped by row RLS and explicit company context.
- Every `SECURITY DEFINER` function checks membership or validates a capability whose row contains the tenant.
- Every service-role Edge query filters by the tenant derived from an authenticated membership, signed payload, or capability row—never directly trusted from a request body.

### D-002 — document locale is persisted identity, not display preference

For every customer-facing entity, the document locale is frozen at creation and passed explicitly through:

`lead/customer language → offer language → appointment/order language → invoice/receipt language → e-mail/public page/PDF`

Changing language in a future draft is an explicit rebase operation that reports exactly which generated fields will be regenerated and which manual fields cannot be translated safely.

### D-003 — snapshots and templates have different roles

- Templates are mutable authoring sources.
- Drafts may reference template provenance.
- First send freezes a document snapshot.
- Public views and acceptance evidence read the frozen snapshot.
- Later template edits affect only future snapshots.

### D-004 — one active implementation per contract

There must be one canonical implementation for:

- tenant resolution,
- document-locale resolution,
- pricing totals,
- offer-item metadata interpretation,
- timezone conversion,
- customer-facing document composition,
- capability-token validation,
- Edge authentication patterns,
- deployment inventory and migration state.

Competing helpers or duplicate business formulas are either consolidated or explicitly separated by contract and tested against each other.

### D-005 — production truth outranks repository intent

The desired state is declared in the repository, but current state is measured from production. Changes are not considered complete until deployed artifacts and catalog state match the declared manifest.

---

## 5. Work management and evidence rules

Maintain a repository-tracked hardening ledger with one row per task:

`ID | module | defect class | evidence | severity | desired contract | implementation | tests | production check | status`

Use these labels consistently:

- **VERIFIED:** directly proven from current source, test output, DB catalog, or deployed source.
- **HYPOTHESIS:** plausible but not yet proven.
- **NEEDS-PRODUCTION-CHECK:** depends on live deployment/schema/data.
- **REFUTED:** tested and shown not to be true.

Every tranche produces:

1. preflight state and commit SHA;
2. exact files/objects in scope;
3. before evidence;
4. implementation summary;
5. targeted contract tests;
6. full build/test/lint impact;
7. migration verification against a disposable/local DB;
8. production rollout plan and rollback boundary;
9. post-deploy read-only verification commands;
10. residual risks and deliberately deferred work.

No item closes because “the code looks right.” It closes only when the relevant behavior is observed at the final boundary.

---

## 6. Standard module certification rubric

Every module listed in section 8 must pass all applicable gates below.

### 6.1 Tenant and authorization

- What is the tenant-owned root row?
- Where does `companyId` come from?
- Does every read/mutation cache key include it?
- What does RLS actually allow?
- Which RPCs are `SECURITY DEFINER`, who can execute them, and where is membership/capability checked?
- Which Edge Functions use service-role, and what explicit company filter is present?
- Does active-tenant switching cancel stale responses and reset local state?
- Two-company test: company A's user cannot observe company B's row, count, attachment, search hit, e-mail metadata, or storage object.

### 6.2 Data completeness and integrity

- Required fields at every lifecycle transition.
- Null, orphan, duplicate, cross-tenant-FK, status/date, numbering, and amount inconsistencies.
- Source provenance for generated snapshots.
- Referential behavior on archive/delete.
- Idempotency for retries, webhooks, scheduled jobs, and public actions.
- Read-only production exception query and count.
- No historical repair unless explicitly permitted.

### 6.3 Lifecycle/state machine

- Enumerate legal states and legal transitions.
- Identify every UI, RPC, trigger, and Edge path that changes state.
- Reject impossible transitions in one canonical layer.
- Verify timestamps/audit evidence are set consistently.
- Verify repeated requests are idempotent.

### 6.4 Language and document behavior

- Separate operator and customer locale.
- Freeze customer locale at creation.
- Trace every customer-facing string to its source.
- Strict translation readiness before send/publish.
- Ensure PDF, e-mail body, attachments, public page, SMS, calendar feed, and follow-up documents agree.
- Verify DE/FR/EN end to end with an operator locale different from customer locale.

### 6.5 Calculation and derived data

- Identify all controls and fields that claim to affect totals or decisions.
- Trace each to the canonical calculation.
- Recompute and compare persisted/document totals read-only.
- Reject duplicate formulas or prove their equivalence with contract tests.
- Include tax, surcharges, discounts, grouped price models, partial payments, credits, and rounding.

### 6.6 External side effects

- Authentication and tenant selection.
- Recipient and sending identity.
- Idempotency key/ledger.
- Failure/retry/recovery behavior.
- PII-safe logs.
- No successful UI state when required side effect failed.
- No rollback of the business row merely because a notification failed; instead expose the failed delivery state.

### 6.7 Repo/config/production parity

- Migration applied-state evidence.
- Generated type parity.
- Edge source digest parity.
- `config.toml` parity.
- Environment contract and secret source.
- Current docs match actual behavior.

### 6.8 Residue and misleading surfaces

- Dead code and unreferenced assets.
- Legacy columns/config/functions still reachable.
- Names/comments/docs that state a false contract.
- Feature flags/fees that no longer have coherent semantics.
- Controls that do not reach computation/output.
- Safe deletion order: callers → traffic verification → undeploy/revoke → config removal → source deletion.

### 6.9 Recovery and observability

- Operator can see failures and retry safely.
- Auditable delivery/state history.
- Alerts for auth failures, cross-tenant guard failures, cron failures, document generation failures, and drift.
- Correlation ID across UI action, RPC/Edge invocation, e-mail log, and business row where appropriate.

---

## 7. Prioritized execution roadmap

### P0 — establish current production truth and freeze the target

**Impact: Critical | Effort: Medium | No production writes**

1. Capture a new read-only production-truth record dated with the actual execution date.
2. Record:
   - DB version and schema object inventory;
   - table RLS/force-RLS state;
   - direct/effective grants;
   - policies;
   - function owner, security mode, ACL, definition hash;
   - anon/authenticated/service-role executable functions;
   - scheduled jobs and invoked URLs;
   - Edge runtime `VERIFY_JWT` and gateway plugins;
   - deployed function names and whole-tree hashes;
   - repo/config/deploy set differences;
   - deployed source for deploy-only functions, sanitized without leaking secrets;
   - environment-variable names, never values;
   - live counts needed for later read-only integrity checks.
3. Compare deployed hashes against the exact current commit, not the dated snapshot.
4. Create a desired-state Edge manifest and migration baseline manifest.
5. Do not invent a historical migration ledger. Establish a signed baseline from this date forward.
6. Pause unrelated feature deployment until P0 and the critical P1 contracts are closed.

**Exit gate:** current production is reproducibly described; every drift item is named; no unmeasured “probably deployed” statements remain.

---

### P1A — eliminate tenant split-brain in business and financial workflows

**Impact: Critical | Effort: Medium/High**

1. Make `CompanyProvider` / `useCompanyContext` the only source of active tenant under `/firma`.
2. Introduce an explicit helper such as `fetchCompanyById(companyId, select)` only where a direct query is not sufficient. It must never infer a company from the user.
3. Replace all `/firma` imports/calls of `fetchSingleCompanyForUser()` in this order:
   - invoices and invoice detail;
   - receipts and receipt detail;
   - offer create/edit/detail/list;
   - orders;
   - settings and data archive;
   - manual/e-mail import;
   - pricing, catalog, checklist, and team.
4. Change `Auth.tsx` from “resolve exactly one company” to “resolve eligible memberships and establish an active tenant.”
5. Remove `fetchSingleCompanyForUser()` after the last production caller is gone. Add a static guard that fails if it is reintroduced under `/firma`.
6. Ensure every query/mutation and TanStack key is tenant-keyed.
7. On tenant switch, cancel/invalidate pending tenant queries and clear tenant-scoped modal/form state.
8. For every financial/customer document, derive company identity from the business row's `company_id` and assert it equals active context before mutation. Public/token renderers derive it from the token-resolved row, not browser state.

**Named contract tests:**

- company A active + company B newest membership must still load A settings;
- A invoice PDF contains A name/IBAN/logo and never B's;
- switch A→B while a slow A request is in flight; A response cannot populate B screen;
- opening B offer under A context fails closed without leaking existence;
- service-role document generation carries the row-derived company filter.

**Exit gate:** zero `/firma` production imports of `fetchSingleCompanyForUser`; two-tenant integration suite passes for offers, orders, invoices, receipts, settings, and imports.

---

### P1B — repair and certify the French/English offer chain

**Impact: Critical | Effort: High**

#### 1. Define one document-locale resolver

Create one pure canonical function implementing:

`row language → explicit source entity language → company default → German`

Use it in frontend, Edge Functions, public renderers, PDF/e-mail builders, and future entities. Invalid locale values fail validation rather than silently becoming German at send time.

#### 2. Make spell checking locale-aware

- Change `runSpellCheck(fields)` to `runSpellCheck(fields, locale)`.
- Validate `locale` as `de | fr | en` in the Edge handler.
- Use language-specific correction prompts.
- Preserve Swiss German rules only for `de`.
- Correct grammar/spelling only; never translate.
- Include locale in request logs without content.
- Reject unsupported/missing locale rather than assuming German.

#### 3. Replace passive language switching with an explicit rebase workflow

Changing a draft language must not merely mutate `offers.language`.

Create a pure `buildOfferLanguageRebasePlan()` that classifies every affected field:

- deterministic generated title: safe to regenerate;
- catalog-sourced item label/description: safe only when source provenance and translation exist;
- default payment terms / company terms / AGB / checklist / Leistungsübersicht: safe when localized source exists;
- free-form operator text: never auto-translate silently;
- already-sent document: immutable; create a new revision/successor.

The UI presents the plan before applying it, lists missing translations, and preserves manual text unless the operator explicitly chooses a supported translation action.

#### 4. Add source provenance for future offer-item snapshots

For future rows only, add nullable provenance such as:

- `source_service_item_id` with safe FK behavior;
- `content_origin` constrained to values such as `catalog | generated | manual`;
- optionally source content/version hash.

Do not backfill or rewrite historical offer items. Generate a read-only report showing historical rows whose source cannot be recovered.

#### 5. Wire translation authoring for every consumed template

Provide actual DE/FR/EN editing and completeness state for:

- company default payment/terms text;
- service-specific offer templates;
- company service items;
- AGB sections;
- checklist templates;
- Leistungsübersicht templates.

Do not leave a comment claiming a translation dialog exists when the UI does not expose it.

#### 6. Add strict document readiness validation

Create a pure validator that receives the fully resolved offer-document input and returns structured blockers/warnings.

Block first send/publication when mandatory customer-facing content lacks the selected locale. At minimum validate:

- offer title and item text;
- payment terms;
- applicable AGB;
- checklist attachment when enabled;
- Leistungsübersicht labels/content;
- customer e-mail subject/body keys;
- public offer labels;
- PDF renderer labels;
- follow-up appointment/order handoff language.

Preview may display marked fallback text; final send must never silently substitute German for required French/English content.

#### 7. Freeze document snapshots at first send

Incrementally add a snapshot/version model for future sends containing the exact normalized payload used by:

- offer PDF;
- e-mail body and attachments;
- public offer page;
- acceptance evidence.

The public token view and acceptance hashing must read the same frozen version. AGB/checklist/template edits after send must not alter that version.

Do not modify existing sent offers. Produce a read-only legacy exposure report and preserve their current evidence.

#### 8. Certify the entire mixed-locale chain

Required integration scenario:

- operator dashboard locale: `de`;
- customer/document locale: `fr`;
- create from lead;
- add catalog and manual items;
- preview PDF;
- run spell check;
- send e-mail with PDF/AGB/checklist attachments;
- open public offer;
- accept;
- create appointment/order;
- generate invoice and receipt;
- verify all customer-facing text is French while operator chrome stays German.

Repeat the contract for `en`. Add a negative case where one mandatory French translation is missing and the send is blocked with the exact missing source identified.

**Exit gate:** no German-only service is invoked for FR/EN; every customer surface agrees on locale and snapshot; no silent German fallback at send.

---

### P1C — close the highest-exposure Edge/RPC security gaps

**Impact: Critical | Effort: Medium/High**

1. Build a tracked `edge-auth-manifest` containing every function and exactly one model:
   - `jwt-member`;
   - `capability-token`;
   - `signed-webhook`;
   - `cron-secret`;
   - `public-safe`;
   - `tombstone`.
2. For `jwt-member`, verify JWT, membership status/role, and row/company relationship inside the handler or a shared audited helper.
3. For capability-token functions, use high-entropy tokens, hashed storage where appropriate, expiry/revocation, narrow response shape, uniform failure response, rate limiting, and no PII in URLs beyond the capability itself.
4. For webhooks/cron, verify signatures/shared secret, replay/idempotency, and source-specific limits.
5. For service-role handlers, inventory every table query and require explicit tenant predicates. Add two-company negative tests.
6. Recapture and review all remaining `anon`-executable RPCs individually. Maintain a narrow allowlist for public token flows; revoke everything else through append-only migrations with fail-closed catalog verification.
7. Verify whether direct external Postgres access can make broad table privileges exploitable. Regardless, replace broad default grants with least privilege through measured migrations.
8. Remove/decommission deploy-only `accept-lead`, `hello`, and `main` after checking current logs/callers. Remove config-only marketplace/token functions whose source no longer exists. Reconcile every hash-drifted deployed function.
9. Retired admin function tombstones remain until caller/traffic absence is proven; then undeploy before deleting source.
10. Rotate any credential if current production/source inspection finds a real literal secret. Do not rotate merely because a historical hypothesis named a file; first verify current reality.

**Exit gate:** every deployed function is classified and tested; no unclassified deployed source; repo/config/deploy sets and hashes match; public RPC allowlist is explicit and catalog-verified.

---

### P2 — establish document, monetary, and state integrity

**Impact: High | Effort: High**

#### 2.1 Canonical document graph

Define and enforce the chain:

`lead/customer → offer version → accepted offer → order → invoice/receipt/credit/payment`

For every edge, verify same tenant, expected predecessor state, immutable identifiers, language propagation, currency/tax assumptions, and snapshot provenance.

#### 2.2 Monetary contract audit

For offers, amendments, invoices, receipts, credits, and payments:

- enumerate every amount-bearing field and UI control;
- identify the one canonical computation;
- compare UI/PDF/e-mail/public-view totals to it;
- include price model, grouped pricing, item metadata, quantity/unit, VAT, surcharge, discount, rounding, partial payments, payment allocation, and credit notes;
- generate read-only discrepancy reports for historical rows;
- never repair historical offers automatically.

A control that is not consumed by the canonical computation must be removed, renamed as informational, or connected correctly. It may not remain decorative.

#### 2.3 State machines

Codify legal transitions for at least:

- lead/request;
- offer and amendment;
- appointment;
- order;
- invoice/receipt/credit/payment;
- box rental;
- customer case/task;
- portal/session/change request;
- viewing/proposal flows.

All transition paths—UI, direct table mutation, RPC, trigger, Edge Function, cron—must route through or obey the same contract.

#### 2.4 Read-only production data audit

Generate machine-readable reports, without changing rows, for:

- null/invalid tenant ownership on tenant tables;
- cross-tenant parent/child or business-chain relationships;
- orphans and dangling references;
- duplicate business numbers/tokens/identities where uniqueness is expected;
- invalid language/status/type values;
- impossible timestamp/state combinations;
- accepted/sent records lacking required evidence;
- amount recomputation mismatches;
- expired/revoked public capabilities still usable;
- secrets/capabilities copied into audit history/logs;
- storage objects whose path/metadata tenant does not match the owning row;
- translation readiness by company and locale;
- active Offerio-era rows/tables with no current owner or business use.

Each report states: query, row count, affected IDs in a protected operator artifact, business risk, and permitted remediation. Historical offer data remains read-only.

**Exit gate:** all high-impact data contradictions have an owner and an approved non-destructive treatment; new writes cannot create the same contradiction.

---

### P3 — make migration and deployment state reproducible

**Impact: High | Effort: Medium**

1. Establish a migration ledger from a signed current baseline forward. Do not fabricate prior history.
2. Record migration version, checksum, applied timestamp, environment, actor/tool, and transaction result.
3. CI rejects edited historical migrations and duplicate versions.
4. Each new migration includes:
   - explicit privileges/RLS behavior;
   - transaction boundary where possible;
   - fail-closed catalog assertions for security-sensitive objects;
   - rollback consequence documentation, even when rollback is intentionally not provided.
5. Generate Supabase types from the verified target schema and fail CI on drift.
6. Create an Edge desired-state manifest with function name, tree hash, auth model, required env names, and deployment status.
7. Replace ad-hoc `scp + restart` with a reproducible deploy command/pipeline that verifies hashes after deployment. If full automation is deferred, the manual process still writes the same ledger and performs the same verification.
8. Add a post-deploy read-only smoke suite covering tenant isolation, public tokens, e-mail dry-run transport, document generation, and core RPC grants.

**Exit gate:** a reviewer can answer exactly which migration and Edge source production runs, and can reproduce the deploy from the repository.

---

### P4 — certify every product module

**Impact: High | Effort: High, incremental**

Run the section 6 rubric over each module in this order:

1. **Auth, memberships, active company, roles, company secrets**
2. **Customers, addresses, deduplication/merge, customer portal access**
3. **Leads, inbox, manual import, e-mail import, confirmations, quality validation**
4. **Offers, amendments, pricing, catalog, AGB, checklist, Leistungsübersicht, public offer**
5. **Appointments/calendar, resources, recurrence, reminders, public cancellation/reschedule, ICS feed**
6. **Orders and viewing/proposal/photo/AI workflows**
7. **Invoices, receipts, credit notes, payments, allocations, reminders, finance/KPIs**
8. **Moving boxes and pickup reminders**
9. **Tasks, customer cases, communication threads/messages**
10. **Settings, archives, data export/deletion, company-level configuration**
11. **Wiki/help and current product documentation**
12. **Public/legal/marketing remnants and route inventory**

For each module, create a certification report and close all critical/high findings before moving to lower-severity cosmetic issues. Shared defects discovered in one module become platform tasks and are fixed once at the canonical source.

**Exit gate:** every active route, table, RPC, trigger, cron job, Edge Function, document renderer, and e-mail template belongs to exactly one certified module or is explicitly retired.

---

### P5 — remove active Offerio residue safely

**Impact: Medium/High | Effort: Medium**

#### Active residue to investigate and remove/rename

- Offerio product IDs in ICS/calendar output;
- Offerio links/footer on virtual viewing;
- active legal/marketing/layout components with Offerio branding;
- stale Offerio integration documentation and environment variable names;
- `config.toml` marketplace/token function declarations without live source;
- deployed `accept-lead` and other marketplace distribution endpoints;
- entitlement/billing fields such as `crm_enabled`, `manual_import_monthly_fee`, `token_balance`, subscription/payment tables when they have no coherent current runtime contract;
- unscoped Offerio-era intake/pricing tables and RPCs;
- comments and current architecture documents that still claim “one company only” or “no portal” when current behavior differs.

#### Do not delete by name alone

- `companies`, `company_members`, `company_id`, membership helpers, and RLS are load-bearing tenancy infrastructure.
- The current CRM customer portal may be intentional. Decide explicitly whether it is retained as **Kundenbereich** or decommissioned. If retained, rename/document/audit it; if removed, revoke sessions/tokens and remove routes/RPCs in a controlled sequence.
- Historical append-only migrations, rollback rationale, incident reports, and truthful fork post-mortems retain historical terminology.
- Tombstone handlers are temporarily load-bearing fail-closed endpoints until production traffic and callers are proven absent.

#### Deletion sequence

1. prove no active caller/traffic;
2. remove UI/import/caller;
3. revoke grants or disable route where appropriate;
4. undeploy/drop active object;
5. remove config declaration;
6. remove source/dead types/assets;
7. regenerate types and docs;
8. verify no active references remain.

**Exit gate:** repository runtime search, route manifest, config, deployed inventory, DB object inventory, and current docs contain no active Offerio marketplace/billing behavior or user-visible Offerio branding.

---

### P6 — permanent release gates

**Impact: High | Effort: Medium**

Add only tests that pin known load-bearing contracts:

1. Two-tenant isolation for each service-role Edge function and major business chain.
2. Active-company switch stale-response test.
3. Invoice/receipt/offer company-identity consistency.
4. DE-operator/FR-customer and DE-operator/EN-customer full offer chains.
5. Strict translation-readiness blocker.
6. PDF/e-mail/public-view snapshot byte/content consistency.
7. Price-model and item-metadata contract tests from UI input to persisted row to PDF total.
8. State-transition and repeated-request idempotency tests.
9. Edge auth manifest completeness and handler-specific negative tests.
10. RPC grant/RLS catalog assertions on a disposable database.
11. Migration checksum/append-only guard.
12. Repo/config/deploy manifest parity.
13. Generated Supabase type drift check.
14. No active `fetchSingleCompanyForUser`, active Offerio brand strings, unclassified public function, or new silent locale fallback on send paths.
15. Customer-facing renderer import guard: it cannot import operator locale context.

Release must fail when any of these contracts fails. Existing global lint debt may be burned down incrementally, but touched files have zero errors and the total cannot increase.

---

## 8. Module inventory and key contracts

| Module | Primary surfaces | Highest-risk contract |
|---|---|---|
| Identity/tenancy | Auth, CompanyProvider, memberships, roles | selected company is the only browser tenant; membership is verified |
| Leads/import | Anfragen, Posteingang, ManualImport, EmailImport, inbound Edge | source attribution, dedupe, tenant ownership, idempotent ingestion |
| Customers | Kunden, KundeDetail, addresses, merge | no cross-tenant merge/read; immutable business-history references |
| Offers | create/edit/detail/list, PDF, e-mail, public view | locale + price + snapshot + tenant all agree |
| Amendments | Nachtrag, public amendment | predecessor/tenant/price/evidence integrity |
| Catalog/terms | Leistungskatalog, AGB, checklist, templates | localized source completeness and provenance |
| Orders | Auftraege | accepted offer creates exactly one correct tenant/language job |
| Calendar | Kalender, appointment RPCs/Edge/feed | resource conflict, timezone, token security, tenant feed filter |
| Viewing | Besichtigungen, AI/photo/proposals | capability scope, PII/storage tenant path, state idempotency |
| Finance | Rechnungen, Quittungen, Finanzen, credits/payments | company identity, numbering, tax/rounding/allocation correctness |
| Team/resources | Team, availability, resources | tenant scoping and booking conflicts |
| Boxes | Umzugsboxen, pickup cron | state/date/reminder idempotency |
| Tasks/cases/comms | Aufgaben, Faelle, threads/messages | tenant and customer linkage; auditable state |
| Settings/secrets | Einstellungen, company-secrets, pricing | active tenant only; secrets never exposed by company reads |
| Archive/privacy | Datenarchiv, archive jobs | explicit scope, legal retention, irreversible-action safeguards |
| Customer area | Portal, public tokens, change requests | capability/session boundary and minimal disclosure |
| Wiki/docs | Hilfe, wiki, CLAUDE, PRD | describes current contracts; no contradictory maintenance rules |
| Platform/deploy | migrations, config, Edge, generated types | repository equals production and every public boundary is known |

---

## 9. Immediate task queue

Execute top-down. Do not skip directly to cosmetic Offerio string removal.

| Rank | Task | Impact | Effort | Main risk addressed |
|---:|---|:---:|:---:|---|
| 1 | P0 current production-truth recapture and repo/config/deploy diff | H | M | acting on stale assumptions |
| 2 | Replace split-brain company resolution in invoices/receipts/offers | H | M | wrong legal entity/IBAN/data |
| 3 | Edge auth manifest + audit deploy-only/hash-drift functions | H | M | unauthenticated reachable handler |
| 4 | Locale-aware spell check and strict document locale contract | H | M | corrupt/mixed FR/EN content |
| 5 | Translation readiness + authoring coverage | H | M | silent German fallback |
| 6 | Frozen offer/AGB/checklist snapshot for future sends | H | H | irreproducible customer evidence |
| 7 | Two-tenant and mixed-locale end-to-end gates | H | H | recurrence of silent defects |
| 8 | Monetary/document chain audit | H | H | incorrect offers/invoices |
| 9 | Migration/deployment ledger from signed baseline | H | M | production drift |
| 10 | Remaining module certification | H | H | unknown defects outside offer flow |
| 11 | Active Offerio residue decommission | M | M | obsolete attack surface/confusion |
| 12 | Current docs/wiki rewrite from certified contracts | M | M | future engineers reintroducing old assumptions |

---

## 10. Required read-only production audit outputs

Create versioned artifacts, not prose-only observations:

- `production-truth/<date>/manifest.json`
- `production-truth/<date>/tables.json`
- `production-truth/<date>/policies.json`
- `production-truth/<date>/table-grants.json`
- `production-truth/<date>/function-authz.json`
- `production-truth/<date>/cron-jobs.json`
- `production-truth/<date>/edge-runtime.json`
- `production-truth/<date>/edge-deployed-digests.json`
- `production-truth/<date>/edge-repo-config-deploy-diff.json`
- `production-truth/<date>/data-integrity-summary.json`
- `production-truth/<date>/translation-readiness-summary.json`
- `production-truth/<date>/offer-document-consistency-summary.json`

Sanitize secrets and PII. Store counts and fingerprints in the repository; keep affected customer identifiers in a protected operator artifact when needed.

---

## 11. DO NOT

1. Do not bulk-translate or rewrite existing offers/items.
2. Do not drop `companies`, `company_members`, or tenant RLS as “Offerio residue.”
3. Do not turn off RLS or grant broad table access to repair a failing screen.
4. Do not trust `supabase/config.toml` as live Edge authorization without measuring the deployment.
5. Do not infer applied migrations from filenames.
6. Do not delete tombstone functions before undeploying the corresponding production route.
7. Do not revoke all `anon` RPC access blindly; public capability flows require narrowly audited execution.
8. Do not translate customer documents from operator React context.
9. Do not let missing FR/EN content silently fall back to German at first send.
10. Do not run German spell-check rules over French/English.
11. Do not edit a sent document in place; create a version/successor.
12. Do not let public offer/AGB/checklist views read mutable templates after a snapshot exists.
13. Do not add a second membership helper with different semantics.
14. Do not accept a service-role query without an explicit tenant predicate and a two-company test.
15. Do not treat a green pure-function test suite as proof of DB/RLS/component/Edge behavior.
16. Do not remove current customer-portal functionality solely because the old fork documentation says “portal removed.” Classify the actual implementation first.
17. Do not erase historical evidence merely to make a repository search for “Offerio” return zero.
18. Do not call a failed e-mail/attachment generation successful because the business row saved.
19. Do not continue unrelated feature growth while critical tenant, language, and Edge-boundary contracts remain unverified.

---

## 12. Session execution template

For every coding/audit session, use this format:

### Scope

- one task ID or one tightly coupled tranche;
- exact modules/files/DB objects;
- explicit out-of-scope list.

### Preflight

- clean checkout/branch and commit SHA;
- current test/lint baseline;
- production access mode (read-only unless separately authorized);
- current desired-state and production-truth generation.

### Evidence before change

- VERIFIED/HYPOTHESIS/NEEDS-PRODUCTION-CHECK labels;
- exact file/symbol or catalog object;
- final-boundary reproduction where possible.

### Implementation

- root-cause correction;
- no symptom suppression;
- new migration only;
- explicit compatibility treatment for historical data.

### Verification

- named targeted contract tests;
- type-check/lint/full test outputs;
- disposable DB catalog assertions;
- two-tenant and mixed-locale negative cases where relevant;
- build artifact inspection for documents/e-mails.

### Result

- files/objects changed;
- contract now guaranteed;
- unresolved risks;
- next ranked task;
- no deploy unless explicitly authorized in a separate rollout step.

---

## 13. First execution boundary

The first implementation cycle must not attempt the whole program. It must complete these bounded outcomes:

1. **P0 current production truth** with no writes.
2. **Tenant-critical slice:** invoices, receipts, and offers no longer use guessed company identity.
3. **French-offer critical slice:** spell checker accepts/validates locale; the UI can no longer claim that a passive locale toggle retranslates stored content; strict readiness detects missing mandatory French content before send.
4. **Security-critical slice:** every currently deployed Edge function is present in the auth manifest, and deploy-only/hash-drift functions are reported with exact disposition.

Do not start snapshot-version migration or broad residue deletion until these four outcomes are reviewed. They establish the reliable tenant, language, and deployment foundations every later module depends on.

---

## 14. Final completion criteria

The hardening program closes only when:

- every active module has a certification report;
- every critical/high defect is fixed or explicitly accepted by the product owner with evidence;
- active tenant is the sole tenant source under `/firma`;
- DE/FR/EN customer-document chains pass with a different operator locale;
- customer-facing sent documents use frozen versions;
- monetary recomputation and rendered totals agree;
- all deployed Edge Functions are classified, source-controlled, hash-matched, and handler-auth tested;
- RLS/grants/RPC catalog checks pass;
- migration and deployment ledgers are current;
- active Offerio marketplace/billing runtime and branding are absent;
- current PRD/CLAUDE/wiki describe the certified system rather than the historical fork;
- release gates prevent the verified defect classes from returning.
