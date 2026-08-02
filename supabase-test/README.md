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
   - Quoted URL / email / IP / `Bearer` literals → placeholders.
   - The refresh then scans **every** production-derived output — `schema.sql`, all three
     ACL snapshots, the enum dump, the manifest values and the finished manifest itself —
     and aborts on: any URL scheme, credentials inside a DSN, `vault.`, `net.http`, any
     `cron.<name>` schema reference, a `Bearer` value, a JWT-shaped value,
     Anthropic/OpenAI/Google/Resend/webhook/AWS key shapes, an e-mail address or an IPv4
     address. The bare word `cron` is *not* rejected — legitimate comments say "run daily
     via cron."; the schema reference is what matters.

     Placeholder exemptions require the placeholder to **end**, not merely to occur:
     `test.invalid.evil`, `test@test.invalid.evil`, `Bearer test-placeholder-real-secret`
     and `127.0.0.100` are all rejected. These, and the key shapes with `_`/`-`, are
     regression fixtures in `scripts/test-baseline-tooling.sh` — the checks are pattern
     matching, not proof, and the fixtures are what keeps them honest.
3. The dump uses `--no-privileges`, so privileges are reconstructed separately. What the
   snapshots reproduce is **not** "the exact production ACL" but a
   **tracked-principal direct-privilege projection**: the *directly* granted privileges of
   exactly four principals — `PUBLIC`, `anon`, `authenticated`, `service_role`.
   - `grants.sql` — static schema-level `USAGE`. In the current generation that is its *only*
     executable line; the blanket sequence grant belonged to the state before the sequence
     snapshot existed and is gone;
   - generated `table-grants.sql` — table/view/matview ACLs incl. `PUBLIC` and grant options;
   - generated `sequence-grants.sql` — sequence ACLs;
   - generated `function-grants.sql` — function ACLs incl. `PUBLIC` and grant options.

   Each generated file revokes its own field first and then rebuilds it, so every file is
   repeatable on its own and the group is too. Each carries a fingerprint that it re-checks
   *inside the restored database*.

   Which of the two sequence states you are in is not a matter of reading dates: whenever
   `sequence-grants.sql` exists, `grants.sql` must no longer carry the blanket grant, and
   whenever it does not, `grants.sql` must. `baseline_check_sequence_transition` enforces
   exactly that and refuses to start otherwise — there is no third state and no silent skip.

   **`grants.sql` is frozen, and that is checked literally.** That file is not a
   general-purpose SQL script, so it is not parsed as one. `baseline_has_blanket_sequence_grant`
   (`scripts/baseline-artifacts.sh`) holds it against a **literal allow-list**, one physical
   line at a time (lines split on LF only). Exactly four things are permitted:

   1. blank lines made of ASCII spaces and tabs;
   2. **whole** comment lines — after ASCII spaces/tabs the line starts with `--`; the text
      after that may contain Unicode, since the explanations in the file do;
   3. **byte-for-byte, exactly once**, the canonical statement —
      `grant usage on schema public to anon, authenticated, service_role;`
   4. **byte-for-byte, at most once**, the historical transitional line —
      `grant all privileges on all sequences in schema public to authenticated, service_role, anon;`

   Around 3 and 4 only ASCII spaces and tabs may appear. There is no lower-casing, no
   whitespace normalisation, no comma smoothing and no pattern: the two statements are
   *compared*, not interpreted. Different capitalisation, a different role order or one extra
   space is "outside" — not because it would be dangerous, but because this file is frozen and
   any deviation has to be a deliberate decision.

   Everything else is outside the list: multi-line SQL, block comments, string literals,
   dollar quoting, `SELECT`/`DO`/`CALL`/`CREATE`, GRANTs on individual objects, psql
   meta-commands, `:name` interpolation, NUL, invalid UTF-8, CR (so CRLF files), and the
   Unicode line separators U+2028/U+2029/U+0085. The scan then returns "undecidable", and
   `test-db.sh` / `wiki-db.sh` refuse to start — there is a `DROP SCHEMA` behind that gate,
   so an unclear file must not be allowed through. `refresh-test-baseline.sh` is the one
   caller that does *not* abort on it: by the time it checks, the capture is already
   published and valid, so it stays exit 0 and prints a loud `UNBEKANNT` warning instead.

   Why this strict: the check was three other things first, and each was demonstrably wrong.
   A `grep` over the whole file counted a *quotation in a comment* as code and blocked the
   gate twice. A hand-written SQL lexer then missed a non-ASCII dollar tag — PostgreSQL
   allows non-ASCII in identifiers — and a real `GRANT … ON ALL SEQUENCES` placed between two
   such literals disappeared into what the lexer took for a comment. A narrow grammar *with
   normalisation* then used Python's Unicode notion of whitespace, which PostgreSQL does not
   share: an NBSP inside the canonical line was normalised away and the file counted as clean,
   although PostgreSQL would fail on that very line with a syntax error — and its
   `grant … on all sequences …` pattern also accepted nonsense such as
   `grant nonsense on all sequences nonsense;` as a documented transition. Three times the
   same shape of mistake: an *approximation* of PostgreSQL treated as truth. An equality
   check cannot have that failure mode.

   Practical consequence for contributors: **do not add SQL to `grants.sql`.** Table,
   sequence and function privileges belong in the generated snapshots. If a new static
   statement is genuinely needed, the allow-list in `baseline_has_blanket_sequence_grant` has
   to be widened deliberately, together with its tests.

   **Out of scope, deliberately:** grantor chains, owner privileges, role memberships, all
   other roles, schema ACLs beyond the static `USAGE`, default privileges (`pg_default_acl`),
   column ACLs, object owners, and privileges on types/domains. None of these are carried
   into the test stack — the baseline does **not** make them match production.

   Two different things must not be confused here:
   - **Parity** (does test look like prod?) — out of scope for everything in that list.
   - **Change during a capture** (did prod move while we read it?) — the drift probe *does*
     cover column, schema, type and default ACLs plus relation/function/type/schema owners,
     because a change there would silently invalidate the projection mid-run.

   Three omissions additionally **abort** the refresh outright, because they would corrupt
   the result rather than merely differ from it: a column ACL, a missing tracked role, and a
   grant whose grantor is not the object owner.

   **RLS is not disabled or loosened** — carrying the production table grants is what makes
   an "anon is denied" assertion test RLS rather than pass because a prerequisite grant is
   accidentally absent.
