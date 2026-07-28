#!/usr/bin/env bash
# Frischt supabase-test/baseline/ aus der Produktion auf.
#
# Bis 2026-07-28 stand diese Prozedur nur als Prosa in supabase-test/README.md.
# Sie wurde dadurch selten ausgefuehrt — der Baseline war zuletzt 16 Migrationen
# hinterher, und die DB-Integrationssuite sagte damit nichts mehr ueber den
# heutigen Stand aus.
#
# NUR LESEND auf der Produktion: ein `pg_dump --schema-only`. Es wird nichts
# geschrieben, nichts angelegt, nichts geloescht.
#
#   bash scripts/refresh-test-baseline.sh
#
# Danach:
#   npm run test:db:up
#   CRM_TEST_ENV=1 TEST_DB_ADMIN_PASSWORD=<lokales Passwort> npm run test:db:bootstrap
#   CRM_TEST_ENV=1 TEST_DB_ADMIN_PASSWORD=<lokales Passwort> npm run test:db

set -euo pipefail

SSH_HOST="${CRM_PROD_SSH:-root@213.199.45.205}"
DB_CONTAINER="${CRM_PROD_DB_CONTAINER:-supabase-db-aw0c0w440o8k0cccokow0csw}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$ROOT/supabase-test/baseline"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PROD() { ssh -o ConnectTimeout=15 "$SSH_HOST" "docker exec $DB_CONTAINER $*"; }

echo "==> Schema-Dump (nur lesend)"
PROD "pg_dump -U postgres -d postgres --schema-only --schema=public --no-owner --no-privileges" \
  > "$TMP/roh.sql"
# Der Rohdump gilt als sensibel und wird NIE committet — er bleibt in $TMP.

echo "==> sanitisieren"
python3 - "$TMP/roh.sql" "$TMP/schema.sql" <<'PY'
import re, sys
roh, ziel = sys.argv[1], sys.argv[2]
s = open(roh).read()

# Die vier Funktionen mit Aussenkontakt auf einen No-op-Rumpf reduzieren. Die
# Signaturen bleiben, damit alles aufloest, was sie aufruft; eine Test-DB darf
# aber keine HTTP-/vault-/cron-Aufrufe absetzen.
STUBS = {
    "invoke_edge_function(p_fn text) RETURNS void":
        ("    LANGUAGE plpgsql SECURITY DEFINER\n    SET search_path TO 'public'\n",
         "    AS $$ BEGIN RETURN; END; $$;"),
    "trigger_notify_admin_high_spam() RETURNS trigger":
        ("    LANGUAGE plpgsql SECURITY DEFINER\n    SET search_path TO 'public'\n",
         "    AS $$ BEGIN RETURN NEW; END; $$;"),
    "trigger_subscription_manager() RETURNS void":
        ("    LANGUAGE plpgsql SECURITY DEFINER\n",
         "    AS $$ BEGIN RETURN; END; $$;"),
    "trigger_team_reminder_for_appointment(p_appointment_id uuid) RETURNS boolean":
        ("    LANGUAGE plpgsql SECURITY DEFINER\n    SET search_path TO 'public'\n",
         "    AS $$ BEGIN RETURN false; END; $$;"),
}
for sig, (kopf, rumpf) in STUBS.items():
    marke = "CREATE FUNCTION public." + sig
    if marke not in s:
        raise SystemExit(f"Stub-Kandidat nicht gefunden: {sig}")
    a = s.index(marke)
    b = s.index("$$;", a) + 3
    s = s[:a] + marke + "\n" + kopf + rumpf + s[b:]

# Literale mit Aussenbezug neutralisieren.
s = re.sub(r"'https?://[^']*'", "'https://test.invalid'", s)
s = re.sub(r"'Bearer [^']*'", "'Bearer test-placeholder'", s)
s = re.sub(r"'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'", "'test@test.invalid'", s)
s = re.sub(r"'\d{1,3}(\.\d{1,3}){3}'", "'127.0.0.1'", s)

open(ziel, "w").write(s)
PY

echo "==> pruefen, dass nichts nach draussen zeigt"
# `cron.` faellt hier bewusst raus: das Wort steht in einem COMMENT-Text
# ("run daily via cron."), nicht als Schemabezug.
for muster in 'https\?://' 'vault\.' 'net\.http' 'Bearer [^t]' 'eyJ'; do
  n="$(grep -Ec "$muster" "$TMP/schema.sql" || true)"
  if [ "$n" != "0" ]; then
    echo "ABBRUCH: '$muster' kommt $n mal vor — Sanitisierung unvollstaendig." >&2
    exit 1
  fi
done

