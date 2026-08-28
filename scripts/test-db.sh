#!/usr/bin/env bash
# Disposable local DB integration runner for the CRM.
#
# Fail-closed. Before the destructive `DROP SCHEMA public CASCADE`, it demands FIVE
# independent proofs that the target is the CRM's OWN dedicated test stack — never
# "whatever Supabase db is on the 54322 default port" (the old, dangerous behaviour that
# could wipe an unrelated project started with default ports):
#
#   1. CRM_TEST_ENV=1                      explicit opt-in, never inferred
#   2. loopback ONLY                       every published binding is 127.0.0.1 (never 0.0.0.0/::)
#   3. dedicated port                      == the port in supabase-test/runtime config (54342)
#   4. unique container identity           name `supabase_db_crm-test` AND CLI project label
#   5. in-db identity marker               crm_test_guard.identity == (crm-test, version)
#
# This mirrors the tested specification in src/test/db-guard.ts (see its unit tests) and the
# existing env-guard.ts pattern. It NEVER starts/stops a stack, NEVER touches a remote, and
# NEVER falls back to another port/container.
#
# Prerequisite: the dedicated stack is up. Start it through the wrapper, never with a
# bare `supabase start` — the wrapper is what pins the publication to 127.0.0.1:
#   npm run test:db:up
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

# --- Lifecycle lock: taken BEFORE the first docker query, held to the end ------------------
# Dieselbe Sperre haelt scripts/supabase-stack.sh waehrend `up`/`down`. Ohne sie gibt es ein
# Fenster: der Waechter unten stellt die Identitaet fest, und WAEHREND danach `DROP SCHEMA`
# laeuft, faehrt ein `npm run test:db:down` den Stapel herunter oder ein `up` startet einen
# anderen. Die Pruefung haette dann fuer etwas anderes gegolten als das, was getroffen wird.
#
# Deskriptor 9. Der Baseline-Lock weiter unten benutzt 8; beide muessen gleichzeitig halten.
. scripts/docker-loopback.sh
loopback_stack_lock "$EXPECTED_PROJECT" || refuse "could not take the crm-test lifecycle lock."

# --- Signals 2 + 3 + 4: identity AND loopback-only publication, from ONE inspect -----------
# Frueher standen hier zwei getrennte Abfragen: das Projektlabel mit einem
# `docker inspect -f`, die Bindung mit `docker port … | head -1`. Drei Fehler auf einmal.
#   - `0.0.0.0` und `::` galten als "lokal". Sie sind das Gegenteil: JEDE Schnittstelle
#     des Rechners — ein Teststapel mit bekanntem Passwort war damit im WLAN erreichbar.
#   - `head -1` zeigte nur die erste Bindung; eine zweite auf 0.0.0.0 blieb unsichtbar.
#   - Zwei Abfragen, zwei Zeitpunkte: zwischen ihnen kann sich der Container austauschen,
#     und geprueft waere dann das Label des einen und die Bindung des anderen.
#
# loopback_verify_container (scripts/docker-loopback.sh) beantwortet alles aus GENAU EINEM
# `docker inspect`: laeuft er, heisst er so, traegt er das Projektlabel, haengt er nur im
# dafuer angelegten Netz, und liegt JEDE veroeffentlichte Bindung auf 127.0.0.1 — die von
# 5432/tcp zusaetzlich auf dem erwarteten Hostport.
LOOPBACK_NETWORK="crm-test-loopback"
loopback_verify_container "$CONTAINER" "$CONTAINER" "$EXPECTED_PROJECT" "$LOOPBACK_NETWORK" "5432/tcp" "$EXPECTED_PORT" \
  || refuse "target is not the verified, loopback-only crm-test stack (see above). Start it with: npm run test:db:up"

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

echo "Guard OK ($MODE): container=$CONTAINER bound=${LOOPBACK_HOST_IP}:$EXPECTED_PORT project=$EXPECTED_PROJECT marker=${MARKER_PROJECT:-<none>}"

# --- Signal 6: one generation (BEFORE any DB mutation) -------------------------------------
# Die eingespielten Rechte-Schnappschuesse muessen aus EINER Auffrischung
# stammen. Jede Datei prueft ihren eigenen Fingerprint gegen die Datenbank; nur
# der Manifest-Hash prueft sie gegeneinander. Das laeuft VOR dem `DROP SCHEMA`:
# eine Absage darf keine leergeraeumte Datenbank hinterlassen.
. scripts/baseline-artifacts.sh
echo "==> verifying baseline generation"
baseline_read_lock supabase-test/baseline || refuse "baseline lock unavailable"
verify_baseline_artifacts supabase-test/baseline || refuse "baseline generation check failed"
baseline_check_sequence_transition supabase-test/baseline || refuse "sequence grant transition inconsistent"

# --- Disposable rebuild (identity proven) --------------------------------------------------
echo "==> wiping public schema (disposable) + applying sanitized baseline"
PSQL -q -c "DROP SCHEMA IF EXISTS public CASCADE;" >/dev/null
PSQL_ADMIN -q < supabase-test/baseline/auth-supplement.sql >/dev/null  # auth.jwt() (auth-schema owner)
PSQL -q < supabase-test/baseline/prereqs.sql     >/dev/null   # test stub for the excluded besichtigung schema
PSQL -q < supabase-test/baseline/schema.sql      >/dev/null   # recreates public
# Rechte in der Reihenfolge aus baseline-artifacts.sh — die Liste steht an EINER
# Stelle, damit test-db.sh und wiki-db.sh nicht auseinanderlaufen koennen.
#
# In einer vollstaendigen Generation sind ALLE VIER Rechte-Dateien Pflicht; fehlt
# eine, bricht baseline_apply_privileges ab. Die einzige Ausnahme ist
# `sequence-grants.sql`, und auch die nur, wenn das Manifest den Uebergangs-
# zustand ausdruecklich belegt (`artifact_verification: pending-first-refresh`
# samt legacy_artifacts/legacy_generation). Ein blosses "die Datei ist nicht da"
# reicht nicht — sonst waere ihr Fehlen seine eigene Rechtfertigung.
apply_privilege_file() { PSQL -q < "$1" >/dev/null; }
baseline_apply_privileges supabase-test/baseline apply_privilege_file \
  || refuse "applying baseline privileges failed"
