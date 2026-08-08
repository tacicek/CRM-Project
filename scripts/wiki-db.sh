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

# --- lifecycle lock: taken BEFORE the first docker query, held to the end -----------
# Dieselbe Sperre haelt scripts/supabase-stack.sh waehrend `up`/`down` — sonst koennte
# zwischen dieser Pruefung und dem `DROP SCHEMA` weiter unten ein Stapelwechsel liegen.
# Deskriptor 9; der Baseline-Lock benutzt 8.
. scripts/docker-loopback.sh
loopback_stack_lock "$EXPECTED_PROJECT" || refuse "could not take the crm-wiki lifecycle lock."

# --- signals 2 + 3 + 4: identity AND loopback-only publication, for BOTH containers --
# Hier standen drei Fehler. Erstens galten `0.0.0.0` und `::` als "lokal" — sie sind
# das Gegenteil: JEDE Schnittstelle des Rechners. Zweitens wurde bei Kong ueberhaupt
# nur der PORT verglichen: weder Host noch Projektlabel, die API stand also ungeprueft
# im Netz. Drittens lagen Label- und Bindungsabfrage auseinander, sodass beide
# denselben Container nur vermutlich meinten.
#
# loopback_verify_container (scripts/docker-loopback.sh) beantwortet alles aus GENAU
# EINEM `docker inspect`, und zwar fuer BEIDE Container: laeuft er, heisst er so,
# traegt er das Projektlabel, haengt er nur im dafuer angelegten Netz, und liegt JEDE
# veroeffentlichte Bindung auf 127.0.0.1 — die geforderte zusaetzlich auf ihrem Port.
LOOPBACK_NETWORK="crm-wiki-loopback"

loopback_verify_container "$DB_CONTAINER" "$DB_CONTAINER" "$EXPECTED_PROJECT" "$LOOPBACK_NETWORK" "5432/tcp" "$EXPECTED_DB_PORT" \
  || refuse "db is not the verified, loopback-only crm-wiki stack (see above). Start it with: npm run wiki:db:up"

# --- signal 5: the gateway, in ONE strict check --------------------------------------
# Der Gateway ist nicht optional: ohne ihn ist der Stapel unvollstaendig, und "die
# Datenbank ist sicher" sagt nichts ueber die API.
#
# Hier stand bis A.5.1b.0 ein eigenes `docker inspect "$KONG_CONTAINER"` als
# Existenzprobe VOR der eigentlichen Pruefung. Zwei Aufrufe, zwei Zeitpunkte — genau
# das TOCTOU-Fenster, das A.5.0.1 an anderer Stelle geschlossen hatte: zwischen der
# Probe und der Pruefung kann der Container ein anderer sein. Und noetig war die Probe
# nie: ein fehlender Container faellt in loopback_verify_container ohnehin durch.
#
# `strict` verlangt zusaetzlich, dass 8000/tcp die EINZIGE veroeffentlichte Bindung
# des Gateways ist — kein zweiter Port, auch kein loopbacker, und keine Wiederholung
# derselben Bindung. Nicht veroeffentlichte (`null`) Ports bleiben erlaubt.
loopback_verify_container "$KONG_CONTAINER" "$KONG_CONTAINER" "$EXPECTED_PROJECT" "$LOOPBACK_NETWORK" "8000/tcp" "$EXPECTED_API_PORT" strict \
  || refuse "kong is not the verified, loopback-only crm-wiki api (see above). Start it with: npm run wiki:db:up"

echo "wiki-guard: target verified — project '$EXPECTED_PROJECT', db and api running, labelled and bound to ${LOOPBACK_HOST_IP} only"

# --- helpers ------------------------------------------------------------------------
psql_run() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 "$@"; }
psql_soft() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=0 "$@"; }

ANCHOR="${WIKI_ANCHOR_DATE:-$(date +%F)}"
echo "wiki-db: fixture anchor date = $ANCHOR"

