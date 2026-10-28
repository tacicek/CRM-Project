# Claude Code `/goal` Prompt — CRM Hardening and Product Certification

Paste the block below into Claude Code from the repository root. Keep
`docs/CRM_SYSTEM_HARDENING_PROGRAM.md` inside the repository before starting.

---

/goal

# Durable goal: harden and certify the complete CRM end to end

Use the installed `project-engineer` skill as the execution framework. Work directly in this
repository and continue autonomously through discovery, implementation, verification, review,
delivery hygiene, and proof collection until the final completion criteria in
`docs/CRM_SYSTEM_HARDENING_PROGRAM.md` are satisfied or a genuine hard-stop condition is met.

This is **not** an audit-only goal and it is **not** complete when a plan or report exists.
The required outcome is a corrected, incrementally delivered, tested, documented, and
release-gated CRM. Convert every relevant item in P0–P6 and every module-certification gate in
the hardening program into executable ledger tasks, then complete them in dependency order.
Do not silently omit difficult items.

## 1. Instruction precedence and known documentation conflict

Apply this precedence inside the repository:

1. Platform/tool safety rules and explicit production boundaries in this goal.
2. `docs/CRM_SYSTEM_HARDENING_PROGRAM.md` and the product decisions recorded there.
3. The repository's current `CLAUDE.md`, PRD, ADRs, conventions, and module docs.
4. Existing implementation details and comments, which are claims to verify rather than truth.

Two parts of the current `CLAUDE.md` are known to be stale for this program:

- Its statement that the CRM must remain single-tenant is superseded by hardening decision
  **D-001: deliberate multi-tenancy**. The live product has multiple companies and an active
  company context. Preserve and harden `companies`, `company_members`, `company_id`, tenant
  RLS, membership checks, and explicit active-tenant selection.
- Its requirement to ask for approval merely because a change spans 5+ files is satisfied by
  this `/goal`. Multi-file work inside an approved, tightly bounded tranche is authorized.

All other no-patch, RLS, secret-handling, migration, type-safety, document-language, and
historical-data constraints remain binding. Where documentation and code disagree, record the
conflict, prove current behavior, implement the approved contract, and update the current docs
only after the contract is verified.

## 2. Read and reconcile before changing code

Read these sources in this order:

1. `docs/CRM_SYSTEM_HARDENING_PROGRAM.md`
2. `CLAUDE.md`
3. `docs/SISTEM_PRD.md`
4. `docs/PREISMODELL_DEVIR.md`
5. current production-truth documentation and capture scripts
6. relevant module docs, migrations, Edge source, generated types, tests, and package scripts

Then:

- inspect `git status`, current branch, HEAD, remotes, open worktrees, and existing project
  management state;
- preserve all user changes and all work owned by other sessions;
- reconcile, do not overwrite, any existing `.project-engineering/` state;
- inspect the actual package scripts and repository conventions before choosing commands;
- establish the current baseline before making assertions about tests, lint, schema, Edge
  deployment, migrations, or production.

Do not stop after this reconciliation. Begin the first dependency-complete task immediately.

## 3. Durable state and hardening ledger

Use or update the existing project-engineer artifacts. At minimum maintain durable,
repository-tracked state equivalent to:

- `.project-engineering/PROJECT.md`
- `.project-engineering/REQUIREMENTS.md`
- `.project-engineering/ARCHITECTURE.md`
- `.project-engineering/PLAN.md`
- `.project-engineering/STATE.json`
- `.project-engineering/WORKLOG.md`
- `.project-engineering/evidence/`
- a hardening ledger under `docs/hardening/` or the repository's existing equivalent

The hardening ledger must contain one row per task:

`ID | phase | module | defect class | dependency | status | before evidence | desired contract | implementation | verification | PR/commit | production check | residual risk`

Label every material finding and claim as exactly one of:

- **VERIFIED** — proven from current source, test output, catalog state, or deployed source;
- **HYPOTHESIS** — plausible but not yet proven;
- **NEEDS-PRODUCTION-CHECK** — current live state is required, together with the exact
  read-only command/query that settles it;
- **REFUTED** — tested and shown not to be true.

Never promote a hypothesis to verified because a comment, migration filename, config entry, or
type definition claims the behavior.

