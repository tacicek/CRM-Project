#!/usr/bin/env bash
# Nimmt den BEOBACHTETEN Stand der Produktion auf — nur lesend.
#
# ── WOFUER ──────────────────────────────────────────────────────────────────
#
# Dieses Repo kann sagen, was es SELBST enthaelt. Es kann bisher nicht sagen,
# was in der Produktion LAEUFT: Migrationen werden von Hand eingespielt, Edge
# Functions von Hand kopiert, und `config.toml` traegt Sicherheitsangaben, die
# diese Installation gar nicht auswertet. Jede Sicherheitsaussage endete damit
# bei "vermutlich".
#
# Dieses Skript beendet das Vermuten fuer die Fragen, die man lesend
# beantworten kann:
#
#   1. Ist das Edge-Gateway offen? (VERIFY_JWT des Runtime, Plugins der
#      Kong-Route auf /functions/v1)
#   2. Welche Functions sind wirklich ausgerollt, mit welchem Inhalt? (Digests)
#   3. Wer darf welche Datenbankfunktion ausfuehren? (anon/authenticated/
#      service_role, SECURITY DEFINER, ACL)
#   4. Wo steht RLS, und was sagen die Policies? (Struktur, nicht Ausdruck)
#   5. Gibt es `execute_sql`, und was darf es?
#   6. Stecken noch alte Cloud-URLs oder JWT-artige Werte in Funktionen oder
#      geplanten Jobs?
#   7. Wird das Kundenportal ueberhaupt benutzt?
#   8. Gibt es Functions, die NUR deployed sind — im Repo geloescht, in der
#      Konfiguration nicht mehr gefuehrt, aber auf dem Server noch da? (Anlass:
#      `accept-lead` — laut docs/SISTEM_PRD.md ein Multi-Tenant-Rest ohne
#      Aufrufer. Das ist eine BEHAUPTUNG eines Dokuments; dieser Abschnitt
#      macht sie nachpruefbar, inklusive des vollen Quelltexts.)
#
# ── WAS ES NICHT IST ────────────────────────────────────────────────────────
#
# KEIN Migrations-Ledger. Es sagt, welches Schema JETZT da ist, nicht welche
# Datei es erzeugt hat. Der Ledger ist eine eigene, spaetere Arbeit.
#
# KEIN Ersatz fuer supabase-test/baseline. Der Baseline ist ein nachbaubarer
# Teststapel; dies ist ein Beleg. Beide lesen dieselbe Produktion ueber
# dieselbe Zugangs- und Identitaetspruefung (scripts/prod-readonly.sh), aber
# sie beantworten verschiedene Fragen.
#
# KEIN Ausdrucks-Archiv. Policy-`USING`/`WITH CHECK` werden als Hash plus
# Merkmalen aufgenommen, nicht im Wortlaut: der Wortlaut steht in den
# Migrationen, und genau ein Ausdruck in dieser Datenbank enthaelt eine
# Kontaktangabe. Ein Beleg, der Adressen mitschleppt, waere ein Beleg, den man
# nicht veroeffentlichen kann.
#
# ── LESEND ──────────────────────────────────────────────────────────────────
#
# Jede Datenbankverbindung laeuft ueber prod-readonly.sh und damit mit
# `default_transaction_read_only=on`. Die Docker-Aufrufe sind `inspect`, `exec
# … sha256sum/grep/find` — kein Schreibpfad, kein Neustart, kein Deploy.
#
# ── AUFRUF ──────────────────────────────────────────────────────────────────
#
#   TARGET="root@<host>|<db-container>|<system_identifier>"
#   CRM_PROD_SSH=root@<host> \
#   CRM_PROD_DB_CONTAINER=<db-container> \
#   CRM_PROD_EDGE_CONTAINER=<edge-container> \
#   CRM_PROD_KONG_CONTAINER=<kong-container> \
#   CRM_PROD_SYSTEM_IDENTIFIER=<system_identifier> \
#   CRM_PROD_READ_CONFIRM=$(printf '%s' "$TARGET" | sha256sum | cut -d' ' -f1) \
#     bash scripts/capture-production-truth.sh
#
# Es gibt KEINE eingebauten Ziele. Die Bestaetigung haengt am ganzen Ziel, damit
# eine kopierte Kommandozeile mit ausgetauschtem Host nicht durchkommt.
#
# Eine bereits vorhandene Aufnahme desselben Tages wird NICHT ueberschrieben.
# Ein Beleg, den ein zweiter Lauf stillschweigend ersetzt, ist kein Beleg —
# wer ersetzen will, sagt es mit CRM_TRUTH_REPLACE=1.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIEL_BASIS="$ROOT/ops/production-truth"
. "$ROOT/scripts/prod-readonly.sh"

# ── Ziel und Bestaetigung ───────────────────────────────────────────────────
prod_require_target
prod_require_read_confirm

