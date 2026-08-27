#!/usr/bin/env bash
# Tests fuer die Befundaufnahme (capture-production-truth.sh, prod-readonly.sh).
#
# Warum es diese Datei gibt: fast alles, was dieses Werkzeug schuetzt, sind
# Fehlerpfade — falsches Ziel, unlesbarer Kong-Block, leere Function-Liste,
# Rechte-Drift mitten in der Aufnahme, ein Geheimnis im aufgenommenen Rumpf.
# Im Normalbetrieb laeuft keiner davon, und was nie laeuft, verrottet.
#
# Der gefaehrlichste Fehler dieses Werkzeugs waere kein Absturz, sondern eine
# BERUHIGENDE falsche Antwort: "keine Plugins an der Route", "keine Function
# ausgerollt", "Rechte sehen so aus" — entstanden aus einem misslungenen
# Parsen. Genau diese Faelle stehen hier.
#
# KEINE Verbindung nach aussen: `ssh` wird durch eine Attrappe ersetzt.
#
#   bash scripts/test-prod-truth-tooling.sh
#   npm run test:prod-truth

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARBEIT="$(mktemp -d)"
trap 'chmod -R u+rwX "$ARBEIT" 2>/dev/null; rm -rf "$ARBEIT"' EXIT

BESTANDEN=0
GESCHEITERT=0
ok()   { BESTANDEN=$((BESTANDEN+1)); printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { GESCHEITERT=$((GESCHEITERT+1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; [ -n "${2:-}" ] && printf '       %s\n' "$2"; return 0; }
gleich() { if [ "$1" = "$2" ]; then ok "$3"; else fail "$3" "ist '$2', erwartet '$1'"; fi }

# ── Sandkasten ──────────────────────────────────────────────────────────────
# Der Lauf zeigt auf eine KOPIE des Repos: ein Attrappenlauf, der bis zur
# Veroeffentlichung kommt, wuerde sonst einen echten Beleg unter ops/ ablegen.
SANDKASTEN="$ARBEIT/repo"
mkdir -p "$SANDKASTEN/scripts"
cp scripts/capture-production-truth.sh scripts/prod-readonly.sh \
   scripts/baseline-sanitize.py "$SANDKASTEN/scripts/"

# Repo/Konfiguration-Seite des Dreivergleichs: EDGE_LISTE (unten) deployed
# "main" und "send-offer". "send-offer" bekommt hier ein lokales Gegenstueck —
# es darf NICHT in deploy_only landen. "main" bekommt keins — es MUSS in
# deploy_only landen (der `accept-lead`-Fall). Die Konfiguration fuehrt
# "send-offer" UND einen Eintrag ohne Quelle ("orphan-in-config"), aber NICHT
# "main" — das deckt alle vier Mengen ab (deploy_only, repo_only, config_only,
# repo_missing_from_config) in einem Fixture statt vier einzelnen.
mkdir -p "$SANDKASTEN/supabase/functions/send-offer"
echo '// Testquelle' > "$SANDKASTEN/supabase/functions/send-offer/index.ts"
cat > "$SANDKASTEN/supabase/config.toml" <<'EOF'
[functions.send-offer]
enabled = true
verify_jwt = false

[functions.orphan-in-config]
enabled = true
verify_jwt = false
EOF

# ── ssh-Attrappe ────────────────────────────────────────────────────────────
# Sie antwortet vollstaendig genug, dass der Lauf bis zur Veroeffentlichung
# kommt — nur so lassen sich Drift, Parse-Fehler und Sanitizer ueberhaupt
# pruefen. Unterschieden wird an ARGV (docker) und an der SQL auf stdin.
mkdir -p "$ARBEIT/bin"
cat > "$ARBEIT/bin/ssh" <<'STUBEOF'
#!/usr/bin/env bash
eingabe="$(cat)"
{ echo "--- AUFRUF ---"
  for a in "$@"; do echo "ARG: $a"; done
  echo "--- STDIN ---"; printf '%s\n' "$eingabe"; } >> "$SSH_LOG"

zdatei="${SSH_LOG}.zaehler"
runde() { local k="$1" n; n=$(( $(grep -c "^$k\$" "$zdatei" 2>/dev/null) + 1 )); echo "$k" >> "$zdatei"; echo "$n"; }

# ── Laufzeitseite (ARGV) ───────────────────────────────────────────────────
case "$*" in
  *'.Config.Cmd'*)
      echo "${STUB_EDGE_CMD:-[\"start\",\"--main-service\",\"/home/deno/functions/main\"]}"; exit 0 ;;
  *VERIFY_JWT*)
      echo "${STUB_VERIFY_JWT:-false}"; exit 0 ;;
  *KONG_DECLARATIVE_CONFIG*)
      echo "${STUB_KONG_CONF:-/usr/local/kong/kong.yml}"; exit 0 ;;
  *'sha256sum'*'kong'*|*'sha256sum'*'.yml'*)
      echo "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; exit 0 ;;
  *'grep -A 8'*)
      if [ "${STUB_KONG_KAPUTT:-}" = "1" ]; then
        printf '          - /functions/v1/\n    routes:\n'          # kein plugins-Block
      elif [ "${STUB_KONG_LEER:-}" = "1" ]; then
        printf ''                                                    # gar kein Treffer
      else
        printf '          - /functions/v1/\n    plugins:\n      - name: cors\n\n'
      fi
      exit 0 ;;
  *"sh -c 'cd"*)
      if [ "${STUB_EDGE_LEER:-}" = "1" ]; then printf ''; else
        printf 'main|%064d|%064d|1\nsend-offer|%064d|%064d|3\n' 1 2 3 4
        # Verzeichnis ohne eigenes index.ts — der reale `_shared`-Fall. Muss in
        # KEINER der Dreivergleich-Mengen auftauchen, weder als deploy_only
        # noch sonstwo: es ist keine Function, in keiner der drei Quellen.
        printf '_shared|-|%064d|44\n' 7
        # Ein Name mit einem Zeichen ausserhalb der Positivliste des Erzeugers.
        # Er muss VOR jeder Verwendung in einem zusammengesetzten Fernbefehl
        # abgewiesen werden — nicht erst, wenn er dort landet.
        if [ "${STUB_EDGE_WEIRD_NAME:-}" = "1" ]; then
          printf 'evil;rm|%064d|%064d|1\n' 5 6
        fi
      fi
      exit 0 ;;
  *'test -f'*)
      if [ "${STUB_DEPLOY_SOURCE_SECRET:-}" = "1" ]; then
        printf "// residue\nconst t = 'Bearer eyJhbGciOiJIUzI1NiJ9.x';\n"
      elif [ "${STUB_DEPLOY_SOURCE_LEER:-}" = "1" ]; then
        printf ''
      else
        printf '// residue source for a deploy-only function\n'
      fi
      exit 0 ;;