# --- schema rebuild -----------------------------------------------------------------
if [ "$MODE" = "bootstrap" ]; then
  # ZUERST, vor jeder Aenderung an der Datenbank: die geteilte Baseline muss
  # eine geschlossene Generation sein. Frueher stand diese Pruefung hinter dem
  # Austausch der auth-Funktionen und hinter `DROP SCHEMA` — eine Absage hinterliess
  # damit eine halb abgeraeumte Datenbank.
  . scripts/baseline-artifacts.sh
  baseline_read_lock supabase-test/baseline || refuse "baseline lock unavailable."
  verify_baseline_artifacts supabase-test/baseline || refuse "shared baseline generation check failed."
  baseline_check_sequence_transition supabase-test/baseline || refuse "sequence grant transition inconsistent."

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
  # Nur ABRAEUMEN, nicht anlegen: `public` legt baseline/schema.sql selbst an
  # (dessen Zeile 23). Beides zusammen ergab "42P06: schema public already
  # exists" — der Fehler, den der frühere pauschale ON_ERROR_STOP=0 verschluckt
  # hat. test-db.sh macht es seit jeher so; damit sind beide Verbraucher gleich.
  psql_run -c "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS besichtigung CASCADE;"

  # The schema baseline is SHARED with supabase-test — one snapshot, two consumers, so the
  # screenshot stack and the DB assertion suite can never drift apart. Verified above.
  echo "wiki-db: applying shared baseline (prereqs, schema, grants)…"
  # ALLES STRIKT, ohne Ausnahmeliste. Bis 2026-08 liefen prereqs.sql und
  # schema.sql mit ON_ERROR_STOP=0 — ein beliebiger Schemafehler war damit ein
  # Logeintrag und der Bootstrap lief weiter. Screenshots sehen danach plausibel
  # aus und zeigen den falschen Zustand.
  #
  # Eine SQLSTATE-Ausnahmeliste stand hier kurz und ist wieder raus: mit
  # ON_ERROR_STOP=1 bricht psql beim ERSTEN Fehler ab und fuehrt den REST DER
  # DATEI NICHT MEHR AUS. Einen solchen Fehler zu tolerieren hiesse, ein
  # halbes Schema als Erfolg zu verbuchen. Dieselbe Funktion spielt ausserdem
  # die ACL-Dateien ein — eine Ausnahmeliste haette dort die
  # Fingerprint-Exception verschluckt.
  #
  # Ist ein Fehler wirklich erwartet, gehoert die betroffene Anweisung
  # idempotent gemacht oder als eigener, vollstaendig beschriebener Schritt
  # behandelt — nicht der ganze Dateilauf durchgewunken.
  apply_shared() {
    local datei="$1" ausgabe
    if ausgabe="$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q \
                    -v ON_ERROR_STOP=1 -v VERBOSITY=verbose < "$datei" 2>&1)"; then
      return 0
    fi
    printf '%s\n' "$ausgabe" | tail -20 >&2
    refuse "applying $datei failed — see the SQL error above."
  }

  apply_shared supabase-test/baseline/prereqs.sql
  apply_shared supabase-test/baseline/schema.sql
  # Die Rechte-Schnappschuesse enthalten am Ende einen DO-Block, der den
  # ACL-Fingerprint gegen die eben eingespielte Datenbank prueft. Schlaegt der
  # an, muss der Bootstrap stehenbleiben.
  baseline_apply_privileges supabase-test/baseline apply_shared \
    || refuse "applying shared baseline privileges failed."

  # The shared prereqs stub creates besichtigung.sessions but grants nothing on it. The
  # public view over it is security_invoker, so a browser (role `authenticated`) is denied
  # and the sidebar's badge query 403s on every page. See the file header for why the
  # shared baseline cannot carry this itself.
  echo "wiki-db: granting the besichtigung stub…"
  psql_run < supabase-wiki/baseline/besichtigung-grants.sql > /dev/null

  # Migrationen, die juenger sind als die Baseline. Dieselbe Liste wie im
  # Testlauf (scripts/test-db.sh) — der Screenshot-Stapel muss den Bildschirm
  # zeigen, den es gibt, und nicht den von vor der letzten Migration.
  PENDING="supabase-test/pending-migrations.txt"
  if [ -f "$PENDING" ]; then
    while IFS= read -r m; do
      case "$m" in ''|'#'*) continue ;; esac
      [ -f "supabase/migrations/$m" ] || refuse "pending migration '$m' not found."
      echo "wiki-db: applying pending migration $m…"
      apply_shared "supabase/migrations/$m"
    done < "$PENDING"
  fi

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
