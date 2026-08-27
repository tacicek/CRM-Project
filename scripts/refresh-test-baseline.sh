#!/usr/bin/env bash
# Frischt supabase-test/baseline/ aus der Produktion auf.
#
# Bis 2026-07-28 stand diese Prozedur nur als Prosa in supabase-test/README.md.
# Sie wurde dadurch selten ausgefuehrt — der Baseline war zuletzt 16 Migrationen
# hinterher, und die DB-Integrationssuite sagte damit nichts mehr ueber den
# heutigen Stand aus.
#
# ── WAS DIESES SKRIPT IST UND WAS NICHT ─────────────────────────────────────
#
# ES IST: der Erzeuger des TEST-Baselines. Er nimmt einen `pg_dump
# --schema-only --no-privileges` und legt die Rechte in eigenen, getrennt
# erzeugten Schnappschuessen daneben. Das `--no-privileges` ist hier RICHTIG,
# weil die ACLs separat und praeziser abgebildet werden.
#
# ES IST NICHT: der Installer fuer eine neue Firma. Ein Installer-Dump darf
# NICHT mit `--no-privileges` laufen und muss ausserdem Rollen, Owner,
# Schema-ACLs, Default Privileges, cron-Jobs, Storage-Buckets und Secrets
# mitnehmen — nichts davon steht hier. Siehe supabase-test/README.md,
# Abschnitt "Baseline ist kein Installer".
#
# ── WAS DER SCHNAPPSCHUSS ABBILDET ──────────────────────────────────────────
#
# Nicht "die exakte Produktions-ACL", sondern eine
#
#     tracked-principal direct-privilege projection
#
# also: die DIREKT vergebenen Rechte fuer genau vier Prinzipale — PUBLIC, anon,
# authenticated, service_role. Bewusst NICHT abgebildet: Grantor-Ketten,
# Owner-Rechte, Rollenmitgliedschaften, weitere Rollen, Schema-ACLs, Default
# Privileges, Spalten-ACLs. Wo eine dieser Auslassungen das Ergebnis
# verfaelschen wuerde, bricht das Skript ab, statt sie zu verschlucken
# (Vorpruefungen weiter unten).
#
# ── LESEND, ABER NICHT UNANTASTBAR ──────────────────────────────────────────
#
# Jede Datenbankverbindung laeuft mit
# `PGOPTIONS=-c default_transaction_read_only=on`. Das ist ein UNFALLSCHUTZ,
# KEINE Sicherheitsgrenze: `default_transaction_read_only` ist ein GUC, und
# eine Sitzung mit Superuser-Rechten koennte es per `SET` selbst wieder
# abschalten. Es schuetzt davor, dass ein Tippfehler in diesem Skript schreibt
# — nicht davor, dass jemand bewusst schreiben will. Deshalb sind alle hier
# abgesetzten Anweisungen fest verdrahtet und lesend.
#
# ── AUFRUF ──────────────────────────────────────────────────────────────────
#
# Es gibt KEINE eingebauten Produktionsziele. Fuenf Angaben sind Pflicht; die
# beiden Bestaetigungen sind SHA-256-Werte ueber das GANZE Ziel (Host, Container,
# Cluster-Kennung), damit eine kopierte Kommandozeile mit ausgetauschtem Ziel
# nicht durchkommt. Berechnung siehe supabase-test/README.md.
#
#   CRM_PROD_SSH=root@<host> \
#   CRM_PROD_DB_CONTAINER=<container> \
#   CRM_PROD_SYSTEM_IDENTIFIER=<pg_control_system().system_identifier> \
#   CRM_PROD_READ_CONFIRM=<sha256 des Ziels> \
#   CRM_PROD_CHANGE_FREEZE_CONFIRM=<sha256 mit change-freeze-Salt> \
#     bash scripts/refresh-test-baseline.sh
#
# Optional: CRM_PROD_SSH_CONFIG=~/.ssh/config, falls Zugangsdaten (IdentityFile,
# ProxyJump) dort stehen. Vorgabe ist /dev/null — die eigene ssh-Konfiguration
# wird also bewusst NICHT gelesen, damit der Lauf reproduzierbar bleibt.
#
# Danach:
#   npm run test:db:up
#   CRM_TEST_ENV=1 TEST_DB_ADMIN_PASSWORD=<lokales Passwort> npm run test:db:bootstrap
#   CRM_TEST_ENV=1 TEST_DB_ADMIN_PASSWORD=<lokales Passwort> npm run test:db

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$ROOT/supabase-test/baseline"
# BASELINE_ARTIFACTS: die Menge, die eine vollstaendige Generation ausmacht.
# Erzeuger und Pruefer lesen dieselbe Liste — sonst koennte hier eine Datei
# dazukommen, die dort niemand vermisst.
. "$ROOT/scripts/baseline-artifacts.sh"
# Ziel, Bestaetigung, Ferntransport und Identitaetspruefung stehen in
# prod-readonly.sh, weil capture-production-truth.sh dieselben Zusicherungen
# braucht. Zwei Fassungen derselben Pruefung waeren genau die stille Abweichung,
# gegen die dieses Werkzeug gebaut ist.
. "$ROOT/scripts/prod-readonly.sh"