Allowed status model:

`BACKLOG → READY → IN_PROGRESS → VERIFY → REVIEW → MERGED → PRODUCTION_VERIFIED → DONE`

and, when appropriate:

`BLOCKED | AWAITING_PRODUCTION_AUTH | NEEDS_PRODUCTION_CHECK | REFUTED | DEFERRED_WITH_OWNER_DECISION`

Rules:

- At most one task is `IN_PROGRESS` or `VERIFY` at a time.
- A task cannot start until its dependencies are evidenced as complete.
- A task cannot be `DONE` without final-boundary proof.
- `MERGED` is not the same as `PRODUCTION_VERIFIED`.
- An unavailable production check is never silently converted into success.
- At every context boundary, persist exact state, evidence paths, current commit/PR, next safe
  action, and blockers. Resume from that state rather than repeating discovery.

## 4. Autonomous `/goal` loop

For each iteration:

1. **Reconcile** repository, branch/worktree, ledger, open PRs, CI, deployment state, and the
   latest trusted production-truth generation.
2. Select the highest-ranked dependency-complete task from the hardening program.
3. Create or reuse an isolated worktree/branch for that tranche. Never disturb another
   session's branch, worktree, uncommitted files, or main checkout.
4. State and record before implementation:
   - root cause;
   - exact trigger/condition;
   - affected final boundary;
   - intended contract;
   - expected side effects and files/objects in scope;
   - explicit out-of-scope items.
5. Trace the claimed behavior through its complete path before changing it: UI/control →
   state/input → persisted row → canonical computation/state transition → document/public
   payload or authorization decision → external side effect. Record every break in that chain
   as a lying surface. Then implement the root-cause correction incrementally. Do not suppress
   the symptom.
6. Add the smallest tests and catalog assertions that pin the exact broken contract.
7. Verify targeted behavior, then the relevant wider gates.
8. Inspect the diff for scope escape, generated-file drift, unsafe fallbacks, security
   regressions, and documentation contradictions.
9. Commit with a precise message, push, open/update a draft PR, run **one independent review
   round**, resolve every supported finding, and rerun affected verification.
10. Mark ready and squash-merge only when all admission gates pass and the change is safe
    against the currently deployed schema/Edge state.
11. Verify main CI. Monitor any automatic application deployment and perform read-only
    post-deploy verification where safe and authorized.
12. Clean only the merged branches/worktrees created by this goal.
13. Update the ledger/evidence and continue automatically with the next safe task.

Do not impose an arbitrary task count or stop after the first PR. The review boundary in the
hardening program is an engineering review gate, not a request for routine user approval.

Read-only subagents may be used for focused discovery or independent review. Do not allow two
agents to write overlapping scopes.

## 5. Authorized actions

Within this goal, you are authorized to:

- inspect the full repository and read-only production evidence;
- edit application code, tests, docs, scripts, configuration, append-only migrations, and
  Edge source;
- run local/disposable/staging database stacks and apply migrations there;
- create isolated worktrees and branches;
- commit, push, create/update draft PRs, resolve review findings, mark PRs ready, squash-merge,
  verify main CI, and clean up your own merged worktrees/branches;
- monitor automatic deployments and perform read-only production verification;
- create sanitized manifests, fingerprints, counts, and evidence artifacts.

A merge is allowed only when it is backward-compatible with the production state that exists
at merge time. A code change that requires an unapplied database migration, undeployed Edge
function, new secret, cron change, or changed grant must remain behind a safe compatibility
boundary or at an explicit rollout gate.

## 6. Production boundary — never cross implicitly

Without a separate explicit production-write authorization, do **not**:

- apply a production migration;
- mutate, backfill, normalize, delete, or repair production business data;
- deploy/undeploy/restart an Edge Function or container;
- change RLS policies, grants, function ACLs, cron jobs, gateway configuration, or runtime
  environment in production;
- rotate/set secrets or credentials;
- revoke live customer/staff tokens;
- send real e-mails, SMS, webhooks, or customer notifications;
- change production storage objects;
- perform any destructive or irreversible action.

