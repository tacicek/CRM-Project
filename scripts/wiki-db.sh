#!/usr/bin/env bash
# Disposable local DB bootstrap for the CRM wiki SCREENSHOT stack.
#
# Fail-closed, and modelled on scripts/test-db.sh. Before the destructive
# `DROP SCHEMA public CASCADE` it demands independent proofs that the target is this
# stack — never "whatever Supabase is on a port". On this machine alone there are three
# other Postgres containers, one of them (an unrelated project) sitting on the Supabase
# default port 54322, which is exactly the accident these checks exist to prevent:
#
#   1. CRM_WIKI_ENV=1             explicit opt-in, never inferred
#   2. local host                 the db port is bound to a loopback host
#   3. dedicated port             == the [db] port in the wiki runtime config (54422)
#   4. unique container identity  name `supabase_db_crm-wiki` AND the CLI project label
#   5. dedicated api port         kong publishes the config's [api] port on loopback
#
# Expectations are DERIVED FROM THE CONFIG FILE, never hardcoded here, so editing the
# config can never leave the guard checking a stale port.
#
# Usage:
#   CRM_WIKI_ENV=1 npm run wiki:db:bootstrap      # full rebuild + seed
#   CRM_WIKI_ENV=1 npm run wiki:db:reseed         # seed only, keep the schema
#
# Optional:
#   WIKI_ANCHOR_DATE=2026-07-28   pin the date fixtures are written relative to
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG="supabase-wiki/runtime/supabase/config.toml"
MODE="bootstrap"
[ "${1:-}" = "--reseed" ] && MODE="reseed"

refuse() { echo "REFUSING (wiki-guard): $1" >&2; exit 2; }

# --- expectations, read from the config -------------------------------------------
[ -f "$CONFIG" ] || refuse "config not found at $CONFIG"

EXPECTED_PROJECT="$(grep -E '^project_id[[:space:]]*=' "$CONFIG" | head -1 | cut -d'"' -f2)"
EXPECTED_DB_PORT="$(awk '/^\[db\]/{f=1;next} /^\[/{f=0} f && /^port[[:space:]]*=/{print $3; exit}' "$CONFIG")"
EXPECTED_API_PORT="$(awk '/^\[api\]/{f=1;next} /^\[/{f=0} f && /^port[[:space:]]*=/{print $3; exit}' "$CONFIG")"

[ -n "$EXPECTED_PROJECT" ]  || refuse "could not read project_id from $CONFIG"
[ -n "$EXPECTED_DB_PORT" ]  || refuse "could not read [db] port from $CONFIG"
[ -n "$EXPECTED_API_PORT" ] || refuse "could not read [api] port from $CONFIG"

DB_CONTAINER="supabase_db_${EXPECTED_PROJECT}"
KONG_CONTAINER="supabase_kong_${EXPECTED_PROJECT}"

# --- signal 1: explicit opt-in ------------------------------------------------------
[ "${CRM_WIKI_ENV:-}" = "1" ] || refuse "CRM_WIKI_ENV must be '1' (explicit opt-in; never inferred)."

# --- signal 4: container identity ---------------------------------------------------
docker inspect "$DB_CONTAINER" >/dev/null 2>&1 \
  || refuse "container '$DB_CONTAINER' is not running. Start it: npm run wiki:db:up"

LABEL="$(docker inspect -f '{{ index .Config.Labels "com.supabase.cli.project" }}' "$DB_CONTAINER" 2>/dev/null || true)"
[ "$LABEL" = "$EXPECTED_PROJECT" ] \
  || refuse "container '$DB_CONTAINER' has CLI project label '$LABEL', expected '$EXPECTED_PROJECT'."

# --- signals 2 + 3: loopback host on the dedicated port -----------------------------
DB_PUBLISHED="$(docker port "$DB_CONTAINER" 5432/tcp 2>/dev/null | head -1 || true)"
[ -n "$DB_PUBLISHED" ] || refuse "container '$DB_CONTAINER' does not publish 5432/tcp."
DB_HOST="${DB_PUBLISHED%:*}"
DB_PORT="${DB_PUBLISHED##*:}"

case "$DB_HOST" in
  127.0.0.1|0.0.0.0|localhost|::|::1) : ;;
  *) refuse "db port is published on non-local host '$DB_HOST'." ;;
esac
[ "$DB_PORT" = "$EXPECTED_DB_PORT" ] \
  || refuse "db port '$DB_PORT' != dedicated wiki port '$EXPECTED_DB_PORT' (refusing the 54322 default and any foreign stack)."

# --- signal 5: kong on the dedicated api port ---------------------------------------
docker inspect "$KONG_CONTAINER" >/dev/null 2>&1 \
  || refuse "container '$KONG_CONTAINER' is not running; the API is required for screenshots."
