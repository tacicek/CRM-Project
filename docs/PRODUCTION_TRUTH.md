# Observed production truth

What is **actually running** in production, measured read-only and stored as a dated record
under [ops/production-truth/](../ops/production-truth/).

Tool: [scripts/capture-production-truth.sh](../scripts/capture-production-truth.sh).
Tests: `npm run test:prod-truth` (ssh is mocked, no network).

## Why this exists

This repository can say what *it* contains. Until now it could not say what production
*runs*: migrations are applied by hand, Edge Functions are copied by hand, and
`supabase/config.toml` carries per-function `verify_jwt` settings that this installation does
not evaluate. Every security statement therefore ended in "probably".

The record answers the questions that can be answered by reading:

| Question | Artifact |
|---|---|
| Is the Edge gateway open? | `edge-runtime.json` → `edge_runtime.verify_jwt`, `gateway.functions_route_plugins` |
| Which functions are really deployed, with what content? | `edge-runtime.json` → `deployed_functions[]` (`index_ts_sha256`, `tree_sha256`) |
| Who may execute which database function? | `function-authz.json` |
| Where does RLS stand, and what do the policies do? | `table-authz.json`, `policies.json` |
| Does `execute_sql` exist, and what may it do? | `execute-sql.json`, `execute-sql-definition.sql` |
| Are old cloud URLs or JWT-shaped values still embedded? | `remnants.json` |
| Is the customer portal used at all? | `portal-usage.json` |
| Is a deployed function gone from the repo (or the repo undeployed)? | `deploy-repo-diff.json` (repo ↔ config ↔ deploy three-way diff) |
| What does a deploy-only function actually do? | `deploy-only-sources.json` (full source, sanitized) |
| Do the artifacts belong together? | `capture-manifest.json` (SHA-256 per artifact + derived `generation`) |

## What it is not

- **Not a migration ledger.** It records the schema that *exists*, not the files that produced
  it. `supabase/migrations/` still has no applied-history table. The one exception is
  incidental: `undo_<timestamp>` tables show up in `table-authz.json`, and each is evidence
  that its migration ran.
- **Not a deployment manifest.** It records what *is* deployed, not what *should* be.
  Desired-state reconciliation is separate, later work.
- **Not a replacement for `supabase-test/baseline/`.** That is a rebuildable test stack; this
  is evidence. Both read the same production through the same access and identity checks
  ([scripts/prod-readonly.sh](../scripts/prod-readonly.sh)), but they answer different
  questions — see *Reading the record* below.
- **Not an expression archive.** Policy `USING`/`WITH CHECK` are recorded as hashes plus
  traits, never verbatim. The wording lives in the migrations, and exactly one expression in
  this database contains a contact literal — a record that carries addresses is a record that
  cannot be published.

## Running it

Read-only throughout: every database connection carries
`PGOPTIONS=-c default_transaction_read_only=on`, and the Docker calls are `inspect` and
`exec … sha256sum/grep/find`. No write path, no restart, no deploy.

```bash
TARGET="root@<host>|<db-container>|<system_identifier>"

CRM_PROD_SSH=root@<host> \
CRM_PROD_DB_CONTAINER=<db-container> \
CRM_PROD_EDGE_CONTAINER=<edge-container> \
CRM_PROD_KONG_CONTAINER=<kong-container> \
CRM_PROD_SYSTEM_IDENTIFIER=<system_identifier> \
CRM_PROD_READ_CONFIRM=$(printf '%s' "$TARGET" | sha256sum | cut -d' ' -f1) \
  bash scripts/capture-production-truth.sh
```

There are no built-in targets. The confirmation is bound to the **whole** target, so a copied
command line with a swapped host carries the wrong confirmation. On mismatch the script does
not print the expected value — printing it would turn the confirmation into a form to fill in.

`CRM_PROD_SYSTEM_IDENTIFIER` must come from an independent source; the script never learns it
and stores it as "expected". Two sources qualify today: an operator who has it out-of-band,
or `source_identity_fingerprint_sha256` in
`supabase-test/baseline/parity-manifest.json`, which was written by the last authorised
capture — recompute `sha256(host|container|identifier)` and compare.

An existing record for the same day is **not** overwritten. Replacing evidence is a deliberate
act: `CRM_TRUTH_REPLACE=1`.

## Fail-closed by design

The dangerous failure of this tool is not a crash, it is a **reassuring wrong answer**: "no
plugins on the route", "no functions deployed", "no scheduled jobs". Each of those could arise
from a failed read and would look like a clean bill of health. They are therefore aborts, and
each has a test in [scripts/test-prod-truth-tooling.sh](../scripts/test-prod-truth-tooling.sh):

- Kong's `plugins:` block unreadable → abort, not "no plugins".
- Edge function list empty → abort, not "nothing deployed".
- Function root not derivable from `--main-service` → abort, not a guessed path.
- A yes/no probe returning anything but `true`/`false` → abort, not "no".
- Privileges or policies changing mid-capture → abort, nothing published.
- The sanitizer finding a secret in a captured body → abort, nothing published, and the
  finding itself is never printed.