4. Publication is **per-file atomic plus generation fail-closed** — *not* group-atomic. There
   is no filesystem primitive that renames five files as one operation, and this does not
   pretend otherwise. Each individual `mv` is atomic (same filesystem, so it is a rename);
   what makes the *group* safe is that any partial outcome is detected and refused, not that
   it cannot happen. The refresh stages the files next to the target, then — holding the
   exclusive lock — writes the **manifest first** and the four files after it. The manifest
   carries each file's SHA-256 and a `generation` id derived from those hashes.

   Manifest-first is deliberate. Interrupt the run at any rename and the published manifest
   names hashes that the files on disk do not have, so `verify_baseline_artifacts` refuses.
   Files-first would leave one window — after the last file, before the manifest — where an
   old manifest with old hashes sits on four already-new files and looks like a valid older
   generation.

   The verification is exact, not advisory: the artifact set must be precisely those four
   names (no more, no fewer, no path separators), every hash must match, and `generation` is
   recomputed from the hashes rather than trusted.

   There is no unverified state. A manifest without `artifacts` is accepted only when it
   says so itself (`artifact_verification: "pending-first-refresh"`) **and** carries
   `legacy_artifacts` + `legacy_generation` — the same computation over the three files that
   pre-date hash publication. In that state `sequence-grants.sql` must be absent; if it
   exists, the manifest is lying about the state and the run is refused. Applying the
   privilege files follows the same rule: a missing file aborts, and only
   `sequence-grants.sql` may be absent, only in that documented state.

## Files