PSQL -q < supabase-test/baseline/guard-marker.sql >/dev/null  # (re)assert identity marker (idempotent)

# --- Migrationen, die noch juenger sind als die Baseline ------------------------------------
# Die Baseline ist ein bereinigter Abzug der Produktion und traegt ein Datum. Jede Migration,
# die danach entstanden ist, steht NICHT darin — und ohne diesen Schritt liefen die
# Zusicherungen gegen ein Schema, das die neue Tabelle gar nicht kennt. Der Test waere gruen,
# weil er nichts pruefen kann.
#
# Die Liste steht in einer eigenen Datei und nicht als Glob "alles neuer als generated_at":
# ein Glob nimmt stillschweigend auch eine Datei mit, die noch niemand gelesen hat. Wer eine
# Migration hier eintraegt, sagt damit ausdruecklich: die gehoert in den Test.
#
# Nach der naechsten Baseline-Auffrischung sind die Eintraege doppelt vorhanden — deshalb
# muessen die Migrationen idempotent sein (IF NOT EXISTS / CREATE OR REPLACE), was in diesem
# Repo ohnehin Hausregel ist. Aufgebrauchte Zeilen werden bei der Auffrischung entfernt.
PENDING="supabase-test/pending-migrations.txt"
if [ -f "$PENDING" ]; then
  while IFS= read -r m; do
    case "$m" in ''|'#'*) continue ;; esac
    [ -f "supabase/migrations/$m" ] || refuse "pending migration '$m' not found in supabase/migrations/"
    echo "==> applying pending migration $m"
    PSQL -q < "supabase/migrations/$m" >/dev/null || refuse "pending migration '$m' failed"
  done < "$PENDING"
fi

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
OUT3="$(PSQL < supabase-test/tests/customer-360.sql 2>&1)"; RC3=$?
OUT4="$(PSQL < supabase-test/tests/rollen.sql 2>&1)"; RC4=$?
OUT5="$(PSQL < supabase-test/tests/offerte-version.sql 2>&1)"; RC5=$?
OUT6="$(PSQL < supabase-test/tests/nachtrag.sql 2>&1)"; RC6=$?
OUT7="$(PSQL < supabase-test/tests/pipeline.sql 2>&1)"; RC7=$?
OUT8="$(PSQL < supabase-test/tests/finanzen.sql 2>&1)"; RC8=$?
OUT9="$(PSQL < supabase-test/tests/portal.sql 2>&1)"; RC9=$?
OUT10="$(PSQL < supabase-test/tests/serviceorte-faelle.sql 2>&1)"; RC10=$?
OUT11="$(PSQL < supabase-test/tests/kommunikation.sql 2>&1)"; RC11=$?
OUT12="$(PSQL < supabase-test/tests/api-budget.sql 2>&1)"; RC12=$?
printf '%s\n' "$OUT"  | grep -E 'PASS|FAIL|ERROR|ALL DB ASSERTIONS'
printf '%s\n' "$OUT2" | grep -E 'PASS|FAIL|ERROR|ALL AUFTRAG'
printf '%s\n' "$OUT3" | grep -E 'PASS|FAIL|ERROR'
printf '%s\n' "$OUT4" | grep -E 'PASS|FAIL|ERROR'
printf '%s\n' "$OUT5" | grep -E 'PASS|FAIL|ERROR'
printf '%s\n' "$OUT6" | grep -E 'PASS|FAIL|ERROR'
printf '%s\n' "$OUT7" | grep -E 'PASS|FAIL|ERROR'
printf '%s\n' "$OUT8" | grep -E 'PASS|FAIL|ERROR'
printf '%s\n' "$OUT9" | grep -E 'PASS|FAIL|ERROR'
printf '%s\n' "$OUT10" | grep -E 'PASS|FAIL|ERROR'
printf '%s\n' "$OUT11" | grep -E 'PASS|FAIL|ERROR'
printf '%s\n' "$OUT12" | grep -E 'PASS|FAIL|ERROR'
set -e
if [ "$RC" -ne 0 ] || [ "$RC2" -ne 0 ] || [ "$RC3" -ne 0 ] || [ "$RC4" -ne 0 ] || [ "$RC5" -ne 0 ] || [ "$RC6" -ne 0 ]  || [ "$RC7" -ne 0 ]  || [ "$RC8" -ne 0 ]  || [ "$RC9" -ne 0 ]  || [ "$RC10" -ne 0 ] || [ "$RC11" -ne 0 ] || [ "$RC12" -ne 0 ]; then
  echo "DB integration suite FAILED (assertions rc=$RC, auftrag-contract rc=$RC2, customer-360 rc=$RC3, rollen rc=$RC4, offerte-version rc=$RC5, nachtrag rc=$RC6, pipeline rc=$RC7, finanzen rc=$RC8, portal rc=$RC9, serviceorte-faelle rc=$RC10, kommunikation rc=$RC11, api-budget rc=$RC12)"; exit 1
fi
echo "DB integration suite passed."