# Die beiden Container der Laufzeitseite. Ebenfalls ohne Vorgabewert und gegen
# dieselbe Positivliste geprueft wie der DB-Container — ein Wert mit fuehrendem
# Bindestrich waere sonst eine Option fuer `docker`.
: "${CRM_PROD_EDGE_CONTAINER:?ABBRUCH: CRM_PROD_EDGE_CONTAINER fehlt (Edge-Runtime-Container).}"
: "${CRM_PROD_KONG_CONTAINER:?ABBRUCH: CRM_PROD_KONG_CONTAINER fehlt (Kong-Container).}"
prod_pruefe_name "$CRM_PROD_EDGE_CONTAINER" 'A-Za-z0-9_.-' "CRM_PROD_EDGE_CONTAINER"
prod_pruefe_name "$CRM_PROD_KONG_CONTAINER" 'A-Za-z0-9_.-' "CRM_PROD_KONG_CONTAINER"

prod_connect

HEUTE="$(date +%F)"
ZIEL="$ZIEL_BASIS/$HEUTE"
if [ -e "$ZIEL" ] && [ "${CRM_TRUTH_REPLACE:-}" != "1" ]; then
  echo "ABBRUCH: $ZIEL existiert bereits." >&2
  echo "  Ein Beleg wird nicht stillschweigend ersetzt. Mit CRM_TRUTH_REPLACE=1" >&2
  echo "  ausdruecklich ersetzen, oder die alte Aufnahme umbenennen." >&2
  exit 1
fi

umask 077
mkdir -p "$ZIEL_BASIS"
# Die Buehne liegt als Geschwister neben dem Ziel, damit das abschliessende
# `mv` ein Rename im selben Dateisystem und damit unteilbar ist.
STAGE="$(mktemp -d "$ZIEL_BASIS/.stage.XXXXXX")"
TMP="$(mktemp -d)"
trap 'rm -rf "$STAGE" "$TMP"' EXIT

# Namen der veroeffentlichten Artefakte. Erzeuger und Manifest lesen dieselbe
# Liste — eine Datei, die hier fehlt, faellt beim Manifest auf, statt still
# mitzulaufen.
TRUTH_ARTIFACTS="edge-runtime.json function-authz.json table-authz.json policies.json execute-sql.json execute-sql-definition.sql remnants.json portal-usage.json deploy-repo-diff.json deploy-only-sources.json"

# ── Identitaet ──────────────────────────────────────────────────────────────
echo "==> Vorpruefungen"
prod_check_identity
echo "    Instanz bestaetigt · Quelle $PROD_QUELL_DB (PostgreSQL $PROD_SERVER_VERSION)"