| File | Purpose |
|---|---|
| `runtime/supabase/config.toml` | **Dedicated** test-stack config: project_id `crm-test`, db port `54342`. |
| `baseline/schema.sql` | Sanitized public schema (tables, enums, RLS, policies, RPCs, triggers). |
| `baseline/prereqs.sql` | Test stub for the excluded `besichtigung` schema (the one public view depends on it). |
| `baseline/auth-supplement.sql` | `auth.jwt()` + newer `auth.users` columns (applied as `supabase_admin`). |
| `baseline/guard-marker.sql` | In-db identity marker `crm_test_guard.identity` (survives the `public` wipe). |
| `baseline/grants.sql` | **In this generation: schema-level `USAGE` only** — the one executable line. The exact historical blanket sequence grant is still *recognised* by the grammar, solely so a verified legacy manifest stays loadable; it is **not present** in this file. |
| `baseline/table-grants.sql` | Generated table/view ACL projection + restore fingerprint assertion. |
| `baseline/sequence-grants.sql` | Generated sequence ACL projection. Present ⇔ `grants.sql` carries no blanket sequence grant (enforced, see above). |
| `baseline/function-grants.sql` | Generated function ACL projection + restore fingerprint assertion. |
| `baseline/parity-manifest.json` | Counts, schema + ACL fingerprints, artifact hashes/`generation`, migration checkpoint, deliberate diffs. |
| `../scripts/baseline-artifacts.sh` | Shared apply order, generation (hash) verification and sequence-transition check, used by `test-db.sh` and `wiki-db.sh`. |
| `../scripts/test-baseline-tooling.sh` | Fault-injection tests for the above. No DB, no network (`ssh` is stubbed). `npm run test:baseline`. |
| `seed/fixtures.sql` | Synthetic two-tenant fixtures (superuser setup only). |
| `tests/assertions.sql` | RLS / token / relation / atomicity assertions as `anon`/`authenticated`. |
| `tests/auftrag-contract.sql` | Auftrag Insert/Update persistence contract (trigger nummer, enum, JSON/financial round-trip). |

## Running

The tests run against a **dedicated, uniquely-named** stack (project `crm-test`, db `54342`) —
NOT the app's `supabase/config.toml` stack and NOT any other project. Always use its own
workdir:

```bash
npm run test:db:up                       # wrapper: own docker network, bound to 127.0.0.1 only
CRM_TEST_ENV=1 npm run test:db:bootstrap # marker + schema + grants + fixtures (first-time / reset)
CRM_TEST_ENV=1 npm run test:db           # disposable rebuild + assertions + auftrag contract
npm run test:db:down                     # wrapper: stops this project, keeps the network
```

**Never start it with a bare `supabase start`.** Docker publishes ports on `0.0.0.0` by
default — every interface on the machine, Wi-Fi and VPN included — and a disposable stack
whose password `supabase start` prints on screen would be reachable from the whole network.
The binding address cannot be set per invocation, but it can be set per *network*:

```bash
# This is what the wrapper runs. Reproduced here to be readable, not to be pasted:
# the wrapper additionally verifies the result, and a network created by hand without
# BOTH labels below will be rejected by it.
docker network create \
  --driver bridge \
  --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
  --label crm.repo=crm-project \
  --label crm.purpose=crm-test-stack \
  crm-test-loopback
supabase --workdir supabase-test/runtime start --network-id crm-test-loopback
```

`scripts/supabase-stack.sh` does exactly that, one dedicated network per stack
(`crm-test-loopback`, `crm-wiki-loopback`, never shared), and then re-reads the real runtime
state to check it actually worked. The global Docker setting (`/etc/docker/daemon.json`)
would be the shorter route and is deliberately not taken: it applies to every container on
the machine, including other people's.

**What `up` does with what it finds.** Three situations, handled differently:

| Found | Behaviour |
|---|---|
| no container carrying this CLI project label | fresh start |
| a complete stack | **verified, and if it passes, reused** — not restarted |
| a *partial* stack (project containers exist but the db is missing), or a foreign container under one of our names | refusal — nothing is stopped, deleted or taken over |

A verified existing stack is reusable; that is the point of checking it rather than
restarting it. What `up` never does is *adopt* an unverified one.

**What gets stopped automatically, precisely.** Only the stack that *this run* just started
itself, and only when the post-start verification fails. There is no durable receipt of who
started a running stack, so the wrapper does not claim it "only ever stops what it started" —
it cannot know that. The rollback is armed *before* `supabase start` (a failing start used to
exit the script under `set -e` and leave half-created containers behind), it runs on `EXIT`,
`HUP`, `INT` and `TERM`, it is idempotent, and it re-measures afterwards: if the containers
cannot be proven gone, it says so loudly and exits non-zero rather than reporting "stopped".
`SIGKILL` and a machine that loses power are outside what any of this can promise.