# ── Produktionszugang: ausdruecklich, nie voreingestellt ─────────────────────
prod_require_target
prod_require_read_confirm

# Getrennt bestaetigt, weil es eine andere Zusage ist: nicht "ich lese die
# richtige Instanz", sondern "waehrend ich lese, aendert dort niemand etwas".
# Eigener Salt, damit der eine Wert nicht fuer den anderen durchgereicht werden
# kann. Sie steht NICHT in prod-readonly.sh: die Befundaufnahme braucht keinen
# eingefrorenen Stand, sie berichtet, was sie sieht.
: "${CRM_PROD_CHANGE_FREEZE_CONFIRM:?ABBRUCH: CRM_PROD_CHANGE_FREEZE_CONFIRM fehlt (Zusicherung, dass waehrend der Aufnahme keine Migration/DDL/GRANT laeuft).}"
FREEZE_FINGERPRINT="$(printf 'change-freeze|%s' "$PROD_ZIEL_FINGERPRINT" \
  | sha256sum | cut -d' ' -f1)"
if [ "$CRM_PROD_CHANGE_FREEZE_CONFIRM" != "$FREEZE_FINGERPRINT" ]; then
  echo "ABBRUCH: CRM_PROD_CHANGE_FREEZE_CONFIRM passt nicht zum Ziel." >&2
  echo "  Diese Zusicherung ist noetig, weil die Aufnahme aus mehreren" >&2
  echo "  Verbindungen besteht. Die Drift-Sonde stellt eine Aenderung" >&2
  echo "  nachtraeglich fest — verhindern kann sie nichts, und eine Aenderung" >&2
  echo "  und ihre Ruecknahme waehrend der Aufnahme (A→B→A) saehe sie gar nicht." >&2
  exit 1
fi

prod_connect

# Der Rohdump und alles daraus Abgeleitete liegt kurzzeitig unsanitisiert auf
# der Platte. Bis zur Veroeffentlichung geht das niemanden sonst auf dieser
# Maschine etwas an.
umask 077

TMP="$(mktemp -d)"
# Die Buehne liegt als Geschwister neben dem Ziel, nicht in /tmp: nur so ist
# das spaetere `mv` ein Rename im selben Dateisystem und damit unteilbar.
STAGE="$(mktemp -d "$BASE/.stage.XXXXXX")"
trap 'rm -rf "$TMP" "$STAGE"' EXIT

# Auffrischen und Einspielen duerfen sich nicht ueberlappen: sonst liest
# test-db.sh eine halb veroeffentlichte Generation.
exec 9>"$BASE/.baseline.lock"
if ! flock -n -x 9; then
  echo "ABBRUCH: eine andere Baseline-Operation laeuft (.baseline.lock)." >&2
  exit 1
fi

echo "==> Vorpruefungen (Abbruch statt stiller Auslassung)"

# Erst: reden wir mit GENAU der erwarteten Instanz, und sieht die Datenbank nach
# dieser Anwendung aus? Beides steht in prod-readonly.sh (prod_check_identity)
# und setzt PROD_SYSTEM_ID, PROD_SHAPE, PROD_QUELL_DB, PROD_SERVER_VERSION.
prod_check_identity

# Gibt es die drei Rollen, deren Rechte projiziert werden? Das gehoert NICHT in
# die gemeinsame Pruefung: es ist eine Vorbedingung der ACL-Projektion, nicht
# der Identitaet.
ROLLEN="$(prod_scalar "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')")"
if [ "$ROLLEN" != "3" ]; then
  echo "ABBRUCH: $ROLLEN von 3 verfolgten Rollen vorhanden — ohne sie ist die Projektion unvollstaendig." >&2
  exit 1
fi