esac

# ── Datenbank (SQL auf stdin) ──────────────────────────────────────────────
case "$eingabe" in
  *pg_control_system*)          echo "${STUB_SYSID:-1234567890123456789}" ;;
  *current_database*)           echo "${STUB_GESTALT:-postgres|15.8|7}" ;;
  *'md5(concat_ws'*)
      if [ "${STUB_AUTHZ_DRIFT:-}" = "1" ] && [ "$(runde authz)" -ge 2 ]; then
        echo "ffffffffffffffffffffffffffffffff"
      else echo "0123456789abcdef0123456789abcdef"; fi ;;
  *body_matches_write_keyword*)
      echo '[{"signature":"public.f()","name":"f","security_definer":true,"owner":"postgres","volatility":"v","anon_execute":true,"authenticated_execute":true,"service_role_execute":true,"acl":"","body_matches_write_keyword":true,"definition_md5":"0"}]' ;;
  *'json_agg(t ORDER BY t.table_name)'*)
      echo '[{"table_name":"companies","rls_enabled":true,"rls_forced":false,"owner":"postgres","policy_count":3}]' ;;
  *'t.table_name, t.policy_name'*)
      echo '[{"table_name":"companies","policy_name":"p","cmd":"SELECT","permissive":"PERMISSIVE","roles":"{authenticated}","qual_md5":"0","with_check_md5":"0","qual_absent":false,"with_check_absent":true,"qual_unrestricted":false,"with_check_unrestricted":false,"references_auth_uid":true,"references_company_scope":true,"contains_contact_literal":false}]' ;;
  *definition_sha256*)
      echo '[{"schema_name":"public","signature":"public.execute_sql(text,boolean)","security_definer":false,"owner":"postgres","anon_execute":false,"authenticated_execute":false,"service_role_execute":true,"acl":"{postgres=X/postgres}","definition_length":10,"definition_sha256":"ab"}]' ;;
  *"E'\n\n'"*|*'string_agg(pg_get_functiondef'*)
      if [ "${STUB_GEHEIMNIS:-}" = "1" ]; then
        echo "CREATE FUNCTION public.execute_sql() AS \$\$ SELECT 'Bearer eyJhbGciOiJIUzI1NiJ9.x'; \$\$;"
      else
        echo "CREATE FUNCTION public.execute_sql(query text, read_only boolean) RETURNS json AS \$\$ BEGIN RETURN NULL; END; \$\$;"
      fi ;;
  *"to_regclass('cron.job')"*)   echo "${STUB_JOBS_DA:-true}" ;;
  *functions_with_outward_literal*)
      echo '{"scheduled_jobs_readable":true,"functions_with_outward_literal":[],"scheduled_jobs":[{"job_id":1,"job_name":"reminder","schedule":"*/5 * * * *","active":true,"command_has_jwt_like_value":false,"command_has_legacy_cloud_url":false,"command_md5":"0","command_length":10}]}' ;;
  *"to_regclass('public."*)      echo "${STUB_PORTAL_DA:-true}" ;;
  *'count(*)::text FROM public.'*) echo "0" ;;
  *)                             echo "0" ;;
