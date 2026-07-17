#!/usr/bin/env bash
# Disposable local DB integration runner for the CRM.
#
# Fail-closed. Before the destructive `DROP SCHEMA public CASCADE`, it demands FIVE
# independent proofs that the target is the CRM's OWN dedicated test stack — never
# "whatever Supabase db is on the 54322 default port" (the old, dangerous behaviour that
# could wipe an unrelated project started with default ports):
#
#   1. CRM_TEST_ENV=1                      explicit opt-in, never inferred
#   2. local host                          db port bound to a loopback host
#   3. dedicated port                      == the port in supabase-test/runtime config (54342)
#   4. unique container identity           name `supabase_db_crm-test` AND CLI project label
#   5. in-db identity marker               crm_test_guard.identity == (crm-test, version)
#
# This mirrors the tested specification in src/test/db-guard.ts (see its unit tests) and the
# existing env-guard.ts pattern. It NEVER starts/stops a stack, NEVER touches a remote, and
# NEVER falls back to another port/container.
#
# Prerequisite: the dedicated stack is up (its own workdir, NOT the repo root):
#   supabase --workdir supabase-test/runtime start
#
# Usage:
#   npm run test:db:bootstrap            # create marker + schema + grants + fixtures (no marker required yet)
#   CRM_TEST_ENV=1 npm run test:db       # require marker, then rebuild + run assertions
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="run"
[ "${1:-}" = "--bootstrap-only" ] && MODE="bootstrap"

CONFIG="supabase-test/runtime/supabase/config.toml"
EXPECTED_MARKER_VERSION=1

refuse() { echo "REFUSING (db-guard): $1" >&2; exit 2; }

[ -f "$CONFIG" ] || refuse "dedicated test config '$CONFIG' not found."

# --- Expected identity is derived FROM the dedicated config (no hardcoded fallback) --------
EXPECTED_PROJECT="$(grep -E '^project_id[[:space:]]*=' "$CONFIG" | head -1 | sed -E 's/.*=[[:space:]]*"([^"]+)".*/\1/')"
EXPECTED_PORT="$(awk '/^\[db\]/{f=1; next} /^\[/{f=0} f && /^port[[:space:]]*=/{print $3; exit}' "$CONFIG")"
CONTAINER="supabase_db_${EXPECTED_PROJECT}"

[ -n "$EXPECTED_PROJECT" ] || refuse "could not read project_id from $CONFIG."
[ -n "$EXPECTED_PORT" ]    || refuse "could not read [db] port from $CONFIG."

# --- Signal 1: explicit opt-in -------------------------------------------------------------
[ "${CRM_TEST_ENV:-}" = "1" ] || refuse "CRM_TEST_ENV must be '1' (explicit opt-in; never inferred)."

# --- Signal 4: unique container identity (exact name + CLI project label) ------------------
LABEL="$(docker inspect -f '{{ index .Config.Labels "com.supabase.cli.project" }}' "$CONTAINER" 2>/dev/null || true)"
[ -n "$LABEL" ] || refuse "dedicated container '$CONTAINER' not found. Start it: supabase --workdir supabase-test/runtime start"
[ "$LABEL" = "$EXPECTED_PROJECT" ] || refuse "container '$CONTAINER' label '$LABEL' != expected project '$EXPECTED_PROJECT'."

# --- Signals 2 + 3: local host + dedicated port (from the published 5432/tcp mapping) -------
PORTLINE="$(docker port "$CONTAINER" 5432/tcp 2>/dev/null | head -1 || true)"
[ -n "$PORTLINE" ] || refuse "container '$CONTAINER' is not running / does not publish 5432/tcp."
HOST="${PORTLINE%:*}"
ACTUAL_PORT="${PORTLINE##*:}"
case "$HOST" in
  127.0.0.1|0.0.0.0|localhost|::1|::) : ;;
  *) refuse "db published on non-local host '$HOST'." ;;
esac
[ "$ACTUAL_PORT" = "$EXPECTED_PORT" ] || refuse "db port '$ACTUAL_PORT' != dedicated test port '$EXPECTED_PORT' (refusing the 54322 default)."