**`down` is the explicit request**, so it is allowed to stop a stack whose bindings are
*unsafe* — requiring safe bindings there would lock out exactly the dangerous case. It still
verifies first: the project/workdir pairing, the exact container names and the CLI project
label. A foreign container sitting under one of our names stops the operation. A partial but
correctly-labelled stack can be shut down. Afterwards it re-measures — over the whole project inventory, not just the two container
names it knows — reports a failed stop instead of swallowing it, and leaves the network
alone. It makes no claim about that network: the `down` path never inspects it. The network
simply stays, and the next `up` verifies it again.

Two states are distinguished after a stop. If nothing of the project is left, that is a clean
teardown. If **stopped** containers remain, that is *not* an error — the assertion being made
is "nothing of this project is running", and a stopped container serves no one — but they are
named explicitly, and the next `up` refuses because of them. That is the right place to force
`docker rm`. If anything is still running, or a state could not be read at all, the exit code
is 3 and the wording is "not proven stopped".

Only one run per project at a time, and `scripts/test-db.sh` / `scripts/wiki-db.sh` hold the
**same** per-project `flock` — taken before their first Docker query and held until the
destructive work is done. Without that shared lock there is a window: the guard establishes
the container's identity, and while `DROP SCHEMA` then runs, a `down` could tear the stack
down or an `up` could start a different one, so the check would have applied to something
other than what gets hit. The lock uses file descriptor 9; the baseline lock uses 8, so both
hold at once. `up test` and `up wiki` may still run in parallel.

A failed inventory is never read as "nothing there". `docker ps` returning non-zero is a third
state next to "empty" and "found": `up` will not start and `down` will not report "nothing to
stop" — both refuse, because neither has measured anything.

**`api.enabled = false` does not mean "no gateway container".** This was measured, not
assumed. In the first real run (A.5.1a, Supabase CLI 2.98.2) the crm-test stack started with
`[api] enabled = false` and the CLI brought up `supabase_kong_crm-test` anyway, publishing
`8000/tcp` on host port **54321** — the Supabase default, which appears nowhere in this
stack's config and is the API port of the *root* project (`supabase/config.toml`). The
binding was loopback; it was still wrong.

So the gateway port is now declared explicitly, one reserved block per stack:

| Stack | gateway | db | shadow |
|---|---|---|---|
| root (`supabase/config.toml`) | 54321 | 54322 | 54320 |
| crm-test | **54341** | 54342 | 54340 |
| crm-wiki | 54421 | 54422 | 54420 |

`scripts/supabase-stack.sh` reads it as `GATEWAY_PORT` — not `API_PORT`, because the value
says nothing about whether PostgREST runs. Two rules follow:

- **The gateway container is mandatory for both stacks**, `enabled = false` included.
- **It never falls into the generic container branch.** That branch only requires "no binding
  outside 127.0.0.1", and 54321 satisfies that — which is exactly how a silent default would
  slip through. The gateway must publish `8000/tcp` as precisely `127.0.0.1:<GATEWAY_PORT>`,
  on the expected network, under the right project label.
- **"No other publication" is a checked guarantee, not an assumption.** The gateway is verified
  in `loopback_verify_container`'s **strict mode** (its optional 7th argument): the expected
  port must exist with *exactly one* published binding — a repeated identical binding is
  refused too — and **no other container port may carry a published binding at all**, not even
  a loopback one. Ports that are exposed but unpublished (`null`) stay fine, because they are
  not reachable from the host. Strict mode decides from the *same* `docker inspect` as every
  other check; there is deliberately no second inspect, which would reopen the TOCTOU window
  closed in A.5.0.1. An unknown mode value is a refusal, not a fallback to the lenient path.

Strict mode applies **only** to the gateway. The db container and generic project containers
keep their existing contract, under which a second *loopback* published port is permitted.

**The `up` port contract is fail-closed.** A missing, empty, non-numeric, out-of-range, or
db-colliding `[api] port` is refused **before the first docker or supabase call**.