esac
exit 0
STUBEOF
chmod +x "$ARBEIT/bin/ssh"

ZIEL_FP="$(printf '%s|%s|%s' root@example.test db-attrappe 1234567890123456789 | sha256sum | cut -d' ' -f1)"

LETZTE_AUSGABE=""
LETZTER_RC=""
# Setzt LETZTE_AUSGABE und LETZTER_RC und gibt NICHTS aus: `rc="$(lauf …)"`
# liefe in einer Subshell, und LETZTE_AUSGABE kaeme beim Aufrufer nie an —
# jede Pruefung "… steht NICHT in der Meldung" waere dann ohne Pruefgegenstand.
lauf() {
  : > "$ARBEIT/ssh.log"; : > "$ARBEIT/ssh.log.zaehler"
  LETZTE_AUSGABE="$(env PATH="$ARBEIT/bin:$PATH" SSH_LOG="$ARBEIT/ssh.log" \
      CRM_PROD_SSH=root@example.test \
      CRM_PROD_DB_CONTAINER=db-attrappe \
      CRM_PROD_EDGE_CONTAINER=edge-attrappe \
      CRM_PROD_KONG_CONTAINER=kong-attrappe \
      CRM_PROD_SYSTEM_IDENTIFIER=1234567890123456789 \
      CRM_PROD_READ_CONFIRM="$ZIEL_FP" \
      "$@" bash "$SANDKASTEN/scripts/capture-production-truth.sh" 2>&1)"
  LETZTER_RC=$?
}

aufrufe() { grep -c '^--- AUFRUF ---' "$ARBEIT/ssh.log" 2>/dev/null || echo 0; }
belege()  { ls -1 "$SANDKASTEN/ops/production-truth" 2>/dev/null | grep -v '^\.stage\.' | wc -l; }

keine_verbindung() {  # $1 = Beschreibung, Rest = env-Ueberschreibungen
  local was="$1"; shift
  lauf "$@"
  if [ "$LETZTER_RC" = "0" ]; then fail "$was" "rc=0, aber Abbruch erwartet"
  elif [ -s "$ARBEIT/ssh.log" ]; then fail "$was" "$(aufrufe) ssh-Aufrufe"
  else ok "$was (rc=$LETZTER_RC, 0 ssh-Aufrufe)"; fi
}

