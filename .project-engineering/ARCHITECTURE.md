# CRM Hardening — Architecture

- Scope version: `1`
- Last updated: `2026-08-28`

## Observed Baseline

- **Frontend:** Vite 7 · React 18 · TypeScript strict · Tailwind · shadcn/ui ·
  TanStack Query · react-hook-form + zod. Dev-Port 8080.
- **Backend:** self-hosted Supabase on Coolify (Hetzner `213.199.45.205`),
  PostgreSQL 15.8, Kong gateway, Deno edge runtime.
- **Measured 2026-08-28:** 101 tables (all RLS, none FORCE), 232 policies,
  220 functions (32 anon-executable, 4 of them SECURITY DEFINER with a write
  keyword), 42 deployed edge functions, 2 companies, 2 memberships.
- **Baseline checks:** `npm run type-check` PASS · `npm test` PASS
  (83 files / 1746 tests) · `npx eslint .` FAIL (88 errors, 2 warnings —
  pre-existing).

## Decision Drivers

Correctness of customer-facing and financial output outranks convenience.
Production state is measured, not inferred. Every change must stay deployable
against the production that exists at merge time.

## System Boundary and Components

Browser (`/firma` operator surfaces, `/portal` customer area, public token
pages) → Supabase PostgREST/Auth → PostgreSQL with RLS → Deno edge functions
(email via Resend, AI via Anthropic, Google Places/Distance) → pg_cron jobs.

## Data Ownership and Model

`companies` is the tenant root. `company_members` grants access.
Every tenant-owned table carries `company_id`.

Two competing tenant resolutions exist today:

1. `CompanyProvider` / `useCompanyContext` — the selected active company.
2. `fetchSingleCompanyForUser()` — guesses: login-email match, else newest
   company. 17 callers, 16 of them under `/firma`.

Resolving (2) into (1) is P1A.

## Interfaces and Flows

Document chain: `lead → offer (language frozen) → accepted offer → auftrag /
appointment → rechnung / quittung`, each carrying `company_id` and `language`
forward. Public surfaces (offer view, appointment action, calendar feed,
inspection session) are reached by capability token, never by browser state.

## Security and Trust Boundaries

Measured, not assumed:

1. **Kong `/functions/v1`** carries only `cors`. **Not** a boundary.
2. **Edge router `main`** checks JWT only when `VERIFY_JWT=true`; production is
   `false`. **Not** a boundary.
3. **The handler itself** — the only boundary. Contract:
   `docs/hardening/edge-auth-manifest.json`; gate:
   `src/test/__tests__/edge-auth-manifest.test.ts`.
4. **RLS** — the only boundary between `anon` and the tables: 97 of 101 tables
   carry anon write grants (Supabase default). A policy `TO PUBLIC` with
   `WITH CHECK (true)` removes it entirely.
5. **`service_role`** carries `BYPASSRLS`. Every service-role query must bring
   its own tenant predicate.

## Reliability and Operations

pg_cron drives reminders and cleanup; those handlers gate on a service-role
bearer (`_shared/cronAuth.ts`). Email delivery is logged to `email_logs`.
The Coolify host is chronically oversubscribed — deploys, not the code, are the
fragile part (RISK-001).

## Deployment, Migration, and Rollback

Migrations are append-only files applied **by hand**; there is no ledger for the
380+ files before 2026-08-05. Edge functions are copied by hand and the
container restarted. Consequence: repo presence never proves production state —
hence `ops/production-truth/<date>/` and `scripts/edge-drift.mjs`.

Every new migration ships with a `ROLLBACK_*.sql` sibling, following the
existing repository convention.

## Decisions and Open Questions

### Accepted decisions

- **D-001 Deliberate multi-tenancy.** `companies`, `company_members`,
  `company_id` and tenant policies are the spine, not Offerio residue. Remove
  the *guessing*, not the structure. This **supersedes** the single-tenant
  statement in `CLAUDE.md` §2.
- **D-002 Document locale is identity**, not a display preference. Customer
  renderers receive locale as an argument, never from operator React context.
- **D-003 Template ≠ snapshot.** First send freezes; public view and acceptance
  evidence read the frozen version.
- **D-004 One implementation per contract** — tenant resolution, locale
  resolution, pricing totals, timezone, document composition, token validation,
  edge auth.
- **D-005 Production truth outranks repository intent.**

### Open questions

- **DEC-001** Is `/portal` retained as *Kundenbereich* or decommissioned?
  Blocks P5. Classify by behaviour, not by the word "portal".
- `crm_enabled` / `manual_import_monthly_fee` — Offerio-era entitlement
  concepts with no coherent current rule (program F-010).