**`down` is deliberately not subject to that contract.** The port check used to run before the
up/down split, which meant a config with a bad or missing port locked you out of *shutting the
stack down*. That is exactly backwards: a stack whose configuration is wrong is one you most
urgently need to be able to stop, and the same goes for a stack that is publishing unsafely.
So `down` never consults the ports at all — it works from the project label, the exact
container names and the inventory. Everything else on that path is unchanged: the
project/workdir pairing, the lifecycle lock, the exact-name check, the project label, the
refusal to touch a foreign container, and the post-stop measurement. A wrong `project_id` still
stops nothing, because then it is not clear whose stack is meant.

If a future CLI renames or drops the gateway container, the guard stops rather than guesses:
there is deliberately no allow-list of possible future container names. That is a
fail-closed halt and the contract then gets updated on purpose, with evidence.

Before starting anything, `up` also refuses on a Docker Engine older than major version 28.
Docker documents that on older engines, ports published to localhost could still be reached
from the same L2 segment — the binding would say `127.0.0.1` and not hold. `down` is never
blocked by this: a dangerous stack must always be closable.

The guard logic is `loopback_verify_container` in `scripts/docker-loopback.sh`. From a
**single** `docker inspect` it checks the container's name, that it is running, its
`com.supabase.cli.project` label, that it hangs in exactly the expected network, and that
every published binding of **every** port is `127.0.0.1` — the port it was asked about
additionally on the expected host port. One inspect, because reading the label with one call
and the bindings with another means the two may describe different containers. Unpublished
ports (Docker writes `null`) are fine: internal-only is what is wanted here.

Every container carrying the project label goes through that check, not just db and kong — an
`auth` or `rest` container published on `0.0.0.0` used to pass unnoticed. The inventory
carries container IDs and the inspect runs on the ID, so a name cannot come to mean a
different container in between.

`src/test/published-bindings.ts` is the pure, tested specification of the **binding** part of
that rule only; the name/state/label/network checks live in the shell because they need a live
inspect. Neither reads `docker port … | head -1` any more, which showed only the *first*
binding and hid a second one on `0.0.0.0` behind it. `npm run test:stack-guard`
exercises all of this against stubbed `docker`/`supabase` binaries; it starts nothing. Those
stubs are allow-lists — any call shape the tools are not supposed to make returns rc=99, so a
newly added `docker rm` would fail the suite instead of silently working.

Fail-closed (see `scripts/test-db.sh` ↔ tested spec `src/test/db-guard.ts`): before the
destructive `DROP SCHEMA public CASCADE`, FIVE independent signals must all hold —
`CRM_TEST_ENV=1`, **loopback-only publication** (every binding exactly `127.0.0.1` — a
wildcard such as `0.0.0.0` or `::` is a refusal), the dedicated port `54342` (**never** the
54322 default),
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

### Migration checkpoint — a claim, not a proof

`migration_checkpoint.declared_through` in the manifest is a **manual assertion**. Production
runs **no** `supabase_migrations.schema_migrations` ledger, so nothing can confirm "applied up
to here"; the field is carried over by hand on every refresh.

The only machine-readable evidence is the `undo_…` tables under
`migration_checkpoint.evidence`. From the next refresh onwards that list is **measured** —
the script enumerates `public.undo_%` in production and stamps each entry with
`observed_at`, so a table that no longer exists drops out by itself rather than lingering as
a stale claim. The entries prove **exactly** the migrations they name and nothing about the
~366 before them; `declared_through` is therefore not evidence of a contiguous chain. They
are also perishable: running a `ROLLBACK_…` script drops the table and with it the entry
(and changes the `tables` and `indexes` counts).

Separately: a schema-only dump cannot replay or prove **row** changes made by data migrations
(for example deleting a legacy role row). Those effects need their own fixtures/assertions or
production evidence — see `deliberate_test_differences.data_migrations`.

## Keeping it current (drift)

The baseline is a snapshot. Re-generate after schema- or privilege-affecting migrations:
re-run the read-only dump → sanitize → re-run `npm run test:db`. Compare the manifest schema
fingerprints plus `table_acl_fingerprint_md5`, `sequence_acl_fingerprint_md5` and
`function_acl_fingerprint_md5` against a fresh capture to detect drift.