echo "── Ziel und Bestaetigung: kein Verbindungsaufbau ──────────────────────"
keine_verbindung "falsche Bestaetigung" CRM_PROD_READ_CONFIRM=falsch
keine_verbindung "Bestaetigung fuer fremdes Ziel" \
  CRM_PROD_READ_CONFIRM="$(printf '%s|%s|%s' root@anders.test db-attrappe 1234567890123456789 | sha256sum | cut -d' ' -f1)"
keine_verbindung "nicht-numerische Cluster-Kennung" CRM_PROD_SYSTEM_IDENTIFIER=abc
keine_verbindung "Edge-Container mit fuehrendem Bindestrich" CRM_PROD_EDGE_CONTAINER=-v/:/x
keine_verbindung "Kong-Container mit fuehrendem Bindestrich" CRM_PROD_KONG_CONTAINER=-v/:/x
keine_verbindung "leerer Kong-Container" CRM_PROD_KONG_CONTAINER=

echo
echo "── Identitaet ─────────────────────────────────────────────────────────"
lauf STUB_SYSID=999888777666555444
[ "$LETZTER_RC" != "0" ] && ok "falsche Cluster-Kennung: Abbruch (rc=$LETZTER_RC)" || fail "falsche Cluster-Kennung"
gleich 1 "$(aufrufe)" "falsche Kennung: genau eine Abfrage, dann Schluss"
case "$LETZTE_AUSGABE" in
  *999888777666555444*|*1234567890123456789*) fail "Kennung erscheint nicht in der Meldung" ;;
  *) ok "Kennung erscheint nicht in der Meldung" ;;
esac
gleich 0 "$(belege)" "falsche Kennung: nichts veroeffentlicht"

lauf STUB_GESTALT="postgres|15.8|3"
[ "$LETZTER_RC" != "0" ] && ok "zu wenige Kerntabellen: Abbruch" || fail "zu wenige Kerntabellen"
gleich 0 "$(belege)" "falsche Gestalt: nichts veroeffentlicht"

echo
echo "── Beruhigende falsche Antworten muessen Abbrueche sein ───────────────"
# Der Kern dieser Datei. Jeder dieser Faelle koennte eine Antwort liefern, die
# harmlos aussieht — und genau deshalb darf keiner davon eine liefern.
lauf STUB_KONG_KAPUTT=1
[ "$LETZTER_RC" != "0" ] && ok "Kong-Block ohne plugins: Abbruch statt 'keine Plugins'" || fail "Kong-Block ohne plugins"
gleich 0 "$(belege)" "Kong-Block kaputt: nichts veroeffentlicht"

lauf STUB_KONG_LEER=1
[ "$LETZTER_RC" != "0" ] && ok "Kong-Route nicht gefunden: Abbruch" || fail "Kong-Route nicht gefunden"

lauf STUB_EDGE_LEER=1
[ "$LETZTER_RC" != "0" ] && ok "leere Function-Liste: Abbruch statt 'nichts ausgerollt'" || fail "leere Function-Liste"
gleich 0 "$(belege)" "leere Function-Liste: nichts veroeffentlicht"

lauf STUB_EDGE_CMD='["start"]'
[ "$LETZTER_RC" != "0" ] && ok "kein --main-service: Abbruch statt geratener Wurzel" || fail "kein --main-service"

lauf STUB_EDGE_CMD='["start","--main-service","main"]'
[ "$LETZTER_RC" != "0" ] && ok "unplausible Function-Wurzel: Abbruch" || fail "unplausible Function-Wurzel"

