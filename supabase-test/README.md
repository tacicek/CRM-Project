# supabase-test — local integration test baseline

Test-only. **Not** a production migration path. `supabase db push` never sees this
directory (it only reads `supabase/migrations/`), so the baseline can never reach prod.

## Why a baseline instead of the migration chain

The 276-file `supabase/migrations/` chain **does not boot from scratch**: migration
`20260326100000_admin_update_lead_distributions.sql` runs `CREATE POLICY "Admins can
update lead distributions"` with no `DROP ... IF EXISTS`, and the same policy was already
created in `20251220141207_*.sql` → `SQLSTATE 42710` on a clean apply (178 of 276 applied,
then halt). Editing migrations is forbidden (they are prod history), so local integration
tests run against a **schema baseline** captured from the live DB instead.

## How the baseline was produced

1. Read-only, schema-only dump of the live self-hosted DB (no data, no `auth`/`storage`/
   `vault` schemas): `pg_dump --schema-only --schema=public --no-owner --no-privileges`.
   The raw dump is treated as sensitive and is **never** committed.
2. Sanitized (see `parity-manifest.json > deliberate_test_differences`):
   - 4 external-call function bodies (`invoke_edge_function`, `trigger_notify_admin_high_spam`,
     `trigger_subscription_manager`, `trigger_team_reminder_for_appointment`) → no-op stubs
     (signatures preserved). They made HTTP/vault/cron calls; a test DB must not.
   - Quoted URL / email / JWT literals → placeholders.
   - Verified: **0** occurrences of http/vault/cron/net/JWT/email/IP/Bearer in `schema.sql`.
3. `grants.sql` re-adds Supabase's default privilege model (the dump used
   `--no-privileges`). **RLS is not disabled or loosened** — grants only let a role reach
   RLS, so the "anon is denied" test tests RLS, not a missing grant.

## Files

| File | Purpose |
|---|---|
| `runtime/supabase/config.toml` | **Dedicated** test-stack config: project_id `crm-test`, db port `54342`. |
| `baseline/schema.sql` | Sanitized public schema (tables, enums, RLS, policies, RPCs, triggers). |
| `baseline/prereqs.sql` | Test stub for the excluded `besichtigung` schema (the one public view depends on it). |
| `baseline/auth-supplement.sql` | `auth.jwt()` + newer `auth.users` columns (applied as `supabase_admin`). |
| `baseline/guard-marker.sql` | In-db identity marker `crm_test_guard.identity` (survives the `public` wipe). |
| `baseline/grants.sql` | Supabase default grants (test-env reconstruction). |
| `baseline/parity-manifest.json` | Counts + column/policy/function md5 fingerprints + deliberate diffs. Drift check. |
| `seed/fixtures.sql` | Synthetic two-tenant fixtures (superuser setup only). |
| `tests/assertions.sql` | RLS / token / relation / atomicity assertions as `anon`/`authenticated`. |
| `tests/auftrag-contract.sql` | Auftrag Insert/Update persistence contract (trigger nummer, enum, JSON/financial round-trip). |

## Running

The tests run against a **dedicated, uniquely-named** stack (project `crm-test`, db `54342`) —
NOT the app's `supabase/config.toml` stack and NOT any other project. Always use its own
workdir:

```bash
npm run test:db:up                       # supabase --workdir supabase-test/runtime start
CRM_TEST_ENV=1 npm run test:db:bootstrap # marker + schema + grants + fixtures (first-time / reset)
CRM_TEST_ENV=1 npm run test:db           # disposable rebuild + assertions + auftrag contract
npm run test:db:down                     # supabase --workdir supabase-test/runtime stop
```

Fail-closed (see `scripts/test-db.sh` ↔ tested spec `src/test/db-guard.ts`): before the
destructive `DROP SCHEMA public CASCADE`, FIVE independent signals must all hold —
`CRM_TEST_ENV=1`, a local host, the dedicated port `54342` (**never** the 54322 default),
the unique container `supabase_db_crm-test` + CLI project label, and the in-db
`crm_test_guard.identity` marker. It never targets "whatever db is on 54322", never connects
to a remote, and never starts/stops a stack. Each run wipes `public` and rebuilds — disposable
and deterministic.

### Baseline supplements (İter.2 follow-up)

`prereqs.sql` and `auth-supplement.sql` exist because the `--schema=public` dump is not
self-contained on a clean stack: a public view selects from the `besichtigung` schema, and
the baseline references `auth.jwt()` / newer `auth.users` columns the lean local image lacks.
These are minimal, accurate test stubs (columns transcribed from the baseline's own
definitions). The proper fix is to regenerate the baseline with
`--schema=public --schema=besichtigung` and an auth-migrated `auth.users` — tracked as İter.2
baseline completeness.

## Keeping it current (drift)

The baseline is a snapshot. Re-generate after schema-affecting migrations:
re-run the read-only dump → sanitize → re-run `npm run test:db`. Compare the manifest
fingerprints (`column_fingerprint_md5`, `policy_fingerprint_md5`, `function_fingerprint_md5`)
against a fresh capture to detect drift. The manifest's `deliberate_test_differences` is
the **only** allowed divergence from prod; anything else is drift to investigate.

## What this is NOT

Not a replacement for the production migration strategy. Prod continues to deploy via
`supabase/migrations/`. This baseline exists solely so RLS/RPC/token/relation behaviour
can be tested on a disposable local DB.
