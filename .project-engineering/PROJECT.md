# CRM Hardening and Product Certification

- Scope version: `1`
- Last updated: `2026-08-28`

Source of the mandate: [`CRM_SYSTEM_HARDENING_PROGRAM.md`](../docs/CRM_SYSTEM_HARDENING_PROGRAM.md)
at the repository root. Its §14 owns the completion criteria.

## Outcome

A deliberately multi-tenant, multilingual, security-hardened CRM whose
customer-facing and financial workflows are demonstrably correct end to end.
Not a report. Not a plan. A corrected, incrementally delivered, tested,
documented and release-gated system.

## Users and Jobs

Two companies (`companies` = 2, `company_members` = 2). Operators work under
`/firma`: turn a request into an offer, get it accepted, schedule it, run the
job, invoice and receipt it. Customers meet the system through capability-token
pages (offer view, appointment action, inspection session) and the `/portal`
customer area.

## Scope

In: everything under `src/`, `supabase/functions/`, `supabase/migrations/`,
`scripts/`, `docs/` and `ops/` of this repository.

Out, without separate written authorization: every production write — applying a
migration, deploying or restarting an edge function, changing RLS/grants/cron,
setting secrets, revoking live tokens, sending real customer mail, touching
production storage.

## Non-goals

Stripe, token balances, subscription tiers, marketplace lead distribution,
public partner registration. No from-scratch rewrite. No deletion of truthful
historical migrations or post-mortems.

## Success Measures

1. Two-company negative tests pass for every high-risk workflow.
2. DE-operator → FR-customer and DE-operator → EN-customer chains carry no
   German into customer output.
3. Every deployed edge function has exactly one tested authorization model.
4. Repository, deployed edge source, schema, config and current docs describe
   the same system.
5. The defect classes found here fail the build if reintroduced.

## Constraints

- Existing `offers` / `offer_items` are never rewritten; historical
  contradictions produce read-only reports.
- Migrations are immutable; corrections are new append-only files with a
  `ROLLBACK_*` sibling.
- RLS is never weakened; `service_role` never reaches the browser.
- Dashboard locale and document locale are independent axes.
- Self-hosted Supabase on Coolify: `VERIFY_JWT=false` and Kong carries only
  `cors` on `/functions/v1` — the gateway is **not** a boundary.

## Facts, Decisions, Assumptions, and Questions

**Facts (measured 2026-08-28, `ops/production-truth/2026-08-28/`)**

- PostgreSQL 15.8, system identifier `7639710127421538342`.
- 101 tables, all with RLS, none FORCE; 232 policies; 97 tables carry anon write
  grants at table level (Supabase default).
- 220 functions; 32 anon-executable; 4 of those SECURITY DEFINER with a write
  keyword.
- 42 edge functions deployed: 29 identical to the repo, 10 older, 3 deploy-only,
  12 repo-only.
- Baseline: `type-check` PASS · `npm test` PASS (83 files / 1746 tests) ·
  `eslint` 88 errors + 2 warnings.

**Decisions** — see `ARCHITECTURE.md` (D-001 … D-005).

**Assumptions**

- `/portal` is a wanted customer area, not residue. To be confirmed before any
  P5 action touches it (DEC-001).

**Questions**

- DEC-001: retain `/portal` as *Kundenbereich* or decommission it?