# Der Fall, der die erste Fassung dieses Werkzeugs falsch berichten liess:
# `(x IS NOT NULL)::text` liefert 'true'/'false', psql zeigt fuer eine
# boolean-SPALTE aber 't'/'f'. Wer gegen 't' vergleicht, bekommt fuer alles
# "nein" — und der Beleg behauptet dann, es gebe weder geplante Jobs noch
# Portal-Tabellen. Ein unerwarteter Wert muss deshalb abbrechen, nicht "nein"
# bedeuten. Die Attrappe hat hier frueher 't' geliefert und den Fehler mitgetragen.
lauf STUB_JOBS_DA=t
[ "$LETZTER_RC" != "0" ] && ok "Ja/Nein-Sonde liefert 't': Abbruch statt stiller Fehlmeldung" || fail "Ja/Nein-Sonde 't'"
lauf STUB_PORTAL_DA=f
[ "$LETZTER_RC" != "0" ] && ok "Portal-Sonde liefert 'f': Abbruch statt 'Tabelle fehlt'" || fail "Portal-Sonde 'f'"
gleich 0 "$(belege)" "unklare Sonde: nichts veroeffentlicht"

# Ein deploy-only-Name mit einem Zeichen ausserhalb der Positivliste. Der
# Erzeuger baut daraus einen zusammengesetzten Fernbefehl (ssh → docker exec →
# sh -c) — ungeprueft waere das eine Einschleusung. Muss VOR jedem Zugriff
# darauf abbrechen, nicht erst beim Sanitizer. Anders als bei Kennung/Fund: ein
# Verzeichnisname ist kein Geheimnis, sondern die Diagnose, die der Betreiber
# braucht — er darf und soll in der Meldung stehen.
lauf STUB_EDGE_WEIRD_NAME=1
[ "$LETZTER_RC" != "0" ] && ok "unplausibler deploy-only-Name: Abbruch vor Verwendung" || fail "unplausibler deploy-only-Name"
gleich 0 "$(belege)" "unplausibler Name: nichts veroeffentlicht"
case "$LETZTE_AUSGABE" in
  *'evil;rm'*) ok "die Meldung nennt den beanstandeten Namen" ;;
  *) fail "die Meldung nennt den beanstandeten Namen nicht" ;;
esac

echo
echo "── Drift waehrend der Aufnahme ────────────────────────────────────────"
lauf STUB_AUTHZ_DRIFT=1
[ "$LETZTER_RC" != "0" ] && ok "Rechte-/Policy-Drift: Abbruch" || fail "Rechte-/Policy-Drift"
gleich 0 "$(belege)" "Drift: nichts veroeffentlicht"

# Der Identitaetswechsel am Ende der Aufnahme wird hier NICHT noch einmal
# geprueft: er steckt in prod_recheck_identity, und den prueft
# test-baseline-tooling.sh bereits an derselben Funktion. Ein zweiter Pruefort
# fuer dieselbe Zeile waere eine zweite Meinung darueber, was sie tut.

echo
echo "── Sanitizer ──────────────────────────────────────────────────────────"
lauf STUB_GEHEIMNIS=1
[ "$LETZTER_RC" != "0" ] && ok "Geheimnis im aufgenommenen Rumpf: Abbruch" || fail "Geheimnis im Rumpf"
gleich 0 "$(belege)" "Geheimnis: nichts veroeffentlicht"
case "$LETZTE_AUSGABE" in
  *eyJhbGciOiJIUzI1NiJ9*) fail "der Fund selbst steht in der Meldung" ;;
  *) ok "der Fund selbst steht NICHT in der Meldung" ;;
esac

# Derselbe Fund, aber im Quelltext einer deploy-only Funktion (accept-lead-
# Fall). Anders als ueberall sonst: unaudited toter Code ist GENAU der Code,
# der am ehesten ein Geheimnis im Klartext traegt — ein Treffer darf deshalb
# nicht die gesamte Aufnahme verwerfen, sondern nur den einen Eintrag
# redigieren. Die Aufnahme muss trotzdem erfolgreich veroeffentlicht werden.
vorher_zustand_secret="$(belege)"
lauf STUB_DEPLOY_SOURCE_SECRET=1
gleich 0 "$LETZTER_RC" "Geheimnis in deploy-only-Quelle: Aufnahme laeuft trotzdem durch"
case "$LETZTE_AUSGABE" in
  *eyJhbGciOiJIUzI1NiJ9*) fail "der Fund (deploy-only) steht in der Meldung" ;;
  *) ok "der Fund (deploy-only) steht NICHT in der Meldung" ;;