The last one deserves its own note: `(x IS NOT NULL)::text` yields `true`/`false`, **not** the
`t`/`f` that psql displays for a boolean column. The first version of this tool compared
against `t` and therefore reported that neither scheduled jobs nor portal tables existed while
both were present. `prod_bool` now rejects any other value instead of reading it as "no".

## Residue: repo ↔ config ↔ deploy

Code, `supabase/config.toml`, and what is actually deployed can drift independently — this
repository has manual migration application and manual Edge deployment, so nothing keeps them
in sync automatically. The concrete case that motivated this section: `docs/SISTEM_PRD.md`
*claims* `accept-lead` is deployed with no local source and no caller. That is a documentation
claim about a live system, not a measured fact, and the whole point of this tool is to stop
trusting documentation claims about live state.

`deploy-repo-diff.json` computes four sets, purely from what's already been gathered — the
local repo checkout (`supabase/functions/*/index.ts`), the local `supabase/config.toml`
(`[functions.<name>]` entries), and `edge-runtime.json`'s `deployed_functions` (no extra
production round-trip):

- `deploy_only` — deployed, no local source. **This is the `accept-lead` class**: code deleted,
  server never told.
- `repo_only` — local source, not deployed. Written, never shipped or since retired.
- `config_only_missing_from_repo` — a `config.toml` entry with no matching source directory.
- `repo_missing_from_config` — a source directory `config.toml` never declares.

For every name in `deploy_only`, `deploy-only-sources.json` holds the **full deployed source**
— `{"source": "...", "redacted": false, "redaction_reason": null}`. That turns "what does this
dead function actually do" from a one-off SSH session into something every capture answers.

Unaudited dead code is exactly the code most likely to embed a literal secret — that's *why*
it's dead and unaudited. A single flagged function therefore does **not** abort the whole
capture the way every other artifact does; it redacts only that entry —
`{"source": null, "redacted": true, "redaction_reason": [{"category": ..., "count": ...,
"fingerprint": ...}]}`, using the identical category/count/fingerprint shape
`baseline-sanitize.py` already reports elsewhere, never the matched text. The same sanitizer
still runs over the finished file afterward as a second net — it should always find nothing at
that point, since flagged content never reaches the file — and aborts the entire capture if it
does, the same as every other artifact.

A missing local `supabase/functions/` directory or `config.toml` is treated as an empty set,
not an error — it's a named condition (this checkout doesn't have that side), not a silently
swallowed failure. A function name from the deployed listing that contains anything outside
`[A-Za-z0-9_-]` aborts the capture before it is used in any remote command — directory names
from `for d in */` on the container are trusted input in every other part of this script, and
this is the one place a name gets interpolated into a composed remote command
(`ssh → docker exec → sh -c`), so it gets its own check.

## Reading the record

`table-authz.json` reports **effective** privileges (`has_table_privilege`), i.e. "can this
role do it". That is the right question for a security read, but it is not the right input for
a `REVOKE`: effective privilege can come from a direct grant, from `PUBLIC`, or through role
membership, and each is revoked differently. For the **direct** projection use
`supabase-test/baseline/table-grants.sql` / `function-grants.sql`, which record exactly that
and nothing else.

`body_matches_write_keyword` in `function-authz.json` is a **heuristic** and is named so: it
says a write keyword occurs in the body, not that the function writes. A comment containing
the word `update` is enough. Use it to order review effort, never as a finding.

## Observation of 2026-08-10 — after the second grants wave

Record: [ops/production-truth/2026-08-10/](../ops/production-truth/2026-08-10/),
generation `b92a3bf64015b2eb`, captured **after**
`supabase/migrations/20260809120000_funktionsrechte_zweite_welle.sql` was applied.

**Migration effect, verified read-only, not assumed from the migration's own success:**

- `anon`-executable functions in `public`: **154 → 32** (122 revoked, matching the migration's
  own `undo_20260809120000` row count exactly).
- Zero trigger functions remain `anon`- or `authenticated`-executable (was 81).
- All 10 `/firma` functions (`archive_and_purge_company_data`, `replace_offer_items`, …) lost
  `anon` and **kept** `authenticated` — checked individually, not just as a count.
- All 9 public token RPCs (`get_offer_by_token`, `get_appointment_by_action_token`,
  `portal_overview`, …) are untouched — still `anon`-executable.
- The 9 policy helpers (`is_company_member`, `is_admin`, …) and the 2 constraint/default
  dependencies (`normalize_customer_email`, `normalize_customer_phone`) are untouched, by
  design — see the migration's own header for why.
- `service_role` lost nothing on any of the 122 revoked functions.