SPALTEN_ACL="$(prod_scalar "SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attacl IS NOT NULL")"
if [ "$SPALTEN_ACL" != "0" ]; then
  echo "ABBRUCH: $SPALTEN_ACL Spalten-ACL(s) gefunden — die Projektion bildet sie nicht ab." >&2
  exit 1
fi

# Grantor-Topologie: die Projektion gibt jedes Recht als Owner-Grant wieder.
# Stammt ein Recht von jemand anderem, laesst es sich so nicht originalgetreu
# nachbauen — und der Fingerprint wuerde eine Gleichheit behaupten, die es
# nicht gibt.
#
# Relationen und Sequenzen werden GETRENNT gefragt: acldefault erwartet einen
# "char"-Objekttyp, und der ist fuer Sequenzen 's' (klein) — waehrend
# pg_class.relkind fuer dieselbe Sequenz 'S' (gross) fuehrt. Beides in ein
# CASE zu packen liefert ausserdem `text` statt `"char"`.
FREMDE_GRANTOR_SQL="
WITH verfolgt AS (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')),
rel AS (
  SELECT x.grantor, c.relowner AS eigner
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
    AND (x.grantee=0 OR x.grantee IN (SELECT oid FROM verfolgt))
),
seq AS (
  SELECT x.grantor, c.relowner AS eigner
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('s', c.relowner))) x
  WHERE n.nspname='public' AND c.relkind = 'S'
    AND (x.grantee=0 OR x.grantee IN (SELECT oid FROM verfolgt))
),
fn AS (
  SELECT x.grantor, p.proowner AS eigner
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
  WHERE n.nspname='public' AND p.prokind='f'
    AND (x.grantee=0 OR x.grantee IN (SELECT oid FROM verfolgt))
)
SELECT count(*) FROM (SELECT * FROM rel UNION ALL SELECT * FROM seq UNION ALL SELECT * FROM fn) alle
WHERE grantor <> eigner"
FREMDE_GRANTOR="$(prod_scalar "$FREMDE_GRANTOR_SQL")"
if [ "$FREMDE_GRANTOR" != "0" ]; then
  echo "ABBRUCH: $FREMDE_GRANTOR Recht(e) stammen nicht vom Eigentuemer — Grantor-Ketten werden nicht abgebildet." >&2
  exit 1
fi
# Die Kennung wird BESTAETIGT, nicht wiederholt. Der Aufrufer hat sie selbst als
# CRM_PROD_SYSTEM_IDENTIFIER hereingegeben — sie zurueckzuschreiben verraet ihm
# nichts Neues, landet aber in jedem mitgeschnittenen Lauf und in jedem Bericht,
# der die Ausgabe zitiert. Die Abbruchmeldung weiter oben nennt sie aus demselben
# Grund nicht; hier stand sie nur deshalb, weil der Test, der genau das prueft,
# wegen eines Subshell-Fehlers in der Testhilfe nie ausgefuehrt wurde.
echo "    Instanz bestaetigt · Quelle $PROD_QUELL_DB (PostgreSQL $PROD_SERVER_VERSION)"
echo "    Kerntabellen 7/7, verfolgte Rollen 3/3, Spalten-ACLs 0, Fremd-Grantor 0"