Prepare these changes completely in source, prove them on a disposable/local environment,
produce a rollout and rollback package, mark the task `AWAITING_PRODUCTION_AUTH`, and continue
with other dependency-safe work. Stop the whole goal only when every remaining task is blocked
by such an authorization or by another hard-stop condition.

P0 production inspection is read-only. Inspect any capture script before running it and prove
that it cannot write. Never store secret values or customer PII in the repository; store only
sanitized names, counts, hashes, catalog metadata, and protected operator references where
necessary.

## 7. Non-negotiable invariants

1. Never write to or normalize existing historical `offers` / `offer_items`. The real sent
   rows remain immutable. Historical inconsistencies produce read-only reports.
2. Never edit an existing migration. Add a new append-only migration.
3. Never weaken RLS, expose service-role credentials to the browser, or replace membership
   checks with a client-supplied `company_id`.
4. Under `/firma`, the selected active company is the sole browser tenant source. No helper
   may guess “the company” from e-mail, membership order, recency, or singular assumptions.
5. Every service-role query must derive the tenant from an authenticated membership, signed
   request, or capability row and carry an explicit tenant predicate.
6. No Stripe, token balances, subscription tiers, marketplace, or public partner-registration
   resurrection.
7. Do not delete a current customer area merely because old docs call it a portal. Classify
   actual reachability and business purpose first.
8. Do not erase truthful historical migrations or post-mortems to make a text search for
   “Offerio” return zero. Remove Offerio only from active runtime, configuration, deployment,
   current product docs, and user-visible output once reachability is proven.
9. No symptom patching, silent `try/catch`, swallowed side effect, false success toast,
   permissive fallback, blind retry, assertion weakening, arbitrary sleep, `as any`, new
   `eslint-disable`, barrel export, or production `console.log`.
10. Dashboard locale and customer-document locale are independent axes. Customer renderers
    receive locale explicitly and must never read operator React locale context.
11. Missing mandatory FR/EN content may be marked in preview but must block first send or
    publication; it must never silently become German.
12. German spell-check rules apply only to `de`; spell checking never translates.
13. Customer-facing content sent for the first time becomes an immutable version/snapshot.
    Later template edits cannot change public view or acceptance evidence for that version.
14. SIX-normed Swiss QR-invoice labels are not freely translated.
15. No from-scratch rewrite unless a bounded subsystem is proven impossible to repair
    incrementally and the evidence is recorded.
16. A green pure-function suite is not proof of DB/RLS/Edge/component/document behavior.
17. Do not manually alter generated Supabase types merely to make TypeScript pass. First use
    the repository's verified generation path. Where current tooling is demonstrably
    non-reproducible, record the tooling defect and apply only an exact, reviewed schema delta
    with a follow-up task that restores reproducible generation.

## 8. Required phase order and exit gates

Execute the complete program in dependency order. Turn every numbered program item into
ledger tasks.

### Phase P0 — current production truth and desired-state baseline

- Capture a new, dated, read-only production-truth generation.
- Measure DB/RLS/grants/RPCs/cron, Edge runtime/gateway, deployed names and hashes,
  repo/config/deploy differences, env **names only**, and required data-integrity counts.
- Build the desired-state Edge-auth manifest and migration baseline manifest.
- Do not invent historical migration state.

**Exit:** current reality is reproducibly described and every drift item is named.

### Phase P1A — eliminate tenant split-brain

Start with invoices, receipts, and offers, then complete every `/firma` caller and cache key.
Eliminate `fetchSingleCompanyForUser()` from production paths, make active tenant explicit,
derive legal/document identity from the business row, fail closed on context mismatch, and
protect tenant switching from stale responses.

**Exit:** zero production `/firma` imports/calls of the guessing helper and two-company
negative tests pass for all high-risk workflows.

### Phase P1B — certify FR/EN customer-document chains

Implement the canonical locale resolver, locale-aware spell checking, explicit draft-language
rebase planning, future-row source provenance, actual translation authoring, strict readiness,
and immutable first-send snapshots. Certify DE-operator→FR-customer and DE-operator→EN-customer
chains through offer, e-mail/PDF/attachments, public view, acceptance, order/appointment,
invoice, and receipt.

**Exit:** every customer-facing surface agrees on locale and frozen content; missing mandatory
translations block with exact source-level diagnostics.