esac
BELEG_SECRET="$SANDKASTEN/ops/production-truth/$(date +%F)"
if [ -f "$BELEG_SECRET/deploy-only-sources.json" ]; then
  if grep -q "eyJhbGciOiJIUzI1NiJ9" "$BELEG_SECRET/deploy-only-sources.json"; then
    fail "der Fund (deploy-only) steht im veroeffentlichten Artefakt"
  else
    ok "der Fund (deploy-only) steht NICHT im veroeffentlichten Artefakt"
  fi
  python3 -c "
import json, sys
d = json.load(open('$BELEG_SECRET/deploy-only-sources.json'))
eintrag = d.get('main')
if eintrag is None or eintrag.get('redacted') is not True or eintrag.get('source') is not None:
    sys.exit('main ist nicht als redigiert markiert: %r' % eintrag)
if not eintrag.get('redaction_reason'):
    sys.exit('redaction_reason fehlt')
" && ok "'main' ist redigiert markiert (source=null, Grund gefuehrt)" \
  || fail "'main' ist nicht korrekt redigiert markiert"
else
  fail "deploy-only-sources.json wurde nicht veroeffentlicht"
fi
# Aufraeumen fuer den naechsten "zweiter Lauf"-Block: dieser Lauf hat bereits
# eine Aufnahme veroeffentlicht, die spaeteren Tests erwarten den Zustand davor.
rm -rf "$SANDKASTEN/ops/production-truth"

echo
echo "── Vollstaendiger Lauf ────────────────────────────────────────────────"
lauf
gleich 0 "$LETZTER_RC" "vollstaendiger Attrappenlauf laeuft durch"
gleich 1 "$(belege)" "genau ein Beleg veroeffentlicht"

BELEG="$SANDKASTEN/ops/production-truth/$(date +%F)"
gleich 0 "$(grep '^ARG: docker exec -i' "$ARBEIT/ssh.log" | grep -vc "PGOPTIONS='-c default_transaction_read_only=on'")" \
  "JEDER Datenbank-Fernbefehl traegt read-only PGOPTIONS"
gleich 0 "$(grep -c '^ARG: .*docker \(run\|start\|stop\|restart\|rm\|cp\)' "$ARBEIT/ssh.log")" \
  "kein veraendernder docker-Befehl"

python3 - "$BELEG" <<'PY'
import hashlib, json, os, sys
beleg = sys.argv[1]
erwartet = {"edge-runtime.json", "function-authz.json", "table-authz.json",
            "policies.json", "execute-sql.json", "execute-sql-definition.sql",
            "remnants.json", "portal-usage.json", "deploy-repo-diff.json",
            "deploy-only-sources.json", "capture-manifest.json"}
ist = set(os.listdir(beleg))
if ist != erwartet:
    raise SystemExit("Artefaktmenge weicht ab: fehlt %s / unerwartet %s"
                     % (sorted(erwartet - ist), sorted(ist - erwartet)))

manifest = json.load(open(os.path.join(beleg, "capture-manifest.json")))
hashes = manifest["artifacts"]
if set(hashes) != erwartet - {"capture-manifest.json"}:
    raise SystemExit("Manifest fuehrt eine andere Artefaktmenge als das Verzeichnis.")
for name, soll in hashes.items():
    ist_hash = hashlib.sha256(open(os.path.join(beleg, name), "rb").read()).hexdigest()
    if ist_hash != soll:
        raise SystemExit("%s: SHA-256 passt nicht zum Manifest." % name)
soll_gen = hashlib.sha256("".join(hashes[k] for k in sorted(hashes)).encode()).hexdigest()[:16]
if manifest["generation"] != soll_gen:
    raise SystemExit("generation ist eine Beschriftung, kein Beleg.")

reste = json.load(open(os.path.join(beleg, "remnants.json")))
if reste["scheduled_jobs_readable"] is not True or len(reste["scheduled_jobs"]) != 1:
    raise SystemExit("geplante Jobs falsch gelesen: %r" % reste["scheduled_jobs_readable"])
portal = json.load(open(os.path.join(beleg, "portal-usage.json")))
if not all(t["present"] for t in portal.values()):
    raise SystemExit("Portal-Tabellen faelschlich als abwesend gemeldet.")