# ── Drift-Sonde: RECHTE ─────────────────────────────────────────────────────
# Der Schema-Drift wird ueber den Dump selbst erkannt (er wird am Ende ein
# zweites Mal geholt und verglichen). Was der Dump NICHT enthaelt, sind die
# Rechte — er laeuft mit --no-privileges. Genau die stehen hier: alle ACL-
# Flaechen, die in die Projektion einfliessen ODER sie unbemerkt verfaelschen
# koennten.
#
# EIGENTUEMER stehen hier ebenfalls drin, obwohl sie nicht Teil der Projektion
# sind: der Dump laeuft mit `--no-owner`, also faellt ein Eigentuemerwechsel aus
# dem Dump-Vergleich heraus. Er aendert aber, was `acldefault` liefert, und
# damit die Grundlage der Projektion. Gemessen wird nur die VERAENDERUNG
# waehrend der Aufnahme — Eigentuemer-Parity zwischen Produktion und Teststapel
# bleibt bewusst ausserhalb (siehe README).
ACL_SONDE_SQL="
SELECT md5(concat_ws('|',
  (SELECT md5(coalesce(string_agg(c.relname||':'||coalesce(c.relacl::text,'-')||':'||pg_get_userbyid(c.relowner), ',' ORDER BY c.relname COLLATE \"C\", c.oid),''))
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')),
  (SELECT md5(coalesce(string_agg(p.proname||':'||coalesce(p.proacl::text,'-')||':'||pg_get_userbyid(p.proowner), ',' ORDER BY p.proname COLLATE \"C\", p.oid),''))
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
  (SELECT md5(coalesce(string_agg(c.relname||'.'||a.attname||':'||a.attacl::text, ',' ORDER BY c.relname COLLATE \"C\", a.attname COLLATE \"C\"),''))
     FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND a.attacl IS NOT NULL),
  (SELECT md5(coalesce(string_agg(n.nspname||':'||coalesce(n.nspacl::text,'-')||':'||pg_get_userbyid(n.nspowner), ',' ORDER BY n.nspname COLLATE \"C\"),''))
     FROM pg_namespace n WHERE n.nspname='public'),
  (SELECT md5(coalesce(string_agg(t.typname||':'||coalesce(t.typacl::text,'-')||':'||pg_get_userbyid(t.typowner), ',' ORDER BY t.typname COLLATE \"C\", t.oid),''))
     FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
     WHERE n.nspname='public'),
  (SELECT md5(coalesce(string_agg(pg_get_userbyid(d.defaclrole)||':'||coalesce(dn.nspname,'-')||':'||d.defaclobjtype::text||':'||d.defaclacl::text, ',' ORDER BY d.oid),''))
     FROM pg_default_acl d LEFT JOIN pg_namespace dn ON dn.oid=d.defaclnamespace),
  (SELECT md5(coalesce(string_agg(c.relname, ',' ORDER BY c.relname COLLATE \"C\"),''))
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r' AND c.relname ~ '^undo_[0-9]{14}\$')
))"
pruefe_fingerprint_wert() {
  if [[ ! "$1" =~ ^[0-9a-f]{32}$ ]]; then
    echo "ABBRUCH: Sonde lieferte keinen Fingerprint ($2)." >&2
    exit 1
  fi
}
ACL_VORHER="$(prod_scalar "$ACL_SONDE_SQL")"
pruefe_fingerprint_wert "$ACL_VORHER" "ACL vorher"
echo "    ACL-Sonde vorher: $ACL_VORHER"

prod_dump() {  # $1 = Zieldatei
  ssh_prod "$PROD_REMOTE_PREFIX pg_dump -U postgres -d postgres --schema-only --schema=public --no-owner --no-privileges --lock-wait-timeout=5s" \
    < /dev/null > "$1"
}

# Der Dump-Fingerprint (Normalisierung + SHA-256) steht in
# scripts/baseline-artifacts.sh als baseline_dump_fingerprint — dort ist er
# ohne Produktionszugang testbar.

echo "==> Schema-Dump (nur lesend)"
prod_dump "$TMP/roh.sql"
DUMP_VORHER="$(baseline_dump_fingerprint "$TMP/roh.sql")"
echo "    Dump-Fingerprint vorher: ${DUMP_VORHER:0:16}…"
# Der Rohdump gilt als sensibel und wird NIE committet — er bleibt in $TMP.

echo "==> sanitisieren"
python3 - "$TMP/roh.sql" "$STAGE/schema.sql" <<'PY'
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
s = re.sub(r"'[a-zA-Z][a-zA-Z0-9+.-]*://[^']*'", "'https://test.invalid'", s)
s = re.sub(r"'Bearer [^']*'", "'Bearer test-placeholder'", s)
s = re.sub(r"'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'", "'test@test.invalid'", s)
s = re.sub(r"'\d{1,3}(\.\d{1,3}){3}'", "'127.0.0.1'", s)

open(ziel, "w").write(s)
PY

echo "==> Tabellenrechte uebernehmen"
# Der Dump enthaelt absichtlich keine ACL. Ein pauschales GRANT waere aber
# ebenfalls falsch: nach einem spaeteren REVOKE in der Produktion wuerde der
# Teststapel das Recht bei jedem Neuaufbau wieder oeffnen. Deshalb wird die
# direkte ACL je Relation reproduziert, inklusive PUBLIC und GRANT OPTION.
#
# SORTIERUNG. Der Fingerprint entsteht in der Produktion und wird in der
# Test-Datenbank nachgerechnet — zwei verschiedene Instanzen. Nach `grantee`
# zu sortieren hiesse, nach einer OID zu sortieren, und OIDs werden bei
# `CREATE ROLE` vergeben. Zwei Instanzen koennen dieselben Rechte in anderer
# Reihenfolge aufzaehlen und damit einen anderen md5 ergeben. Sortiert wird
# deshalb nach dem kanonischen NAMEN, und `COLLATE "C"` haelt die Ordnung auch
# unabhaengig von der Locale der jeweiligen Datenbank fest.
ORDER_REL='relname COLLATE "C", grantee_name COLLATE "C", privilege_type COLLATE "C", is_grantable'
ORDER_FN='proname COLLATE "C", argumente COLLATE "C", grantee_name COLLATE "C", privilege_type COLLATE "C", is_grantable'

# $2 ist der "char"-Objekttyp fuer acldefault und NICHT dasselbe wie relkind.
# Verwendet werden `acldefault('r', …)` fuer Tabellen/Sichten und
# `acldefault('s', …)` fuer Sequenzen — beide KLEIN, waehrend pg_class.relkind
# fuer dieselbe Sequenz 'S' (GROSS) fuehrt.
#
# Warum das hier ausdruecklich steht: der grosse Buchstabe faellt nicht von
# selbst auf. Er bricht nicht ab, sondern liefert stillschweigend
# `{owner=U/owner}` statt `{owner=rwU/owner}` (gemessen, PostgreSQL 15). Auf die
# Projektion haette das keine sichtbare Folge — acldefault erzeugt nur
# Eigentuemer-Rechte, und der Eigentuemer ist kein verfolgter Prinzipal —, aber
# ein falscher Vorgabewert, der sich nicht meldet, bleibt ein falscher.
rel_cte() {  # $1 = relkind-Liste, $2 = acldefault-Objekttyp ('r' oder 's')
  cat <<SQL
WITH relevante_acl AS (
  SELECT c.relname,
         CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee_name,
         x.privilege_type,
         x.is_grantable
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(c.relacl, acldefault('$2', c.relowner))
  ) x
  WHERE n.nspname = 'public'
    AND c.relkind IN ($1)
    AND (
      x.grantee = 0
      OR x.grantee IN (
        SELECT oid FROM pg_roles
        WHERE rolname IN ('anon','authenticated','service_role')
      )
    )
)
SQL
}

REL_HASH="md5(coalesce(string_agg(
    relname || ':' || grantee_name || ':' || privilege_type || ':' || is_grantable::text,
    ',' ORDER BY $ORDER_REL
  ), ''))"

# $1=Titel $2=CTE $3=Hash-Ausdruck $4=REVOKE $5=GRANT-SELECT $6=Fingerprint $7=Ziel
acl_datei() {
  {
    echo "-- ERZEUGT von scripts/refresh-test-baseline.sh — nicht von Hand aendern."
    echo "-- $1 (tracked-principal direct-privilege projection: PUBLIC, anon,"
    echo "-- authenticated, service_role). Fingerprint: $6"
    echo "$4"
    printf '%s\n%s;\n' "$2" "$5" | PROD_SQL
    cat <<SQL
DO \$acl_check\$
DECLARE ist TEXT;
BEGIN
$2
  SELECT $3 INTO ist FROM relevante_acl;

  IF ist IS DISTINCT FROM '$6' THEN
    RAISE EXCEPTION '$1 — ACL-Fingerprint weicht ab: %', ist;
  END IF;
END
\$acl_check\$;
SQL
  } > "$7"
}

pruefe_fingerprint() {  # $1 = Wert, $2 = Bezeichnung
  if [[ ! "$1" =~ ^[0-9a-f]{32}$ ]]; then
    echo "ABBRUCH: ungueltiger $2-Fingerprint." >&2
    exit 1
  fi
}

TABLE_CTE="$(rel_cte "'r','p','v','m','f'" r)"
TABLE_FP="$(printf '%s\nSELECT %s FROM relevante_acl;\n' "$TABLE_CTE" "$REL_HASH" | PROD_SQL)"
pruefe_fingerprint "$TABLE_FP" "Tabellen-ACL"
acl_datei "Tabellen-/View-ACLs" "$TABLE_CTE" "$REL_HASH" \
  "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;" \
  "SELECT format(
  'GRANT %s ON TABLE public.%I TO %s%s;',
  privilege_type, relname,
  CASE WHEN grantee_name = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(grantee_name) END,
  CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
) FROM relevante_acl ORDER BY $ORDER_REL" \
  "$TABLE_FP" "$STAGE/table-grants.sql"

echo "==> Sequenzrechte uebernehmen"
# Eigener Schnappschuss statt `relkind='S'` im Tabellen-CTE: Sequenzen haben
# ein anderes acldefault ('S'), einen anderen Rechtevorrat (USAGE/SELECT/
# UPDATE) und brauchen ein eigenes `REVOKE ... ON ALL SEQUENCES`. In einen
# gemeinsamen Ruecksetzschritt gepackt waere einer der beiden immer falsch.
SEQUENCE_CTE="$(rel_cte "'S'" s)"
SEQUENCE_FP="$(printf '%s\nSELECT %s FROM relevante_acl;\n' "$SEQUENCE_CTE" "$REL_HASH" | PROD_SQL)"
pruefe_fingerprint "$SEQUENCE_FP" "Sequenz-ACL"
acl_datei "Sequenz-ACLs" "$SEQUENCE_CTE" "$REL_HASH" \
  "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;" \
  "SELECT format(
  'GRANT %s ON SEQUENCE public.%I TO %s%s;',
  privilege_type, relname,
  CASE WHEN grantee_name = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(grantee_name) END,
  CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
) FROM relevante_acl ORDER BY $ORDER_REL" \
  "$SEQUENCE_FP" "$STAGE/sequence-grants.sql"

echo "==> Funktionsrechte uebernehmen"
# WARUM DIESE DATEI EXISTIERT
# Der Dump oben laeuft mit --no-privileges. Bei TABELLEN ist das harmlos: ohne
# ACL kommt niemand heran. Bei FUNKTIONEN ist es das Gegenteil — Postgres'
# Vorgabe fuer eine Funktion ohne ACL ist EXECUTE fuer PUBLIC. Die Rechte
# wegzulassen SCHLIESST Funktionen also nicht, es OEFFNET sie.
#
# Damit war jedes `REVOKE EXECUTE` der Produktion (submit_lead, die Kunden-RPCs,
# run_pipeline_automations) im Teststapel unsichtbar: dort durfte anon alles.
#
# Abgebildet wird die DIREKTE Vergabe, nicht das Ergebnis von
# `has_function_privilege`. Der Unterschied ist der Grund, warum diese Datei
# ueberhaupt neu erzeugt wurde: ein an PUBLIC vergebenes EXECUTE als
# `GRANT ... TO anon` zu notieren macht aus einem `REVOKE ... FROM anon` im
# Test einen Erfolg, der in der Produktion folgenlos bleibt.
FUNCTION_CTE="$(cat <<'SQL'
WITH relevante_acl AS (
  SELECT p.proname,
         pg_get_function_identity_arguments(p.oid) AS argumente,
         CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee_name,
         x.privilege_type,
         x.is_grantable
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(p.proacl, acldefault('f', p.proowner))
  ) x
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND (
      x.grantee = 0
      OR x.grantee IN (
        SELECT oid FROM pg_roles
        WHERE rolname IN ('anon','authenticated','service_role')
      )
    )
)
SQL
)"

FUNCTION_HASH="md5(coalesce(string_agg(
    proname || '(' || argumente || '):' || grantee_name || ':' || privilege_type || ':' || is_grantable::text,
    ',' ORDER BY $ORDER_FN
  ), ''))"

FUNCTION_FP="$(printf '%s\nSELECT %s FROM relevante_acl;\n' "$FUNCTION_CTE" "$FUNCTION_HASH" | PROD_SQL)"
pruefe_fingerprint "$FUNCTION_FP" "Funktions-ACL"
acl_datei "Funktions-ACLs" "$FUNCTION_CTE" "$FUNCTION_HASH" \
  "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;" \
  "SELECT format(
  'GRANT %s ON FUNCTION public.%I(%s) TO %s%s;',
  privilege_type, proname, argumente,
  CASE WHEN grantee_name = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(grantee_name) END,
  CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
) FROM relevante_acl ORDER BY $ORDER_FN" \
  "$FUNCTION_FP" "$STAGE/function-grants.sql"

zeilen="$(grep -c '^GRANT' "$STAGE/function-grants.sql" || true)"
if [ "$zeilen" -lt 100 ]; then
  echo "ABBRUCH: nur $zeilen GRANT-Zeilen — das kann nicht der Produktionsstand sein." >&2
  exit 1
fi
echo "    $zeilen GRANT-Zeilen uebernommen"

echo "==> Manifest berechnen"
printf '%s\n' "
select 'enums', count(*)::text from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'
union all select 'tables', count(*)::text from pg_tables where schemaname='public'
union all select 'views', count(*)::text from pg_views where schemaname='public'
union all select 'matviews', count(*)::text from pg_matviews where schemaname='public'
union all select 'sequences', count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S'
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
" | PROD_SQL_FIELDS > "$TMP/werte.txt"

prod_scalar "select coalesce(json_object_agg(typname, werte)::text,'{}') from (select t.typname, json_agg(e.enumlabel order by e.enumsortorder) werte from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname) x;" \
  > "$TMP/enums.json"

# Beleg fuer den Migrationsstand — GEMESSEN, nicht uebernommen. Was hier nicht
# mehr steht, ist auch kein Beleg mehr: laeuft ein ROLLBACK-Skript, faellt die
# undo-Tabelle weg und verschwindet damit aus der Liste.
# Nur Namen im Migrationsformat `undo_<14 Ziffern>`: eine beliebige Tabelle, die
# zufaellig mit "undo_" anfaengt, ist kein Beleg fuer eine Migration.
prod_scalar "
select coalesce(json_agg(json_build_object(
         'migration', substring(c.relname from 6),
         'kind', 'undo table observed in production',
         'object', 'public.' || c.relname
       ) order by c.relname)::text, '[]')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname ~ '^undo_[0-9]{14}\$'" \
  > "$TMP/evidenz.json"

echo "==> Nachkontrolle: hat sich die Quelle waehrend der Aufnahme geaendert?"
# 1) Das Schema: derselbe Dump ein zweites Mal.
prod_dump "$TMP/roh2.sql"
DUMP_NACHHER="$(baseline_dump_fingerprint "$TMP/roh2.sql")"
if [ "$DUMP_VORHER" != "$DUMP_NACHHER" ]; then
  # KEIN `diff` der Rohdumps. Der Rohdump ist nach der eigenen Regel dieses
  # Skripts unsanitisiert und damit vertraulich — eine Zeile daraus im Terminal
  # ist derselbe Fehler, den die Sanitisierung eine Zeile weiter verhindert.
  # Der Vergleich gehoert an die Kopien in $TMP, nicht ins Protokoll.
  echo "ABBRUCH: das Schema hat sich waehrend der Aufnahme geaendert." >&2
  echo "  Fingerprint vorher  $DUMP_VORHER" >&2
  echo "  Fingerprint nachher $DUMP_NACHHER" >&2
  echo "  Es wurde nichts veroeffentlicht." >&2
  exit 1
fi

# 2) Die Rechte, die im Dump gar nicht stehen.
ACL_NACHHER="$(prod_scalar "$ACL_SONDE_SQL")"
pruefe_fingerprint_wert "$ACL_NACHHER" "ACL nachher"
if [ "$ACL_VORHER" != "$ACL_NACHHER" ]; then
  echo "ABBRUCH: die Rechte haben sich waehrend der Aufnahme geaendert." >&2
  echo "  vorher  $ACL_VORHER" >&2
  echo "  nachher $ACL_NACHHER" >&2
  echo "  Es wurde nichts veroeffentlicht." >&2
  exit 1
fi

# 3) Reden wir am Ende noch mit DERSELBEN Quelle? Die Aufnahme besteht aus
#    einem Dutzend Verbindungen; zwischen zwei davon koennte der Container
#    getauscht, ein Failover gelaufen oder die Datenbank gewechselt worden sein.
#    Verglichen wird gegen die Werte vom Anfang — ohne sie auszugeben.
prod_recheck_identity

# 4) Die drei Vorbedingungen noch einmal — sie koennten seit dem Anfang
#    weggefallen sein, und dann waere die Projektion still unvollstaendig.
NACH_SPALTEN_ACL="$(prod_scalar "SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attacl IS NOT NULL")"
NACH_ROLLEN="$(prod_scalar "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')")"
NACH_GRANTOR="$(prod_scalar "$FREMDE_GRANTOR_SQL")"
if [ "$NACH_SPALTEN_ACL" != "0" ] || [ "$NACH_ROLLEN" != "3" ] || [ "$NACH_GRANTOR" != "0" ]; then
  echo "ABBRUCH: Vorbedingungen gelten am Ende nicht mehr" >&2
  echo "  (Spalten-ACLs=$NACH_SPALTEN_ACL, Rollen=$NACH_ROLLEN, Fremd-Grantor=$NACH_GRANTOR)." >&2
  exit 1
fi
echo "    Quelle, Schema, Rechte und Vorbedingungen unveraendert"

echo "==> pruefen, dass nichts nach draussen zeigt"
# Geprueft wird ALLES, was aus der Produktion stammt — nicht nur schema.sql.
# Die ACL-Dateien tragen Relations-, Funktions- und Rollennamen aus der echten
# Datenbank; sie sind damit genauso veroeffentlichungsrelevant. Der Pruefkoerper
# liegt in scripts/baseline-sanitize.py, damit der Test GENAU den Code laufen
# laesst, der hier laeuft — und nicht eine herausgekratzte Kopie davon.

python3 "$ROOT/scripts/baseline-sanitize.py" \
  "$STAGE/schema.sql" "$STAGE/table-grants.sql" "$STAGE/sequence-grants.sql" \
  "$STAGE/function-grants.sql" "$TMP/enums.json" "$TMP/werte.txt" "$TMP/evidenz.json"

python3 "$ROOT/scripts/baseline-manifest.py" \
  --werte "$TMP/werte.txt" --enums "$TMP/enums.json" --evidenz "$TMP/evidenz.json" \
  --alt "$BASE/parity-manifest.json" --ziel "$STAGE/parity-manifest.json" \
  --stage "$STAGE" --artefakte "$BASELINE_ARTIFACTS" \
  --table-acl "$TABLE_FP" --sequence-acl "$SEQUENCE_FP" --function-acl "$FUNCTION_FP" \
  --quell-db "$PROD_QUELL_DB" --server-version "$PROD_SERVER_VERSION" \
  --ziel-fingerprint "$PROD_ZIEL_FINGERPRINT" --heute "$(date +%F)"

echo "==> Manifest mitpruefen"
# Das Manifest traegt Zaehlungen, Enum-Werte und den Herkunftssatz aus der
# Produktion — also faellt es unter dieselbe Pruefung wie alles andere.
python3 "$ROOT/scripts/baseline-sanitize.py" "$STAGE/parity-manifest.json"

echo "==> veroeffentlichen"
# Reihenfolge und Rechte stehen in baseline_publish (scripts/baseline-artifacts.sh):
# Manifest zuerst, Modus 0644 VOR dem ersten Rename. Der Test fuehrt dieselbe
# Funktion aus, statt die Reihenfolge abzuschreiben.
baseline_publish "$STAGE" "$BASE"

echo "==> fertig: Schema, Tabellen-/Sequenz-/Funktionsrechte und Manifest aufgefrischt"

# Der Uebergang bei den Sequenzrechten endet hier — und zwar nachpruefbar, nicht
# als Merkzettel: solange der pauschale GRANT in grants.sql steht, verweigern
# test-db.sh und wiki-db.sh den Start (baseline_check_sequence_transition).
#
# Gesucht wird mit DERSELBEN Funktion wie dort. Frueher stand hier ein eigenes
# `grep`-Muster; zwei Sucher fuer dieselbe Frage koennen unterschiedlich
# urteilen, und dann sagt diese Stelle "alles erledigt", waehrend das Gate, auf
# das es ankommt, den Start verweigert — oder schlimmer: umgekehrt.
SEQ_SCAN_RC=0
baseline_has_blanket_sequence_grant "$BASE/grants.sql" || SEQ_SCAN_RC=$?
case "$SEQ_SCAN_RC" in
  0)
    echo
    echo "    NAECHSTER SCHRITT — sonst startet der Teststapel nicht mehr:"
    echo "    In $BASE/grants.sql den pauschalen Sequenz-GRANT loeschen."
    echo "    sequence-grants.sql setzt Sequenzrechte jetzt selbst."
    ;;
  1) ;;
  *)
    # Kein stiller Durchlauf: "nicht entscheidbar" darf nicht aussehen wie
    # "nichts gefunden". Die Aufnahme selbst ist zu diesem Zeitpunkt
    # veroeffentlicht und gueltig — deshalb hier eine laute Meldung statt eines
    # Abbruchs. Das eigentliche Gate zieht ohnehin:
    echo
    echo "    ⚠ $BASE/grants.sql liegt ausserhalb der erlaubten Grammatik einer"
    echo "      statischen Rechtedatei (unlesbar, unerwartete Anweisung, oder"
    echo "      die kanonische schema-USAGE-Zeile fehlt/steht mehrfach). Ob dort"
    echo "      scope-weit Sequenzrechte vergeben werden, ist damit UNBEKANNT."
    echo "      test-db.sh und wiki-db.sh verweigern aus demselben Grund den"
    echo "      Start, bis die Datei wieder in der Grammatik liegt."
    ;;
esac
echo "    Von Hand bleibt: migration_checkpoint.declared_through im Manifest."