### Phase P1C — classify and harden every Edge/RPC boundary

Create one auth model per deployed function: `jwt-member`, `capability-token`,
`signed-webhook`, `cron-secret`, `public-safe`, or `tombstone`. Audit all service-role queries,
all remaining anon-executable RPCs, deploy-only functions, config-only entries, and hash drift.
For every security finding state: the realistic attacker, what access they already have, what
they gain, whether the route is internet-reachable, and the smallest invariant-preserving fix.
Rank an unauthenticated internet path first, then a member of the wrong company, then a
correctly authorized insider; do not pad the queue with generic CVSS-style theory. Add
fail-closed catalog checks and two-tenant negative tests.

**Exit:** no deployed function is unclassified or source-unknown; public execution is a narrow,
reviewed allowlist.

### Phase P2 — document, monetary, and state integrity

Certify the canonical document graph, calculations/rounding/tax/allocations, state machines,
idempotency, numbering, cross-tenant FKs, orphan/duplicate/null exposure, and future immutable
versions. Existing sent rows remain untouched; produce read-only legacy reports.

**Exit:** persisted data, recomputation, PDF/e-mail/public output, and lifecycle evidence agree.

### Phase P3 — reproducible migrations and deployment

Establish signed baselines and append-only checksum ledgers from the current date forward,
repo/config/deploy parity checks, generated-type drift checks, deterministic migration
verification, and deployment evidence.

**Exit:** current and desired states can be reproduced and compared without guesswork.

### Phase P4 — certify every active module

Apply the full rubric in section 6 of the hardening program to every module in section 8.
Create one module certification report with exact tests/evidence per module. Do not certify a
module by inspection alone.

**Exit:** every active module has tenant, data, lifecycle, locale, calculation, side-effect,
security, recovery, and parity evidence where applicable.

### Phase P5 — remove active Offerio residue safely

Remove active marketplace/billing/branding/config/deployment residue only after caller,
traffic, grant, route, and dependency reachability are proven. Undeploy before deleting source
where applicable. Keep truthful historical evidence. Do not delete `companies`, membership,
tenant RLS, or a current customer area by name.

**Exit:** no active Offerio marketplace/billing runtime, route, config, deployment, current-doc
claim, or user-visible branding remains.

### Phase P6 — permanent release gates and current documentation

Install all permanent gates listed in the hardening program: two-tenant isolation,
mixed-locale chains, readiness blockers, snapshot consistency, monetary contracts,
state/idempotency, Edge manifest completeness, catalog assertions, migration checksums,
repo/config/deploy parity, generated types, forbidden-helper/residue checks, and customer
renderer import boundaries. Rewrite current PRD/CLAUDE/wiki from the certified contracts.

**Exit:** the defect classes found during this program cannot silently re-enter through the
normal merge/release path.

## 9. First-cycle gate

The first cycle must complete and independently review these four outcomes before beginning
snapshot-version migrations or broad residue deletion:

1. current read-only P0 production truth;
2. tenant-critical invoices, receipts, and offers no longer use guessed company identity;
3. locale-aware spell check, honest language-switch behavior, and strict French readiness;
4. complete auth classification for currently deployed Edge functions, including deploy-only
   and hash-drift disposition.

This is an internal/PR review gate. Resolve supported review findings and continue; do not ask
for routine user approval.

## 10. Verification contract for every tranche

Use the repository's real scripts, not assumed commands. Every tranche must include all
applicable evidence below:

- exact before reproduction at the final boundary;
- targeted unit/contract tests naming the broken contract;
- TypeScript/type-check;
- zero lint errors in touched files and no increase in repository total;
- relevant full test suite and build;
- local/disposable DB migration apply, catalog assertions, and rollback/forward verification
  where applicable;
- two-company negative cases for tenant-owned data;
- mixed operator/customer-locale cases for customer-facing output;
- actual PDF/e-mail/public payload inspection, not only component snapshots;
- Edge handler auth negatives and explicit tenant-filter tests;
- idempotency/retry tests for RPCs, tokens, cron, imports, and public actions;
- diff review against scope and invariants;
- one independent review round per PR;
- main CI after merge;
- read-only production verification when a deployment actually occurred and access exists.

