# CRM Hardening — Delivery Plan

- Scope version: `1`
- Last updated: `2026-08-28`

Live per-task status lives in the [hardening ledger](../docs/hardening/LEDGER.md).
This file owns the cut, the dependencies and the verification command.

## Delivery Strategy

Ranked tranches from `CRM_SYSTEM_HARDENING_PROGRAM.md` §9, one root-cause
contract per PR, each leaving the system deployable. No production write without
separate authorization: such work is prepared in source, proven locally, packaged
with rollout and rollback, and parked as `AWAITING_PRODUCTION_AUTH` while other
dependency-safe work continues.

## Milestones and Vertical Slices

### M-01 — First execution boundary (program §13)

- Outcome: measured production truth; invoices/receipts/offers no longer guess
  the company; locale-aware spell check with honest language switching and
  strict French readiness; every deployed edge function classified.
- Requirements: REQ-F-001, REQ-F-002, REQ-F-003, REQ-F-004, REQ-F-005, REQ-F-006
- Exit gate: two-company contract tests green; manifest gate green; no
  `/firma` import of the guessing helper.
- Risks: RISK-001, RISK-002

#### S-01 — Production truth

- Outcome: current reality reproducibly described; every drift item named.
- Requirements: REQ-NF-001, REQ-NF-002, REQ-F-006
- Dependencies: none
- Demonstration: `ops/production-truth/2026-08-28/` plus the derived evidence.
- Slice verification: `npx vitest run src/test/__tests__/edge-auth-manifest.test.ts`

#### S-02 — Tenant: invoices, receipts, offers — DONE

- Outcome: financial and offer surfaces derive company identity from the
  business row under the active tenant, and fail closed on mismatch.
- Requirements: REQ-F-001, REQ-F-002
- Dependencies: S-01
- Demonstration: company A active, company B newest membership — A's data loads.
- Slice verification: targeted two-company contract tests, `npm run type-check`,
  `npm test`.

#### S-03 — Language: spell check, honest switch, strict readiness

- Outcome: no German-only service runs over FR/EN; the switch states what it
  actually does; missing mandatory translation blocks the first send.
- Requirements: REQ-F-003, REQ-F-004, REQ-F-005
- Dependencies: S-01
- Slice verification: mixed-locale contract tests; negative case names the source.

#### S-04 — Edge boundaries

- Outcome: authorization before secret load; query errors are not discarded;
  one membership helper.
- Requirements: REQ-F-006, REQ-NF-003
- Dependencies: S-01
- Slice verification: handler auth negatives, two-company tests.

### M-02 — P2/P3 document, monetary and state integrity; reproducible rollout
### M-03 — P4 module certification
### M-04 — P5 remove active Offerio residue
### M-05 — P6 permanent release gates and current documentation

## Task Graph

| ID | Outcome | Requirements | Depends on | Status | Verification |
| --- | --- | --- | --- | --- | --- |
| T-001 | Dated read-only production truth, reproducible edge content diff, migration applied-state, edge auth manifest + gate | REQ-NF-001, REQ-NF-002, REQ-F-006 | — | DONE | `npx vitest run src/test/__tests__/edge-auth-manifest.test.ts`; `node scripts/edge-drift.mjs ops/production-truth/2026-08-28` |
| T-002 | Invoices and receipts (list + detail) resolve company identity from the business row under the active tenant | REQ-F-001, REQ-F-002 | T-001 | DONE | targeted two-company contract tests; `npm run type-check`; `npm test` |
| T-003 | Offer create / edit / detail off the guessing helper | REQ-F-001, REQ-F-002 | T-002 | DONE | two-company contract tests |
| T-004 | Remaining `/firma` callers (orders, settings, archive, imports, pricing, catalog, checklist, team) | REQ-F-002 | T-003 | DONE | two-company contract tests |
| T-005 | `Auth.tsx` resolves eligible memberships; helper deleted; static gate against reintroduction | REQ-F-002 | T-004 | DONE | gate test fails when the helper returns |
| T-014 | Remediate the independent review of S-01/S-02: cross-tenant draft key, Besichtigungen tenant source, gate holes, verified-company auto-select, swallowed record error, manifest overclaim | REQ-F-001, REQ-F-002, REQ-NF-003 | T-005 | DONE | `npx vitest run src/test/__tests__/mandanten-quelle.test.ts` with injected violations; full suite |
| T-006 | `runSpellCheck(fields, locale)`; edge validates the three supported locales and rejects anything else | REQ-F-005 | T-001 | DONE | contract tests per locale |
| T-007 | `buildOfferLanguageRebasePlan()`; the switch stops claiming a rebase it does not perform | REQ-F-003 | T-006 | DONE | pure-function contract tests |
| T-008 | Strict send readiness blocks the first send and names the missing source | REQ-F-004 | T-007 | DONE | negative case names the exact source |
| T-011 | Async tenant invariant: a delayed write carries its own tenant; payload/WHERE mismatch is an error | REQ-F-001, REQ-NF-003 | T-014 | DONE | `npx vitest run src/lib/__tests__/tenantBoundWrite.test.ts` (fake timers) |
| T-012 | Exhaustive edge authorization manifest; mechanical facts measured, 11 gate conditions, injections proven | REQ-F-006 | T-001 | DONE | `npx vitest run src/test/__tests__/edge-auth-manifest.test.ts` |
| T-013 | Independent review of the cumulative branch diff by a reviewer who implemented none of it | REQ-NF-001 | T-008 | IN_PROGRESS | reviewer report with injection results |
| T-009 | Authorize before loading secrets; stop discarding query errors; one membership helper | REQ-F-006, REQ-NF-003 | T-001 | PROPOSED | handler auth negatives |
| T-010 | Review the 4 remaining anon + SECURITY DEFINER writer RPCs individually | REQ-F-006 | T-001 | PROPOSED | catalog assertion on a disposable DB |

## Risks and Spikes

| ID | Risk or question | Impact | Trigger | Mitigation or spike | Status |
| --- | --- | --- | --- | --- | --- |
| RISK-001 | Coolify host chronically oversubscribed; deploys abort | Rollout blocked | any deploy | Affects rollout, not source. Batch the pending deploys into one authorized window. | OPEN |
| RISK-002 | No ledger for the 380+ migrations before 2026-08-05 | Claims about them stay unproven | any schema claim | Signed baseline forward only (P3-1); older claims stay `NEEDS-PROD-CHECK` | OPEN |
| RISK-003 | 88 pre-existing lint errors | Cannot use "lint clean" as the gate | every commit | Touched files zero errors; repository total must not increase | OPEN |
| DEC-001 | Is `/portal` a retained customer area or residue? | Blocks P5 | before any P5 deletion | Classify by reachability and business purpose, not by name | OPEN |

## Quality Gates

| Gate | Scope | Command or procedure | Required evidence | Status |
| --- | --- | --- | --- | --- |
| G0 Safety | Repository | branch, HEAD, dirty paths recorded; user changes preserved | baseline in STATE.json | PASS |
| G1 Baseline | Repository | `npm run type-check`, `npm test`, `npx eslint .` | pre-change results recorded | PASS |
| G2 Production | Production | `scripts/capture-production-truth.sh` (read-only) | dated generation under `ops/production-truth/` | PASS |
| G3 Task | Active task | targeted contract tests named in the task row | red before, green after | PASS (T-001…T-005) |
| G4 Slice | Active slice | two-company and mixed-locale end-to-end contracts | requirement-level evidence | PENDING |
| G5 Release | Repository | edge auth manifest gate; touched-file lint; type-check; full suite | all green | PENDING |
