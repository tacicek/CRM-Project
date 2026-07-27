# supabase-test — local integration test baseline

Test-only. **Not** a production migration path. `supabase db push` never sees this
directory (it only reads `supabase/migrations/`), so the baseline can never reach prod.

## Why a baseline instead of the migration chain

The `supabase/migrations/` chain hielt bis 2026-07-28 bei
`20260326100000_admin_update_lead_distributions.sql` an: die Datei legte eine Policy an,
die `20251220141207_*.sql` bereits erzeugt hatte, ohne `DROP ... IF EXISTS` → `42710`
nach 178 von 276 Dateien. Der fehlende DROP ist inzwischen ergänzt (der Fehler entsteht,
*während* diese Datei läuft — keine spätere Migration kommt je an die Reihe, "neue Datei
statt Bearbeitung" ist hier mechanisch unmöglich).

**Damit ist NICHT behauptet, dass die Kette jetzt durchläuft.** Das war der bekannte
*erste* Bruch; ob dahinter weitere liegen, ist ungemessen. Bis das jemand misst, bleibt
der Baseline der Weg für lokale Integrationstests.

## PostgreSQL-Version

Der Teststack läuft auf **derselben Version wie die Produktion**: `postgres:15.8.1.085`
(`major_version = 15` in `runtime/supabase/config.toml`). Bis 2026-07-28 stand dort 17 —
ein Test konnte lokal grün sein und in der Produktion scheitern.

Beim Angleichen kam heraus, dass das schlanke lokale Image ein **älteres `auth.uid()`**
mitbringt, das nur die Einzahl-GUC `request.jwt.claim.sub` liest, während Fixtures und
Zusicherungen die Mehrzahl-Form `request.jwt.claims` setzen. `auth.uid()` lieferte damit
NULL, jede firmenbezogene Policy war falsch, und die Tests hätten das Gegenteil dessen
bewiesen, wofür sie da sind. `auth-supplement.sql` ergänzt deshalb `auth.uid()`,
`auth.role()` und `auth.email()` wörtlich aus der Produktion.

Wer die Version wieder ändert: das PG-Datenverzeichnis ist nicht abwärtskompatibel. Erst
`supabase --workdir supabase-test/runtime stop --no-backup`, dann das Volume entfernen,
dann neu starten. Der Stack ist ohnehin Wegwerfware.

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
against a fresh capture to detect drift.

**Die Abfragen hinter jeder Zahl stehen seit 2026-07-28 im Manifest selbst**
(`counting_recipe`). Vorher war das nicht festgehalten, und die Werte liessen sich nicht
reproduzieren: `enums` stand auf 28 — weder die 15 Enum-*Typen* noch die 84 Enum-*Werte* —,
`check_constraints` auf 388, weder die 68 echten CHECKs noch die 437 inklusive NOT NULL.
Zahlen aus Manifesten vor diesem Datum sind mit den heutigen **nicht vergleichbar**. The manifest's `deliberate_test_differences` is
the **only** allowed divergence from prod; anything else is drift to investigate.

## What this is NOT

Not a replacement for the production migration strategy. Prod continues to deploy via
`supabase/migrations/`. This baseline exists solely so RLS/RPC/token/relation behaviour
can be tested on a disposable local DB.