Never report an unrun browser, DB, Edge, e-mail, PDF, or production check as passed. Mark it
`NOT_RUN`, `BLOCKED`, or `NEEDS_PRODUCTION_CHECK` with the exact reason and settling command.
Use fake/sink mail transports and seeded synthetic tenants locally; never contact a real
customer.

## 11. Delivery and merge rules

- Prefer one root-cause contract or tightly coupled tranche per PR; never one giant hardening
  PR.
- Keep every commit and PR reviewable and deployable.
- Do not merge code that assumes an unapplied production schema/Edge change unless it is
  demonstrably backward-compatible and feature-gated safely without lying to the user.
- Do not split one atomic security invariant across unsafe deployments. Token column + audit
  log scrubbing, for example, must remain one migration/transaction.
- Do not rerun the same broad discovery or independent review without new evidence.
- One evidence-based infrastructure rerun is allowed for a flaky external CI failure; do not
  blind-retry application failures.
- Resolve supported review findings. Refute unsupported findings with evidence rather than
  changing correct code.
- Keep unrelated pre-existing lint/test debt visible but do not expand scope unless it blocks
  the current contract or is itself a ranked hardening task.

## 12. Do not stop for routine work

Do not ask for confirmation because:

- the task touches many files;
- a migration, test, script, manifest, or documentation update is needed locally;
- a test fails and the root cause can be investigated;
- review finds a supported issue;
- an implementation detail is clearly resolved by the code, contracts, or existing product
  behavior;
- one production rollout is blocked while other dependency-safe source work remains;
- the context is becoming long—checkpoint and resume instead.

## 13. Genuine hard-stop conditions

Pause the goal only for one of these conditions:

1. two or more materially different product semantics remain valid and existing evidence does
   not decide between them;
2. required access, credential, billing/quota, network connectivity, or external service is
   unavailable and no safe local substitute can prove the contract;
3. the next necessary action is an unauthorized production write, deployment, secret change,
   irreversible operation, or real customer side effect and no other safe task remains;
4. current production schema/contract materially contradicts the task assumptions and proceeding
   could corrupt or expose data;
5. another session owns conflicting dirty files, branch state, migration namespace, or release
   work and safe isolation is impossible;
6. main/base/head drift invalidates the reviewed patch;
7. CI repeatedly fails for an evidence-based infrastructure reason after one controlled rerun,
   or an application failure cannot be solved without changing product semantics;
8. customer-facing or cross-tenant behavior cannot be verified safely and the remaining choice
   would be guesswork;
9. evidence suggests an active credential leak, cross-tenant breach, or destructive production
   condition requiring immediate owner action.

When blocked, do not give a vague status. Persist and report:

- `GOAL_BLOCKED`;
- exact task and phase;
- verified facts vs hypotheses;
- exact blocker;
- risk of proceeding;
- completed evidence and commits/PRs;
- the smallest owner decision or authorized command required;
- the next safe action after unblocking.

## 14. Progress and final reporting

Keep progress updates concise and evidence-led. Surface critical findings as soon as proven.
Do not flood output with low-level command narration.

After every tranche report:

- task/phase and status;
- root cause and final-boundary effect;
- files/DB objects changed;
- tests and actual outputs;
- review/PR/merge/main-CI state;
- production-write requirement or read-only verification state;
- residual risk;
- next ranked task.

Do not use the word “complete” for the overall goal until every final completion criterion in
section 14 of `docs/CRM_SYSTEM_HARDENING_PROGRAM.md` is evidenced. The final report must include:

1. certified modules and evidence paths;
2. all critical/high defects fixed or explicitly owner-accepted;
3. unresolved `NEEDS_PRODUCTION_CHECK` or `AWAITING_PRODUCTION_AUTH` items;
4. migration and Edge rollout packages not yet authorized;
5. PRs/commits/merges and main CI results;
6. production parity status;
7. read-only legacy data exposure reports;
8. active Offerio residue search/reachability result;
9. permanent release gates added;
10. remaining risks and the exact reason the goal is DONE or BLOCKED.

Begin now: reconcile state, read the required sources, create/update the hardening ledger, run
the baseline, and execute P0. Do not stop after planning.