# ── Drift-Sonde ─────────────────────────────────────────────────────────────
# Die Aufnahme besteht aus einem Dutzend Verbindungen. Aendert sich zwischen
# zwei davon eine ACL oder eine Policy, waere der Beleg in sich widerspruechlich
# — er zeigte eine Haelfte vorher, die andere nachher. Gemessen wird deshalb
# vorher und nachher ueber genau die Flaechen, die dieser Beleg behauptet.
#
# Das ist Erkennung, keine Verhinderung: eine Aenderung und ihre Ruecknahme
# innerhalb des Fensters saehe die Sonde nicht.
AUTHZ_SONDE_SQL="
SELECT md5(concat_ws('|',
  (SELECT coalesce(md5(string_agg(
       p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'
       ||coalesce(p.proacl::text,'-')||':'||p.prosecdef::text,
       ',' ORDER BY p.proname COLLATE \"C\", pg_get_function_identity_arguments(p.oid) COLLATE \"C\")),'')
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
  (SELECT coalesce(md5(string_agg(
       tablename||'.'||policyname||':'||cmd||':'||roles::text||':'
       ||md5(coalesce(qual,''))||':'||md5(coalesce(with_check,'')),
       ',' ORDER BY tablename COLLATE \"C\", policyname COLLATE \"C\")),'')
     FROM pg_policies WHERE schemaname='public'),
  (SELECT coalesce(md5(string_agg(
       c.relname||':'||c.relrowsecurity::text||':'||c.relforcerowsecurity::text||':'
       ||coalesce(c.relacl::text,'-'),
       ',' ORDER BY c.relname COLLATE \"C\")),'')
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r')
))"

pruefe_md5() {  # $1 = Wert, $2 = Bezeichnung
  if [[ ! "$1" =~ ^[0-9a-f]{32}$ ]]; then
    echo "ABBRUCH: $2 lieferte keinen Fingerprint." >&2
    exit 1
  fi
}

AUTHZ_VORHER="$(prod_scalar "$AUTHZ_SONDE_SQL")"
pruefe_md5 "$AUTHZ_VORHER" "Authz-Sonde vorher"
echo "    Authz-Sonde vorher: $AUTHZ_VORHER"

# ── Datenbank: wer darf was ─────────────────────────────────────────────────
# `json_agg` ueber eine Unterabfrage liefert Zeilenobjekte; die Reihenfolge ist
# festgelegt, damit zwei Aufnahmen vergleichbar bleiben.

echo "==> Funktionsrechte (public)"
# body_matches_write_keyword ist eine HEURISTIK und heisst deshalb so: sie sagt
# "im Rumpf steht ein schreibendes Schluesselwort", nicht "diese Funktion
# schreibt". Ein Kommentar mit dem Wort `update` genuegt. Sie taugt zum
# Sortieren der Prueflast, nicht als Befund.
prod_scalar "
SELECT coalesce(json_agg(t ORDER BY t.signature)::text, '[]') FROM (
  SELECT p.oid::regprocedure::text                             AS signature,
         p.proname                                             AS name,
         p.prosecdef                                           AS security_definer,
         pg_get_userbyid(p.proowner)                           AS owner,
         p.provolatile::text                                   AS volatility,
         has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_execute,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
         has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_execute,
         coalesce(p.proacl::text, '')                          AS acl,
         (pg_get_functiondef(p.oid) ~* '\\m(insert|update|delete|truncate|alter|drop|grant|revoke)\\M')
                                                               AS body_matches_write_keyword,
         md5(pg_get_functiondef(p.oid))                        AS definition_md5
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
) t" > "$STAGE/function-authz.json"

echo "==> Tabellenrechte und RLS (public)"
prod_scalar "
SELECT coalesce(json_agg(t ORDER BY t.table_name)::text, '[]') FROM (
  SELECT c.relname                                          AS table_name,
         c.relrowsecurity                                   AS rls_enabled,
         c.relforcerowsecurity                              AS rls_forced,
         pg_get_userbyid(c.relowner)                        AS owner,
         has_table_privilege('anon', c.oid, 'SELECT')       AS anon_select,
         has_table_privilege('anon', c.oid, 'INSERT')       AS anon_insert,
         has_table_privilege('anon', c.oid, 'UPDATE')       AS anon_update,
         has_table_privilege('anon', c.oid, 'DELETE')       AS anon_delete,
         has_table_privilege('anon', c.oid, 'TRUNCATE')     AS anon_truncate,
         has_table_privilege('authenticated', c.oid, 'SELECT')   AS authenticated_select,
         has_table_privilege('authenticated', c.oid, 'INSERT')   AS authenticated_insert,
         has_table_privilege('authenticated', c.oid, 'UPDATE')   AS authenticated_update,
         has_table_privilege('authenticated', c.oid, 'DELETE')   AS authenticated_delete,
         has_table_privilege('authenticated', c.oid, 'TRUNCATE') AS authenticated_truncate,
         (SELECT count(*) FROM pg_policies pp
           WHERE pp.schemaname = 'public' AND pp.tablename = c.relname) AS policy_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
) t" > "$STAGE/table-authz.json"

echo "==> Policies (Struktur und Merkmale, nicht Wortlaut)"
# Warum kein Wortlaut: siehe Kopf. Der Hash macht Drift sichtbar, die Merkmale
# beantworten die Sicherheitsfrage ("unbeschraenkt? an auth.uid() gebunden? an
# die Mitgliedschaft?"), und `contains_contact_literal` markiert genau die
# Ausdruecke, die man von Hand ansehen muss.
prod_scalar "
SELECT coalesce(json_agg(t ORDER BY t.table_name, t.policy_name)::text, '[]') FROM (
  SELECT tablename                                   AS table_name,
         policyname                                  AS policy_name,
         cmd,
         permissive,
         roles::text                                 AS roles,
         md5(coalesce(qual, ''))                     AS qual_md5,
         md5(coalesce(with_check, ''))               AS with_check_md5,
         (qual IS NULL)                              AS qual_absent,
         (with_check IS NULL)                        AS with_check_absent,
         (btrim(coalesce(qual, '')) = 'true')        AS qual_unrestricted,
         (btrim(coalesce(with_check, '')) = 'true')  AS with_check_unrestricted,
         (coalesce(qual, '') || coalesce(with_check, '') ~ 'auth\\.uid\\(\\)')
                                                     AS references_auth_uid,
         (coalesce(qual, '') || coalesce(with_check, '')
            ~ 'is_company_member|company_members|is_company_owner')
                                                     AS references_company_scope,
         (coalesce(qual, '') || coalesce(with_check, '')
            ~ '@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}|://')
                                                     AS contains_contact_literal
  FROM pg_policies WHERE schemaname = 'public'
) t" > "$STAGE/policies.json"

echo "==> execute_sql (alle Schemata)"
# Ueber ALLE Schemata, nicht nur public: die Frage ist, ob es das Objekt gibt
# und wer es ausfuehren darf — nicht, wo jemand es vermutet hat.
prod_scalar "
SELECT coalesce(json_agg(t ORDER BY t.signature)::text, '[]') FROM (
  SELECT n.nspname                                             AS schema_name,
         p.oid::regprocedure::text                             AS signature,
         p.prosecdef                                           AS security_definer,
         pg_get_userbyid(p.proowner)                           AS owner,
         has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_execute,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
         has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_execute,
         coalesce(p.proacl::text, '')                          AS acl,
         length(pg_get_functiondef(p.oid))                     AS definition_length,
         encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') AS definition_sha256
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'execute_sql' AND p.prokind = 'f'
) t" > "$STAGE/execute-sql.json"

# Der Rumpf ist Schema, keine Daten — er gehoert in den Beleg, damit die
# Bewertung nachvollziehbar bleibt. Er laeuft wie alles andere durch den
# Sanitizer; enthaelt er ein Geheimnis, wird NICHTS veroeffentlicht.
prod_scalar "
SELECT coalesce(string_agg(pg_get_functiondef(p.oid), E'\n\n' ORDER BY p.oid::regprocedure::text),
                '-- kein execute_sql in dieser Instanz')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'execute_sql' AND p.prokind = 'f'" > "$STAGE/execute-sql-definition.sql"

echo "==> Altlasten: Cloud-URLs, JWT-artige Werte, geplante Jobs"
# Gemeldet werden NAMEN und MERKMALE, nie der Fund selbst. Eine Meldung, die
# den gefundenen Wert mitdruckt, veroeffentlicht genau das Geheimnis, dessen
# Vorhandensein sie meldet.
JOB_TABELLE_DA="$(prod_bool "SELECT (to_regclass('cron.job') IS NOT NULL)::text")"
if [ "$JOB_TABELLE_DA" = "true" ]; then
  JOBS_AUSDRUCK="(SELECT coalesce(json_agg(y ORDER BY y.job_id), '[]') FROM (
      SELECT jobid AS job_id, jobname AS job_name, schedule, active,
             (command ~ 'eyJ[A-Za-z0-9_-]{10,}\\.')      AS command_has_jwt_like_value,
             (command ~ 'supabase\\.co')                 AS command_has_legacy_cloud_url,
             md5(command)                                AS command_md5,
             length(command)                             AS command_length
      FROM cron.job) y)"
else
  JOBS_AUSDRUCK="'[]'::json"
fi
prod_scalar "
SELECT json_build_object(
  'scheduled_jobs_readable', $JOB_TABELLE_DA,
  'functions_with_outward_literal', (SELECT coalesce(json_agg(x ORDER BY x.signature), '[]') FROM (
      SELECT p.oid::regprocedure::text                     AS signature,
             p.prosecdef                                   AS security_definer,
             has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
             (pg_get_functiondef(p.oid) ~ 'eyJ[A-Za-z0-9_-]{10,}\\.')  AS has_jwt_like_value,
             (pg_get_functiondef(p.oid) ~ 'supabase\\.co')             AS has_legacy_cloud_url
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f'
        AND (pg_get_functiondef(p.oid) ~ 'eyJ[A-Za-z0-9_-]{10,}\\.'
             OR pg_get_functiondef(p.oid) ~ 'supabase\\.co')) x),
  'scheduled_jobs', $JOBS_AUSDRUCK
)::text" > "$STAGE/remnants.json"

echo "==> Portalnutzung"
# Zaehlungen, keine Zeilen. Die Frage lautet "wird es benutzt?", und davon
# haengt ab, ob eine Ausserbetriebnahme Kunden betrifft.
PORTAL_TABELLEN="portal_magic_links portal_sessions customer_change_requests"
: > "$TMP/portal.txt"
for tabelle in $PORTAL_TABELLEN; do
  # Erst Existenz, dann Zaehlung: eine Abfrage auf eine fehlende Tabelle
  # scheitert schon beim Parsen und saehe aus wie ein Werkzeugfehler.
  da="$(prod_bool "SELECT (to_regclass('public.$tabelle') IS NOT NULL)::text")"
  if [ "$da" = "true" ]; then
    n="$(prod_scalar "SELECT count(*)::text FROM public.$tabelle")"
    printf '%s|true|%s\n' "$tabelle" "$n" >> "$TMP/portal.txt"
  else
    printf '%s|false|\n' "$tabelle" >> "$TMP/portal.txt"
  fi
done
python3 - "$TMP/portal.txt" "$STAGE/portal-usage.json" <<'PY'
import json, sys
zeilen = [z for z in open(sys.argv[1]).read().splitlines() if z]
ergebnis = {}
for z in zeilen:
    name, da, anzahl = z.split("|")
    ergebnis[name] = {"present": da == "true",
                      "row_count": int(anzahl) if anzahl else None}
json.dump(ergebnis, open(sys.argv[2], "w"))
PY

# ── Laufzeitseite: Edge und Kong ────────────────────────────────────────────
echo "==> Edge-Runtime und Gateway"

# VERIFY_JWT wird FERN gefiltert. Die Umgebung dieses Containers enthaelt
# Dienstschluessel; sie hierher zu holen und lokal zu greppen hiesse, sie durch
# Terminal, Verlauf und jedes Protokoll zu ziehen.
EDGE_VERIFY_JWT="$(ssh_prod_cmd "docker inspect $CRM_PROD_EDGE_CONTAINER --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^VERIFY_JWT=//p'" || true)"
[ -n "$EDGE_VERIFY_JWT" ] || EDGE_VERIFY_JWT="(nicht gesetzt)"

EDGE_CMD="$(ssh_prod_cmd "docker inspect $CRM_PROD_EDGE_CONTAINER --format '{{json .Config.Cmd}}'")"

# Das Function-Wurzelverzeichnis wird aus dem `--main-service`-Argument des
# laufenden Containers abgeleitet, nicht aus einer Mount-Liste geraten: das ist
# der Pfad, den die Laufzeit selbst benutzt. Laesst er sich nicht ableiten,
# bricht der Lauf ab — eine leere Function-Liste saehe sonst aus wie "nichts
# ausgerollt" und waere die gefaehrlichste aller falschen Antworten.
EDGE_ROOT="$(printf '%s' "$EDGE_CMD" | python3 -c '
import json, sys, posixpath
argv = json.load(sys.stdin) or []
if "--main-service" not in argv:
    sys.exit(1)
ziel = argv[argv.index("--main-service") + 1]
print(posixpath.dirname(ziel.rstrip("/")))
')" || {
  echo "ABBRUCH: Function-Wurzel liess sich nicht aus --main-service ableiten." >&2
  echo "  Ohne sie waere die Function-Liste eine Vermutung." >&2
  exit 1
}
case "$EDGE_ROOT" in
  /*/*) ;;
  *) echo "ABBRUCH: abgeleitete Function-Wurzel '$EDGE_ROOT' ist kein plausibler Pfad." >&2; exit 1 ;;
esac

# Je Verzeichnis: der Digest von index.ts (mit dem Repo vergleichbar) UND ein
# Digest ueber den ganzen Baum (Pfade inbegriffen). Nur index.ts zu hashen
# uebersieht eine geaenderte Nebendatei; nur den Baum zu hashen macht den
# Vergleich mit `sha256sum supabase/functions/<n>/index.ts` unmoeglich.
EDGE_LISTE="$(ssh_prod_cmd "docker exec $CRM_PROD_EDGE_CONTAINER sh -c 'cd $EDGE_ROOT || exit 9; for d in */; do d=\${d%/}; if [ -f \"\$d/index.ts\" ]; then i=\$(sha256sum \"\$d/index.ts\" | cut -c1-64); else i=-; fi; t=\$(find \"\$d\" -type f -print0 | sort -z | xargs -0 -r sha256sum | sha256sum | cut -c1-64); n=\$(find \"\$d\" -type f | wc -l); echo \"\$d|\$i|\$t|\$n\"; done'")"
if [ -z "$EDGE_LISTE" ]; then
  echo "ABBRUCH: unter $EDGE_ROOT wurde keine einzige Function gefunden." >&2
  echo "  Das ist kein Befund, sondern ein Werkzeugfehler — nichts veroeffentlicht." >&2
  exit 1
fi

# Kong: die einzige Frage ist, welche Plugins an der Route auf /functions/v1
# haengen. Der Wortlaut der Datei bleibt drueben — sie traegt Consumer-Keys.
KONG_CONF="$(ssh_prod_cmd "docker inspect $CRM_PROD_KONG_CONTAINER --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^KONG_DECLARATIVE_CONFIG=//p'")"
case "$KONG_CONF" in
  /*) ;;
  *) echo "ABBRUCH: KONG_DECLARATIVE_CONFIG ist kein absoluter Pfad." >&2; exit 1 ;;
esac
KONG_DIGEST="$(ssh_prod_cmd "docker exec $CRM_PROD_KONG_CONTAINER sha256sum '$KONG_CONF' | cut -c1-64")"
# Fenster ab der Pfadangabe. Es muss die erwartete Gestalt haben; hat es sie
# nicht, wird abgebrochen. "Keine Plugins gefunden" ist die alarmierende
# Antwort und darf niemals aus einem misslungenen Parsen entstehen.
KONG_FENSTER="$(ssh_prod_cmd "docker exec $CRM_PROD_KONG_CONTAINER grep -A 8 -F -- '- /functions/v1/' '$KONG_CONF'" || true)"
KONG_PLUGINS="$(printf '%s' "$KONG_FENSTER" | python3 -c '
import re, sys
fenster = sys.stdin.read().splitlines()
if not fenster:
    sys.exit(1)
plugins, gesehen = [], False
for zeile in fenster[1:]:
    if re.match(r"^\s*plugins:\s*$", zeile):
        gesehen = True
        continue
    if gesehen:
        treffer = re.match(r"^\s*-\s*name:\s*([A-Za-z0-9_-]+)\s*$", zeile)
        if treffer:
            plugins.append(treffer.group(1))
            continue
        break
if not gesehen:
    sys.exit(1)
print(",".join(plugins))
')" || {
  echo "ABBRUCH: der plugins-Block der /functions/v1-Route war nicht lesbar." >&2
  echo "  'keine Plugins' waere hier die alarmierende Antwort und darf nicht" >&2
  echo "  aus einem misslungenen Parsen entstehen. Nichts veroeffentlicht." >&2
  exit 1
}

EDGE_VERIFY_JWT="$EDGE_VERIFY_JWT" EDGE_ROOT="$EDGE_ROOT" EDGE_CMD="$EDGE_CMD" \
EDGE_LISTE="$EDGE_LISTE" KONG_DIGEST="$KONG_DIGEST" KONG_PLUGINS="$KONG_PLUGINS" \
python3 - "$STAGE/edge-runtime.json" <<'PY'
import json, os, sys

functions = []
for zeile in os.environ["EDGE_LISTE"].splitlines():
    if not zeile.strip():
        continue
    name, index_sha, tree_sha, dateien = zeile.split("|")
    functions.append({
        "name": name,
        "index_ts_sha256": None if index_sha == "-" else index_sha,
        "tree_sha256": tree_sha,
        "file_count": int(dateien),
    })

json.dump({
    "edge_runtime": {
        "verify_jwt": os.environ["EDGE_VERIFY_JWT"],
        "command": json.loads(os.environ["EDGE_CMD"]),
        "functions_root": os.environ["EDGE_ROOT"],
        "deployed_function_count": len(functions),
        "deployed_functions": sorted(functions, key=lambda f: f["name"]),
    },
    "gateway": {
        "declarative_config_sha256": os.environ["KONG_DIGEST"],
        "functions_route_plugins": [p for p in os.environ["KONG_PLUGINS"].split(",") if p],
    },
}, open(sys.argv[1], "w"))
PY

echo "==> Restbestand: Repo, Konfiguration und Deploy im Dreivergleich"
# Die Frage, die diesen Abschnitt ausgeloest hat: `accept-lead` ist auf dem
# Server deployed, aber nirgends mehr im Repo. Bisher war das eine Behauptung
# aus docs/SISTEM_PRD.md, nachgestellt per Hand mit `ls`/`grep`. Hier wird sie
# Teil jeder Aufnahme.
#
# Repo und Konfiguration liegen LOKAL — dafuer ist kein Netzaufruf noetig, nur
# `$EDGE_LISTE` von oben. Ein fehlendes Verzeichnis/eine fehlende Datei ist ein
# BENANNTER Fall (leere Menge), keine unterdrueckte Fehlermeldung: `2>/dev/null
# || true` faengt hier ausschliesslich "existiert nicht"/"kein Treffer" ab, das
# Ergebnis (leere Menge) fliesst offen in den Beleg ein.
REPO_FUNKTIONEN="$( (find "$ROOT/supabase/functions" -mindepth 2 -maxdepth 2 -name index.ts \
  -exec dirname {} \; 2>/dev/null || true) | xargs -rn1 basename | sort -u)"
CONFIG_FUNKTIONEN="$( (grep -oE '^\[functions\.[A-Za-z0-9_-]+\]' "$ROOT/supabase/config.toml" 2>/dev/null || true) \
  | sed -E 's/^\[functions\.([A-Za-z0-9_-]+)\]$/\1/' | sort -u)"
# Nur Verzeichnisse mit eigenem index.ts zaehlen als Function — sonst zaehlt
# `_shared` (Helfer-Module ohne eigenen Entrypoint, lokal UND deployed
# vorhanden) faelschlich als "nur deployed". `$2` ist der index_sha aus
# EDGE_LISTE oben (`name|index_sha|tree_sha|filecount`); "-" heisst "kein
# index.ts", exakt dieselbe Bedingung wie beim JSON-Aufbau von edge-runtime.json.
DEPLOYTE_FUNKTIONEN="$(printf '%s\n' "$EDGE_LISTE" | awk -F'|' '$2 != "-" { print $1 }' | sort -u)"

DEPLOY_ONLY="$(comm -23 <(printf '%s\n' "$DEPLOYTE_FUNKTIONEN") <(printf '%s\n' "$REPO_FUNKTIONEN"))"
REPO_ONLY="$(comm -23 <(printf '%s\n' "$REPO_FUNKTIONEN") <(printf '%s\n' "$DEPLOYTE_FUNKTIONEN"))"
CONFIG_ONLY="$(comm -23 <(printf '%s\n' "$CONFIG_FUNKTIONEN") <(printf '%s\n' "$REPO_FUNKTIONEN"))"
REPO_OHNE_CONFIG="$(comm -23 <(printf '%s\n' "$REPO_FUNKTIONEN") <(printf '%s\n' "$CONFIG_FUNKTIONEN"))"

REPO_FUNKTIONEN="$REPO_FUNKTIONEN" CONFIG_FUNKTIONEN="$CONFIG_FUNKTIONEN" \
DEPLOYTE_FUNKTIONEN="$DEPLOYTE_FUNKTIONEN" DEPLOY_ONLY="$DEPLOY_ONLY" REPO_ONLY="$REPO_ONLY" \
CONFIG_ONLY="$CONFIG_ONLY" REPO_OHNE_CONFIG="$REPO_OHNE_CONFIG" \
python3 - "$STAGE/deploy-repo-diff.json" <<'PY'
import json, os, sys

def zeilen(name):
    return sorted({z for z in os.environ[name].splitlines() if z})

json.dump({
    "repo_functions": zeilen("REPO_FUNKTIONEN"),
    "config_functions": zeilen("CONFIG_FUNKTIONEN"),
    "deployed_functions": zeilen("DEPLOYTE_FUNKTIONEN"),
    "deploy_only": zeilen("DEPLOY_ONLY"),
    "repo_only": zeilen("REPO_ONLY"),
    "config_only_missing_from_repo": zeilen("CONFIG_ONLY"),
    "repo_missing_from_config": zeilen("REPO_OHNE_CONFIG"),
}, open(sys.argv[1], "w"))
PY

DEPLOY_ONLY_ANZAHL="$(printf '%s\n' "$DEPLOY_ONLY" | grep -c . || true)"
echo "    deploy-only (im Code nicht mehr vorhanden): $DEPLOY_ONLY_ANZAHL"

echo "==> Restbestand: Quelltext der deploy-only Funktionen"
# Genau die Funktionen aus deploy_only — nicht mehr, nicht weniger. Fuer jede
# wird der volle Quelltext geholt: "was tut das eigentlich" soll aus dem Beleg
# lesbar sein, statt bei jeder Pruefung erneut von Hand nachgesehen zu werden.
mkdir -p "$TMP/deploy-only"
: > "$TMP/deploy-only-liste.txt"
for name in $DEPLOY_ONLY; do
  # Der Name kommt aus `for d in */` auf dem Container — ein Verzeichnis dort
  # koennte im Prinzip beliebig heissen. Er landet unten in einem doppelt
  # zusammengesetzten Fernbefehl (ssh → docker exec → sh -c); eine
  # Positivliste VOR der ersten Verwendung ist deshalb Pflicht, nicht Zier.
  case "$name" in
    *[!A-Za-z0-9_-]*|'') echo "ABBRUCH: unplausibler Function-Name '$name' aus der Deploy-Liste." >&2; exit 1 ;;
  esac
  echo "$name" >> "$TMP/deploy-only-liste.txt"
  ssh_prod_cmd "docker exec $CRM_PROD_EDGE_CONTAINER sh -c 'test -f \"$EDGE_ROOT/$name/index.ts\" && cat \"$EDGE_ROOT/$name/index.ts\" || true'" \
    > "$TMP/deploy-only/$name.ts"
done

# Quelltext, den niemand seit dem Loeschen aus dem Repo geprueft hat, ist genau
# der Quelltext, der am wahrscheinlichsten ein Geheimnis im Klartext traegt —
# dafuer ist er ja hier. Ein einzelner Treffer darf deshalb NICHT die gesamte
# Aufnahme abbrechen (das machte diesen Abschnitt fuer seinen eigenen Zweck
# unbrauchbar); er redigiert NUR den betroffenen Eintrag. Gepruefft wird mit
# demselben `pruefe()` aus baseline-sanitize.py, das die Aufnahme am Ende noch
# einmal ueber die ganze Datei laufen laesst — diese zweite Pruefung ist damit
# ein echtes zweites Netz, kein Duplikat: sie faengt ab, was hier vergessen
# wurde, nicht das, was hier schon redigiert ist.
python3 - "$TMP/deploy-only-liste.txt" "$TMP/deploy-only" "$STAGE/deploy-only-sources.json" "$ROOT/scripts" <<'PY'
import importlib.util, json, os, sys

liste_pfad, verzeichnis, ziel, scripts_dir = sys.argv[1:5]

spec = importlib.util.spec_from_file_location(
    "baseline_sanitize", os.path.join(scripts_dir, "baseline-sanitize.py"))
baseline_sanitize = importlib.util.module_from_spec(spec)
spec.loader.exec_module(baseline_sanitize)

namen = [z for z in open(liste_pfad).read().splitlines() if z]

ergebnis = {}
for name in namen:
    pfad = os.path.join(verzeichnis, name + ".ts")
    inhalt = open(pfad, encoding="utf-8", errors="replace").read()
    if not inhalt.strip():
        ergebnis[name] = {"source": None, "redacted": False, "redaction_reason": None}
        continue
    funde = baseline_sanitize.pruefe(inhalt)
    if funde:
        ergebnis[name] = {
            "source": None,
            "redacted": True,
            "redaction_reason": [
                {"category": kategorie, "count": anzahl, "fingerprint": kennung}
                for kategorie, anzahl, kennung in funde
            ],
        }
    else:
        ergebnis[name] = {"source": inhalt, "redacted": False, "redaction_reason": None}

json.dump(ergebnis, open(ziel, "w"), ensure_ascii=False)
PY

# ── Nachkontrolle ───────────────────────────────────────────────────────────
echo "==> Nachkontrolle: hat sich die Quelle waehrend der Aufnahme geaendert?"
AUTHZ_NACHHER="$(prod_scalar "$AUTHZ_SONDE_SQL")"
pruefe_md5 "$AUTHZ_NACHHER" "Authz-Sonde nachher"
if [ "$AUTHZ_VORHER" != "$AUTHZ_NACHHER" ]; then
  echo "ABBRUCH: Rechte oder Policies haben sich waehrend der Aufnahme geaendert." >&2
  echo "  vorher  $AUTHZ_VORHER" >&2
  echo "  nachher $AUTHZ_NACHHER" >&2
  echo "  Es wurde nichts veroeffentlicht." >&2
  exit 1
fi
prod_recheck_identity
echo "    Quelle und Rechte unveraendert"

# ── Aufbereiten, pruefen, veroeffentlichen ──────────────────────────────────
echo "==> JSON normalisieren"
# Sortierte Schluessel und feste Einrueckung: sonst haengt der Datei-Hash an der
# Laune des Servers, und ein Vergleich zweier Aufnahmen waere Rauschen.
python3 - "$STAGE" <<'PY'
import json, os, sys
stage = sys.argv[1]
for name in sorted(os.listdir(stage)):
    if not name.endswith(".json"):
        continue
    pfad = os.path.join(stage, name)
    with open(pfad) as fh:
        daten = json.load(fh)
    with open(pfad, "w") as fh:
        json.dump(daten, fh, indent=2, sort_keys=True, ensure_ascii=False)
        fh.write("\n")
PY

echo "==> pruefen, dass nichts nach draussen zeigt"
# Derselbe Pruefkoerper wie beim Test-Baseline. Er meldet Datei, Kategorie und
# Anzahl — nie den Fund. Schlaegt er an, wird nichts veroeffentlicht.
PRUEFLISTE=()
for name in $TRUTH_ARTIFACTS; do
  [ -f "$STAGE/$name" ] || { echo "ABBRUCH: Artefakt $name fehlt." >&2; exit 1; }
  PRUEFLISTE+=("$STAGE/$name")
done
python3 "$ROOT/scripts/baseline-sanitize.py" "${PRUEFLISTE[@]}"

echo "==> Manifest"
TRUTH_ARTIFACTS="$TRUTH_ARTIFACTS" python3 - \
  "$STAGE" "$HEUTE" "$PROD_ZIEL_FINGERPRINT" "$PROD_QUELL_DB" "$PROD_SERVER_VERSION" \
  "$AUTHZ_VORHER" <<'PY'
import hashlib, json, os, sys

stage, heute, ziel_fp, db, version, authz = sys.argv[1:7]
namen = os.environ["TRUTH_ARTIFACTS"].split()

hashes = {}
for name in namen:
    with open(os.path.join(stage, name), "rb") as fh:
        hashes[name] = hashlib.sha256(fh.read()).hexdigest()

# Die `generation` wird aus den Hashes abgeleitet, damit eine halb ersetzte
# Aufnahme auffaellt — genauso wie beim Test-Baseline.
generation = hashlib.sha256(
    "".join(hashes[k] for k in sorted(hashes)).encode()).hexdigest()[:16]

manifest = {
    "captured_at": heute,
    "captured_by": "scripts/capture-production-truth.sh",
    "source_identity_fingerprint_sha256": ziel_fp,
    "source_database": db,
    "server_version": version,
    "authz_probe_md5": authz,
    "artifacts": hashes,
    "generation": generation,
    "what_this_is": (
        "Observed, read-only state of production at capture time: gateway and "
        "edge-runtime auth settings, deployed function digests, function and "
        "table privileges, RLS/policy structure, execute_sql, outward literals, "
        "portal usage, and a repo/config/deploy three-way diff with full source "
        "for deploy-only functions."
    ),
    "what_this_is_not": (
        "Not a migration ledger: it records the schema that exists, not the "
        "files that produced it. Not a deployment manifest: it records what is "
        "deployed, not what should be. Policy expressions are recorded as "
        "hashes plus traits, never verbatim."
    ),
}
with open(os.path.join(stage, "capture-manifest.json"), "w") as fh:
    json.dump(manifest, fh, indent=2, sort_keys=True, ensure_ascii=False)
    fh.write("\n")
print("    Generation " + generation)
PY

python3 "$ROOT/scripts/baseline-sanitize.py" "$STAGE/capture-manifest.json"

echo "==> veroeffentlichen"
chmod 0755 "$STAGE"
chmod 0644 "$STAGE"/*
# Kein `[ -e … ] && rm`: unter `set -e` waere ein nicht vorhandenes Ziel der
# letzte Befehl mit rc=1 und damit ein stiller Abbruch kurz vor dem Ziel.
if [ -e "$ZIEL" ]; then rm -rf "$ZIEL"; fi
mv "$STAGE" "$ZIEL"
trap 'rm -rf "$TMP"' EXIT

echo "==> fertig: $ZIEL"