edge = json.load(open(os.path.join(beleg, "edge-runtime.json")))
if edge["gateway"]["functions_route_plugins"] != ["cors"]:
    raise SystemExit("Kong-Plugins falsch gelesen: %r" % edge["gateway"]["functions_route_plugins"])
if edge["edge_runtime"]["deployed_function_count"] != 3:
    raise SystemExit("Function-Zahl falsch gelesen (main, send-offer, _shared).")

# Dreivergleich: "send-offer" hat ein lokales Gegenstueck (Repo UND Konfig),
# "main" hat keins in keinem der beiden — genau der accept-lead-Fall.
# "_shared" (kein eigenes index.ts) darf in KEINER Menge auftauchen — es ist
# keine Function, sondern deployed-runtime-Beiwerk (der reale Fall aus der
# ersten echten Aufnahme: `_shared` erschien faelschlich als "deploy-only",
# bis die Dreivergleich-Mengen auf index.ts-tragende Verzeichnisse begrenzt
# wurden).
diff = json.load(open(os.path.join(beleg, "deploy-repo-diff.json")))
if diff["deploy_only"] != ["main"]:
    raise SystemExit("deploy_only falsch: %r (erwartet ['main'], _shared muss fehlen)" % diff["deploy_only"])
alle_mengen = (diff["repo_functions"] + diff["config_functions"] + diff["deployed_functions"]
              + diff["deploy_only"] + diff["repo_only"] + diff["config_only_missing_from_repo"]
              + diff["repo_missing_from_config"])
if "_shared" in alle_mengen:
    raise SystemExit("_shared taucht im Dreivergleich auf — es ist keine Function.")
if diff["repo_only"] != []:
    raise SystemExit("repo_only falsch: %r (erwartet [])" % diff["repo_only"])
if diff["config_only_missing_from_repo"] != ["orphan-in-config"]:
    raise SystemExit("config_only_missing_from_repo falsch: %r" % diff["config_only_missing_from_repo"])
if diff["repo_missing_from_config"] != []:
    raise SystemExit("repo_missing_from_config falsch: %r (erwartet [], send-offer ist konfiguriert)"
                     % diff["repo_missing_from_config"])

# Quelltext: NUR fuer deploy_only ("main"), NICHT fuer "send-offer" (das hat
# ein Repo-Gegenstueck und gehoert nicht hierher).
quellen = json.load(open(os.path.join(beleg, "deploy-only-sources.json")))
if set(quellen) != {"main"}:
    raise SystemExit("deploy-only-sources.json fuehrt die falschen Namen: %r" % sorted(quellen))
eintrag = quellen["main"]
if eintrag["redacted"] is not False or not eintrag["source"] or "residue source" not in eintrag["source"]:
    raise SystemExit("deploy-only-sources.json: Quelltext von 'main' fehlt oder ist falsch: %r" % eintrag)

print("STRUKTUR-OK")
PY
if [ $? -eq 0 ]; then ok "Beleg: Artefaktmenge, Hashes, Generation und gelesene Werte stimmen"
else fail "Beleg: Struktur"; fi

# Zweiter Lauf am selben Tag: ein Beleg wird nicht stillschweigend ersetzt.
VORHER="$(sha256sum "$BELEG/capture-manifest.json" | cut -d' ' -f1)"
lauf
[ "$LETZTER_RC" != "0" ] && ok "zweiter Lauf am selben Tag: Abbruch statt stiller Ersetzung" || fail "zweiter Lauf"
gleich "$VORHER" "$(sha256sum "$BELEG/capture-manifest.json" | cut -d' ' -f1)" "der vorhandene Beleg blieb unveraendert"
lauf CRM_TRUTH_REPLACE=1
gleich 0 "$LETZTER_RC" "mit CRM_TRUTH_REPLACE=1 laeuft der Ersatz durch"

echo
printf 'bestanden %d, gescheitert %d\n' "$BESTANDEN" "$GESCHEITERT"
[ "$GESCHEITERT" -eq 0 ]