echo "==> Funktionsrechte aus der Produktion uebernehmen"
# WARUM DIESE DATEI EXISTIERT
# Der Dump oben laeuft mit --no-privileges. Bei TABELLEN ist das harmlos: ohne
# ACL kommt niemand heran, und grants.sql gibt bewusst zurueck, was Supabase
# vergibt. Bei FUNKTIONEN ist es das Gegenteil — Postgres' Vorgabe fuer eine
# Funktion ohne ACL ist EXECUTE fuer PUBLIC. Die Rechte wegzulassen SCHLIESST
# Funktionen also nicht, es OEFFNET sie.
#
# Damit war jedes `REVOKE EXECUTE` der Produktion (submit_lead, die Kunden-RPCs,
# run_pipeline_automations) im Teststapel unsichtbar: dort durfte anon alles.
# Genau die Klasse Schutz, die zuletzt am haeufigsten dazukam, war die einzige,
# die der Test nicht pruefen konnte.
#
# Erzeugt wird der exakte Zustand: erst alles entziehen, dann zurueckgeben, wo
# die Produktion es zurueckgibt.
{
  echo "-- ERZEUGT von scripts/refresh-test-baseline.sh — nicht von Hand aendern."
  echo "-- Bildet die EXECUTE-Rechte der Produktion nach. Siehe Skriptkommentar."
  echo "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;"
  PROD "psql -U postgres -d postgres -A -t -c \"$(cat <<'SQL'
select format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO %I;',
              p.proname, pg_get_function_identity_arguments(p.oid), r)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join unnest(array['anon','authenticated','service_role']) r
where n.nspname = 'public' and p.prokind = 'f'
  and has_function_privilege(r, p.oid, 'EXECUTE')
order by p.proname, pg_get_function_identity_arguments(p.oid), r;
SQL
)\""
} > "$TMP/function-grants.sql"

zeilen="$(grep -c '^GRANT' "$TMP/function-grants.sql" || true)"
if [ "$zeilen" -lt 100 ]; then
  echo "ABBRUCH: nur $zeilen GRANT-Zeilen — das kann nicht der Produktionsstand sein." >&2
  exit 1
fi
echo "    $zeilen GRANT-Zeilen uebernommen"

echo "==> Manifest berechnen"
PROD "psql -U postgres -d postgres -A -t -F'|' -c \"$(cat <<'SQL'
select 'enums', count(*)::text from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'
union all select 'tables', count(*)::text from pg_tables where schemaname='public'
union all select 'views', count(*)::text from pg_views where schemaname='public'
union all select 'indexes', count(*)::text from pg_indexes where schemaname='public'
union all select 'policies', count(*)::text from pg_policies where schemaname='public'
union all select 'triggers', count(*)::text from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not tg.tgisinternal
union all select 'functions', count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all select 'foreign_keys', count(*)::text from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'
union all select 'check_constraints', count(*)::text from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='c'
union all select 'rls_enabled_tables', count(*)::text from pg_tables where schemaname='public' and rowsecurity
union all select 'column_fingerprint_md5', md5(string_agg(t||'.'||c||':'||d, ',' order by t, c)) from (select table_name t, column_name c, data_type d from information_schema.columns where table_schema='public') x
union all select 'policy_fingerprint_md5', md5(string_agg(tablename||'.'||policyname||':'||cmd, ',' order by tablename, policyname)) from pg_policies where schemaname='public'
union all select 'function_fingerprint_md5', md5(string_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', ',' order by p.proname, pg_get_function_identity_arguments(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
SQL
)\"" > "$TMP/werte.txt"

PROD "psql -U postgres -d postgres -A -t -c \"select coalesce(json_object_agg(typname, werte)::text,'{}') from (select t.typname, json_agg(e.enumlabel order by e.enumsortorder) werte from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname) x;\"" \
  > "$TMP/enums.json"

python3 - "$TMP/werte.txt" "$TMP/enums.json" "$BASE/parity-manifest.json" <<'PY'
import json, sys, datetime
werte = dict(l.split("|", 1) for l in open(sys.argv[1]).read().strip().split("\n") if "|" in l)
enums = json.loads(open(sys.argv[2]).read().strip())
ziel = sys.argv[3]
alt = json.load(open(ziel))

zahlen = ["enums","tables","views","indexes","policies","triggers",
          "functions","foreign_keys","check_constraints","rls_enabled_tables"]
alt["generated_at"] = datetime.date.today().isoformat()
alt["counts"] = {k: int(werte[k]) for k in zahlen}
alt["enums"] = enums
for f in ("column_fingerprint_md5","policy_fingerprint_md5","function_fingerprint_md5"):
    alt[f] = werte[f]
json.dump(alt, open(ziel, "w"), indent=2, ensure_ascii=False)
print("counts:", alt["counts"])
PY

cp "$TMP/schema.sql" "$BASE/schema.sql"
cp "$TMP/function-grants.sql" "$BASE/function-grants.sql"
echo "==> fertig: $BASE/schema.sql + function-grants.sql + parity-manifest.json aufgefrischt"
echo "    covers_migrations_through im Manifest von Hand nachziehen."