PSQL() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
# supabase_admin is the local superuser / auth-schema owner (postgres is unprivileged here).
# Used ONLY for the auth supplement that the postgres role may not write. The admin password
# is read from the environment (TEST_DB_ADMIN_PASSWORD) and NEVER hardcoded. For a stock local
# Supabase stack it is the value `supabase start` prints in its db URL. The script never echoes it.
: "${TEST_DB_ADMIN_PASSWORD:?set TEST_DB_ADMIN_PASSWORD (local test admin role password) before running}"
PSQL_ADMIN() { docker exec -e PGPASSWORD="$TEST_DB_ADMIN_PASSWORD" -i "$CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 "$@"; }

# --- Signal 5: in-db identity marker (to_regclass never errors on a missing table) ---------
MARKER_PRESENT="$(PSQL -tAc "SELECT to_regclass('crm_test_guard.identity') IS NOT NULL")"
MARKER_PROJECT=""
MARKER_VERSION=""
if [ "$MARKER_PRESENT" = "t" ]; then
  MARKER_PROJECT="$(PSQL -tAc "SELECT project_id FROM crm_test_guard.identity WHERE singleton")"
  MARKER_VERSION="$(PSQL -tAc "SELECT marker_version FROM crm_test_guard.identity WHERE singleton")"
fi

if [ "$MODE" = "run" ]; then
  [ "$MARKER_PRESENT" = "t" ] || refuse "identity marker missing. Run: npm run test:db:bootstrap"
  [ "$MARKER_PROJECT" = "$EXPECTED_PROJECT" ] || refuse "marker project '$MARKER_PROJECT' != '$EXPECTED_PROJECT'."
  [ "$MARKER_VERSION" = "$EXPECTED_MARKER_VERSION" ] || refuse "marker version '$MARKER_VERSION' != '$EXPECTED_MARKER_VERSION'."
else
  # bootstrap may create the marker, but must never ADOPT a foreign stack that already has one.
  if [ "$MARKER_PRESENT" = "t" ] && [ "$MARKER_PROJECT" != "$EXPECTED_PROJECT" ]; then
    refuse "existing marker project '$MARKER_PROJECT' != '$EXPECTED_PROJECT' — refusing to bootstrap a foreign stack."
  fi
fi

echo "Guard OK ($MODE): container=$CONTAINER host=$HOST port=$ACTUAL_PORT project=$LABEL marker=${MARKER_PROJECT:-<none>}"

# --- Disposable rebuild (identity proven) --------------------------------------------------
echo "==> wiping public schema (disposable) + applying sanitized baseline"
PSQL -q -c "DROP SCHEMA IF EXISTS public CASCADE;" >/dev/null
PSQL_ADMIN -q < supabase-test/baseline/auth-supplement.sql >/dev/null  # auth.jwt() (auth-schema owner)
PSQL -q < supabase-test/baseline/prereqs.sql     >/dev/null   # test stub for the excluded besichtigung schema
PSQL -q < supabase-test/baseline/schema.sql      >/dev/null   # recreates public
PSQL -q < supabase-test/baseline/grants.sql      >/dev/null
PSQL -q < supabase-test/baseline/guard-marker.sql >/dev/null  # (re)assert identity marker (idempotent)
echo "==> seeding synthetic two-tenant fixtures"
PSQL -q < supabase-test/seed/fixtures.sql        >/dev/null

if [ "$MODE" = "bootstrap" ]; then
  echo "Bootstrap complete (marker + schema + grants + fixtures)."; exit 0
fi

# --- Assertions (exit non-zero on any failure) ---------------------------------------------
echo "==> running assertions"
set +e
OUT="$(PSQL < supabase-test/tests/assertions.sql 2>&1)"; RC=$?
OUT2="$(PSQL < supabase-test/tests/auftrag-contract.sql 2>&1)"; RC2=$?
printf '%s\n' "$OUT"  | grep -E 'PASS|FAIL|ERROR|ALL DB ASSERTIONS'
printf '%s\n' "$OUT2" | grep -E 'PASS|FAIL|ERROR|ALL AUFTRAG'
set -e
if [ "$RC" -ne 0 ] || [ "$RC2" -ne 0 ]; then
  echo "DB integration suite FAILED (assertions rc=$RC, auftrag-contract rc=$RC2)"; exit 1
fi
echo "DB integration suite passed."