**Residue: what's deployed with no repo source.** `deploy-repo-diff.json` →
`deploy_only: ["accept-lead", "hello", "main"]` — `accept-lead` matches
`docs/SISTEM_PRD.md`'s claim (Offerio multi-tenant lead-distribution remnant), now measured
rather than merely documented. `hello` and `main` are the stock Supabase Edge Runtime
scaffolds. `deploy-only-sources.json` holds `hello` and `main` **redacted** (a doc-comment URL
and a placeholder `Bearer <anon/service_role API key>` — confirmed benign by inspection, but
the sanitizer correctly has no way to know that from the pattern alone) and `accept-lead`
redacted for the same class of reason (four import-URL literals, no embedded credential found
on inspection — it reads `SUPABASE_SERVICE_ROLE_KEY` from the environment, not a literal).

## Observation of 2026-08-09

Record: [ops/production-truth/2026-08-09/](../ops/production-truth/2026-08-09/),
generation `f1c52c9ec2c19fda`, PostgreSQL 15.8.

**Gateway and Edge runtime — the config file was fiction, and now it is measured.**

- `VERIFY_JWT=false` on the Edge runtime.
- The Kong route serving `/functions/v1/` carries exactly one plugin: `cors`. No auth plugin.
- 42 function directories deployed under `/home/deno/functions`, each with an `index.ts`
  digest and a whole-tree digest.

Every Edge Function is therefore reachable unauthenticated at the gateway. Authorisation
exists only where a handler implements it. Setting `verify_jwt = true` in `config.toml` would
change nothing.

**`execute_sql` — present, but not the boundary bypass it was suspected to be.**

`public.execute_sql(text, boolean)`, owner `postgres`, **`SECURITY INVOKER`**, ACL
`{postgres=X/postgres,service_role=X/postgres}` — `anon` and `authenticated` have no EXECUTE.
Because it runs as the invoker, it grants `service_role` nothing that `service_role` does not
already have. What remains true is the source-control gap: it exists in production and in
`src/integrations/supabase/types.ts`, but in none of the 332 forward migrations.

**Embedded remnants — one, and it is not a credential.**

- 12 scheduled jobs, **none** containing a JWT-shaped value or a retired cloud URL.
- Exactly one function body still contains a legacy `supabase.co` URL:
  `trigger_notify_admin_high_spam()`, and it is `anon`-executable. No JWT-shaped literal was
  found in any function body.

**The August 2026 hardening migrations did run.** `undo_20260802110000`,
`undo_20260802120000` and `undo_20260802130000` exist, corresponding to
`email_logs_sicht_und_zuordnung`, `super_admin_entzug` and `funktionsrechte_zurueckgenommen`.
Consistent with that, `anon` has neither INSERT nor TRUNCATE on `leads`.

**Privileges and RLS as measured.**

- 100 tables in `public`, **RLS enabled on all 100**, none forced.
- 220 functions in `public`; 154 are `anon`-executable, 94 of those are `SECURITY DEFINER`
  (39 of which trip the write-keyword heuristic and thus need individual review).
- `anon` holds table privileges directly (not via `PUBLIC`, and `anon` has no role
  memberships) on 96 of the 100 tables, including TRUNCATE. For SELECT/INSERT/UPDATE/DELETE
  through PostgREST, RLS is the boundary and it is enabled everywhere. TRUNCATE is **not**
  constrained by RLS — but PostgREST does not expose it, so reachability depends on whether a
  direct Postgres connection as `anon` is possible from outside. That is an open check, not a
  demonstrated exploit.
- 232 policies. 14 have an unrestricted `USING (true)`; all are SELECT except one DELETE
  limited to `service_role`. Six of them let **any** authenticated user read
  `job_price_estimates` (38 rows), `service_acquisition_costs` (14), `pricing_rules` (2),
  `pricing_settings` (1), `moebellift_anfragen` (0) and `umzug_anfragen` (0). None of those
  six tables has a `company_id` column, so this is **not** cross-company leakage — there is no
  company dimension to cross. It is unscoped business data visible to every logged-in user,
  and the two Offerio-era intake tables among them are empty. Whether pricing and acquisition
  costs should be readable by every member of every workspace is a scoping question, not an
  isolation breach.
- One policy expression contains a contact literal:
  `admin_activity_log` / "Owner can read all activity logs". It is flagged in `policies.json`
  via `contains_contact_literal` and is not reproduced here or in the record.

**Portal usage.** `portal_magic_links` = 1 row, `portal_sessions` = 0, and
`customer_change_requests` = 0. No active session, no pending customer request.

### What this observation does not settle

- Whether the deployed digests match this repository. The record contains the digests;
  comparing them against `supabase/functions/*/index.ts` is the next step, together with the
  16 source-only and 8 config-only function names.
- Which migration produced which object. There is still no applied-history table; the
  `undo_` tables are evidence for three migrations only.
- Whether the Postgres port is reachable from outside, which is what decides how much the
  `anon` TRUNCATE privilege actually means.
- Whether any handler behind the open gateway lacks its own authorisation check. The record
  proves the gateway is open; it says nothing about individual handlers.