API_PUBLISHED="$(docker port "$KONG_CONTAINER" 8000/tcp 2>/dev/null | head -1 || true)"
API_PORT="${API_PUBLISHED##*:}"
[ "$API_PORT" = "$EXPECTED_API_PORT" ] \
  || refuse "kong publishes api port '$API_PORT' != expected '$EXPECTED_API_PORT'."

echo "wiki-guard: target verified — project '$EXPECTED_PROJECT', db $DB_HOST:$DB_PORT, api :$API_PORT"

# --- helpers ------------------------------------------------------------------------
psql_run() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 "$@"; }
psql_soft() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=0 "$@"; }

ANCHOR="${WIKI_ANCHOR_DATE:-$(date +%F)}"
echo "wiki-db: fixture anchor date = $ANCHOR"

# --- schema rebuild -----------------------------------------------------------------
if [ "$MODE" = "bootstrap" ]; then
  echo "wiki-db: probing the auth helper functions…"
  # gotrue runs its own migrations at container start and normally installs auth.uid()
  # reading the PLURAL GUC `request.jwt.claims`, which is what PostgREST sets. Some image
  # builds ship only the singular `request.jwt.claim.sub`; with that, EVERY company-scoped
  # RLS policy returns zero rows for a real request and every screenshot is a plausible
  # blank page. So: probe, and only replace when it is actually wrong. Replacing a
  # correct, gotrue-owned function for no reason is its own risk.
  AUTH_UID_OK="$(psql_soft -tAc "SELECT CASE WHEN prosrc LIKE '%request.jwt.claims%' THEN 'ok' ELSE 'bad' END FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname='uid';" | tr -d '[:space:]')"
  if [ "$AUTH_UID_OK" != "ok" ]; then
    echo "wiki-db: auth.uid() does not read request.jwt.claims — applying the supplement."
    # Must run as the auth-schema owner. Try the usual owners in order and refuse loudly
    # if none works: continuing would produce a stack where every page renders empty.
    APPLIED=0
    for ROLE in supabase_admin supabase_auth_admin postgres; do
      if docker exec -i "$DB_CONTAINER" psql -U "$ROLE" -d postgres -q -v ON_ERROR_STOP=1 \
           < supabase-wiki/baseline/auth-functions.sql >/dev/null 2>&1; then
        echo "wiki-db: auth functions applied as '$ROLE'."; APPLIED=1; break
      fi
    done
    [ "$APPLIED" = "1" ] || refuse "could not apply auth-functions.sql as any of supabase_admin/supabase_auth_admin/postgres. Refusing rather than producing a stack where every screenshot is silently empty."
  else
    echo "wiki-db: auth.uid() already reads request.jwt.claims — no supplement needed."
  fi

  echo "wiki-db: rebuilding schema public (destructive)…"
  psql_run -c "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS besichtigung CASCADE; CREATE SCHEMA public;"

  # The schema baseline is SHARED with supabase-test — one snapshot, two consumers, so the
  # screenshot stack and the DB assertion suite can never drift apart.
  echo "wiki-db: applying shared baseline (prereqs, schema, grants)…"
  psql_soft < supabase-test/baseline/prereqs.sql        > /dev/null
  psql_soft < supabase-test/baseline/schema.sql         > /dev/null
  psql_soft < supabase-test/baseline/grants.sql         > /dev/null
  psql_soft < supabase-test/baseline/function-grants.sql > /dev/null

  # The shared prereqs stub creates besichtigung.sessions but grants nothing on it. The
  # public view over it is security_invoker, so a browser (role `authenticated`) is denied
  # and the sidebar's badge query 403s on every page. See the file header for why the
  # shared baseline cannot carry this itself.
  echo "wiki-db: granting the besichtigung stub…"
  psql_run < supabase-wiki/baseline/besichtigung-grants.sql > /dev/null

  echo "wiki-db: writing identity marker…"
  psql_run < supabase-wiki/baseline/guard-marker.sql > /dev/null

  TABLES="$(psql_soft -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" | tr -d '[:space:]')"
  [ "${TABLES:-0}" -ge 50 ] \
    || refuse "only $TABLES tables in public after applying the baseline — the baseline did not apply."
  echo "wiki-db: baseline applied ($TABLES tables)."
fi

# --- synthetic user + fixtures ------------------------------------------------------
# Node owns this half: it speaks the gotrue admin API over HTTP and needs JSON.
echo "wiki-db: seeding synthetic data…"
WIKI_ANCHOR_DATE="$ANCHOR" \
WIKI_DB_CONTAINER="$DB_CONTAINER" \
WIKI_PROJECT="$EXPECTED_PROJECT" \
  node scripts/wiki-seed.mjs

echo "wiki-db: done."