The refresh has **no built-in production target**. Host, container, the expected cluster
identity and a confirmation bound to that identity are all required, and it aborts before
opening any connection if one is missing or malformed:

Both confirmations are SHA-256 values over the **whole target** — host, container and cluster
identity together — so a command line copied and re-pointed carries the wrong confirmation:

```bash
TARGET="root@<host>|<db-container>|<system_identifier>"
READ_CONFIRM=$(printf '%s' "$TARGET" | sha256sum | cut -d' ' -f1)
FREEZE_CONFIRM=$(printf 'change-freeze|%s' "$READ_CONFIRM" | sha256sum | cut -d' ' -f1)

CRM_PROD_SSH=root@<host> \
CRM_PROD_DB_CONTAINER=<db-container> \
CRM_PROD_SYSTEM_IDENTIFIER=<pg_control_system().system_identifier> \
CRM_PROD_READ_CONFIRM=$READ_CONFIRM \
CRM_PROD_CHANGE_FREEZE_CONFIRM=$FREEZE_CONFIRM \
  bash scripts/refresh-test-baseline.sh
```

On mismatch the script does **not** print the expected value. Printing it would turn the
confirmation into a form to fill in: run once, copy the value, done.

The identity check is `pg_control_system().system_identifier`, compared against the value you
supply. Database name, server version and table names are **not** identity — every copy of
this CRM for another company would pass those. The identifier is never learned during the run
and stored as "expected": that would make the first connection to the wrong instance its own
authorisation.

Two further preflights run after it, and they are **shape checks, not identity**: seven core
CRM tables must exist (catches the right instance, wrong database), and the three tracked
roles must exist (without them the projection would be silently incomplete). Both, plus the
column-ACL and grantor checks, run **again** after the last capture.

`CRM_PROD_CHANGE_FREEZE_CONFIRM` is a separate assertion — not "I am reading the right
instance" but "while I read, nobody changes it". Detection is two-sided:

- **Schema:** the `pg_dump` is taken a second time after every other capture and compared.
  Only the two version lines in the header are normalised away. This is what catches function
  bodies, `SECURITY DEFINER`, `search_path`, policy `USING`/`WITH CHECK`, views, triggers,
  constraints, indexes, enum values and RLS switches — none of which a name-based fingerprint
  would see.
- **Privileges:** the dump runs with `--no-privileges`, so a separate fingerprint covers
  relation, function, column, schema, type and default ACLs plus the undo tables.

Both are **detection, not prevention**, and neither sees an A→B→A change that is made and
reverted inside the window. That is why the freeze is confirmed explicitly rather than
assumed. Do not run migrations, DDL or `GRANT`s against production while a refresh is in
flight.

`CRM_PROD_SSH_CONFIG` is optional and defaults to `/dev/null`, i.e. your personal
`~/.ssh/config` is deliberately **not** read, so the run is reproducible. If your credentials
live there (`IdentityFile`, `ProxyJump`), point this at it: `CRM_PROD_SSH_CONFIG=~/.ssh/config`.

Every remote database session runs with
`PGOPTIONS=-c default_transaction_read_only=on`. That is **accident protection, not a security
boundary**: the setting is a GUC and a superuser session could switch it off with `SET`. It
protects against a typo in the script writing to production — not against someone who intends
to. Every statement the script issues is hard-coded and read-only.

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

### The baseline is not an installer

`scripts/refresh-test-baseline.sh` builds a **test** baseline. It is **not** the procedure for
standing up a new company on a new Supabase instance, and it must not be reused as one. Two
reasons, and they point in opposite directions:

- **`--no-privileges` is right here and wrong there.** Here the ACLs are captured separately
  and more precisely. An installer dump that drops privileges would silently re-open every
  function that production has closed — Postgres' default for a function without an ACL is
  `EXECUTE TO PUBLIC`. An installer dump therefore runs **without** `--no-privileges`.
- **The projection is intentionally narrow.** Four principals, direct grants only. An
  installer needs the whole picture: roles and their memberships, object owners, schema ACLs,
  sequence ACLs, default privileges (`pg_default_acl`) — plus everything that is not in the
  `public` schema at all: `cron` jobs, storage buckets and their `public` flags, vault
  secrets, extensions.

Whoever writes the installer starts from those two lists, not from this script.
