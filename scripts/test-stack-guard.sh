#!/usr/bin/env bash
# Tests fuer den Loopback-Waechter, den Start/Stop-Wrapper und die beiden
# zerstoerenden Verbraucher
# (scripts/docker-loopback.sh, scripts/supabase-stack.sh, scripts/test-db.sh,
#  scripts/wiki-db.sh).
#
# KEIN echter Docker, KEIN echtes Supabase. Beide werden ueber PATH durch
# Attrappen ersetzt. Die Attrappen sind ERLAUBNISLISTEN: sie kennen genau die
# Aufrufformen, die diese Werkzeuge benutzen duerfen, und beantworten alles
# andere mit rc=99. Ein unerwarteter Aufruf ist damit ein Testfehler und keine
# stille Annahme — vorher haette ein neu hinzugefuegtes `docker rm` einfach
# funktioniert und niemandem etwas gesagt.
#
# Es wird nichts gestartet, nichts gestoppt und kein Netz angelegt.
#
#   bash scripts/test-stack-guard.sh
#   npm run test:stack-guard

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARBEIT="$(mktemp -d)"
trap 'rm -rf "$ARBEIT"' EXIT

BESTANDEN=0
GESCHEITERT=0
ok()   { BESTANDEN=$((BESTANDEN+1)); printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { GESCHEITERT=$((GESCHEITERT+1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; [ -n "${2:-}" ] && printf '       %s\n' "$2"; return 0; }

# Diese Funktion fehlte, und der Aufruf `gleich 1 …` fiel deshalb wortlos als
# "command not found" durch: die Zusicherung wurde nie ausgewertet und zaehlte
# in keiner Richtung. Ein Test, den niemand ausfuehrt, ist kein Test.
gleich() {  # <soll> <ist> <beschreibung>
  if [ "$1" = "$2" ]; then ok "$3"; else fail "$3" "ist '$2', erwartet '$1'"; fi
}

# Und damit sich das nicht wiederholt: alles, was diese Suite als
# Zusicherungswerkzeug benutzt, muss zu Beginn wirklich definiert sein.
selbstpruefung() {
  local f fehlend=""
  for f in ok fail gleich pruefe_denied log_enthaelt kein_unerlaubter_aufruf \
           wrapper helfer verbraucher zuruecksetzen netz_zustand container_setzen \
           gesund_test gesund_wiki mutation; do
    declare -F "$f" >/dev/null 2>&1 || fehlend="$fehlend $f"
  done
  if [ -n "$fehlend" ]; then fail "alle Zusicherungswerkzeuge sind definiert" "fehlt:$fehlend"
  else ok "alle Zusicherungswerkzeuge sind definiert"; fi
}

STUB_DIR="$ARBEIT/stubs"
STATE_DIR="$ARBEIT/state"
mkdir -p "$STUB_DIR" "$STATE_DIR"

# ── Attrappen: strenge Erlaubnisliste, sonst rc=99 UND ein DENIED-Eintrag ───
# Jede nicht exakt erwartete Aufrufform wird abgelehnt und DAUERHAFT vermerkt
# ($ARBEIT/DENIED ueberlebt jedes zuruecksetzen). Nach jedem Testfall wird
# geprueft, dass dieser Vermerk leer ist — sonst koennte ein negativer Testfall
# gruen werden, WEIL die Attrappe rc=99 lieferte, und nicht, weil der Waechter
# richtig entschieden hat.
cat > "$STUB_DIR/docker" <<'STUB'
#!/usr/bin/env bash
{ printf 'docker'; for a in "$@"; do printf ' %s' "$a"; done; printf '\n'; } >> "$STUB_LOG"
unbekannt() { { printf 'docker'; for a in "$@"; do printf ' %s' "$a"; done; printf '\n'; } >> "$DENIED_LOG"
              echo "docker-Attrappe: nicht erlaubter Aufruf: $*" >&2; exit 99; }

case "${1:-}" in
  version)
    [ $# -eq 3 ] && [ "$2" = "--format" ] && [ "$3" = '{{.Server.Version}}' ] || unbekannt "$@"
    [ -f "$STATE_DIR/engine-fehlt" ] && exit 1
    cat "$STATE_DIR/engine" 2>/dev/null || echo "28.1.0" ;;

  network)
    case "${2:-}" in
      inspect)
        [ $# -eq 3 ] || unbekannt "$@"
        datei="$STATE_DIR/net-$3"
        [ -f "$datei" ] || { echo "Error: No such network: $3" >&2; exit 1; }
        cat "$datei" ;;
      create)
        # Argumentzahl, Reihenfolge, Treiber, Optionswert, BEIDE Label und der
        # Netzname — alles buchstabengetreu. Jede Abweichung ist ein DENIED.
        [ $# -eq 11 ] || unbekannt "$@"
        [ "$3" = "--driver" ] || unbekannt "$@"
        [ "$4" = "bridge" ]   || unbekannt "$@"
        [ "$5" = "--opt" ]    || unbekannt "$@"
        [ "$6" = "com.docker.network.bridge.host_binding_ipv4=127.0.0.1" ] || unbekannt "$@"
        [ "$7" = "--label" ]  || unbekannt "$@"
        [ "$8" = "crm.repo=crm-project" ] || unbekannt "$@"
        [ "$9" = "--label" ]  || unbekannt "$@"
        case "${10}" in
          crm.purpose=crm-test-stack|crm.purpose=crm-wiki-stack) : ;;
          *) unbekannt "$@" ;;
        esac
        name="${11}"
        case "$name" in
          crm-test-loopback|crm-wiki-loopback) : ;;
          *) unbekannt "$@" ;;
        esac
        # Zweck und Netzname muessen zueinander passen.
        case "${10}-${name}" in
          crm.purpose=crm-test-stack-crm-test-loopback|crm.purpose=crm-wiki-stack-crm-wiki-loopback) : ;;
          *) unbekannt "$@" ;;
        esac
        [ -f "$STATE_DIR/net-nach-create-$name" ] && cp "$STATE_DIR/net-nach-create-$name" "$STATE_DIR/net-$name"
        [ -f "$STATE_DIR/create-schlaegt-fehl" ] && exit 1
        echo "$name" ;;
      *) unbekannt "$@" ;;
    esac ;;

  ps)
    # Zwei erlaubte Formen: die Projekt-Bestandsaufnahme (mit Filter) und das
    # Namensinventar des ganzen Rechners (ohne Filter).
    if [ $# -eq 4 ] && [ "$2" = "-a" ] && [ "$3" = "--format" ] && [ "$4" = '{{.Names}}' ]; then
      [ -f "$STATE_DIR/namen-schlagen-fehl" ] && { echo "Cannot connect to the Docker daemon" >&2; exit 1; }
      cat "$STATE_DIR/all-names" 2>/dev/null || true
      exit 0
    fi
    [ $# -eq 6 ] || unbekannt "$@"
    [ "$2" = "-a" ] && [ "$3" = "--filter" ] && [ "$5" = "--format" ] || unbekannt "$@"
    [ "$6" = '{{.ID}} {{.Names}}' ] || unbekannt "$@"
    projekt="${4#label=com.supabase.cli.project=}"
    [ "$projekt" != "$4" ] || unbekannt "$@"
    case "$projekt" in crm-test|crm-wiki) : ;; *) unbekannt "$@" ;; esac
    [ -f "$STATE_DIR/ps-schlaegt-fehl" ] && { echo "Cannot connect to the Docker daemon" >&2; exit 1; }
    cat "$STATE_DIR/inv-$projekt" 2>/dev/null || true ;;

  inspect)
    if [ "${2:-}" = "-f" ]; then
      [ $# -eq 4 ] || unbekannt "$@"
      ref="$4"
      case "$3" in
        '{{.State.Running}}')
          [ -f "$STATE_DIR/state-schlaegt-fehl" ] && { echo "Cannot connect" >&2; exit 1; }
          datei="$STATE_DIR/running-$(cat "$STATE_DIR/name-$ref" 2>/dev/null || echo "$ref")"
          [ -f "$datei" ] || { echo "Error: No such object: $ref" >&2; exit 1; }
          cat "$datei" ;;
        '{{ index .Config.Labels "com.supabase.cli.project" }}')
          datei="$STATE_DIR/label-$(cat "$STATE_DIR/name-$ref" 2>/dev/null || echo "$ref")"
          [ -f "$datei" ] || { echo "Error: No such object: $ref" >&2; exit 1; }
          cat "$datei" ;;
        *) unbekannt "$@" ;;
      esac
      exit 0
    fi
    [ $# -eq 2 ] || unbekannt "$@"
    ref="$2"
    if [ -f "$STATE_DIR/term-bei-nachpruefung" ] && [ -f "$STATE_DIR/start-gelaufen" ]; then
      rm -f "$STATE_DIR/term-bei-nachpruefung"
      kill -TERM "$(cat "$STATE_DIR/wrapper-pid")" 2>/dev/null || true
    fi
    datei="$STATE_DIR/c-$(cat "$STATE_DIR/name-$ref" 2>/dev/null || echo "$ref")"
    [ -f "$datei" ] || { echo "Error: No such object: $ref" >&2; exit 1; }
    cat "$datei" ;;

  exec)
    # Erlaubt, damit ein Verbraucher nach bestandener Pruefung kontrolliert
    # scheitert statt einen DENIED-Eintrag zu hinterlassen. Der Aufruf wird
    # protokolliert (die Tests zaehlen ihn) und liefert IMMER einen Fehler —
    # unter Attrappen gibt es kein psql.
    echo "docker-Attrappe: kein psql unter Attrappen" >&2
    exit 1 ;;

  *) unbekannt "$@" ;;
esac
STUB

cat > "$STUB_DIR/supabase" <<'STUB'
#!/usr/bin/env bash
{ printf 'supabase'; for a in "$@"; do printf ' %s' "$a"; done; printf '\n'; } >> "$STUB_LOG"
unbekannt() { { printf 'supabase'; for a in "$@"; do printf ' %s' "$a"; done; printf '\n'; } >> "$DENIED_LOG"
              echo "supabase-Attrappe: nicht erlaubter Aufruf: $*" >&2; exit 99; }

if [ "${1:-}" = "start" ] && [ "${2:-}" = "--help" ] && [ $# -eq 2 ]; then
  echo "Usage: supabase start [flags]"
  [ "${STUB_OHNE_NETWORK_ID:-}" = "1" ] || echo "      --network-id string   Use the provided ID as the network ID"
  exit 0
fi

[ "${1:-}" = "--workdir" ] || unbekannt "$@"
workdir="$2"
case "$workdir" in supabase-test/runtime|supabase-wiki/runtime) : ;; *) unbekannt "$@" ;; esac
case "${3:-}" in
  status)
    [ $# -eq 5 ] && [ "$4" = "-o" ] && [ "$5" = "env" ] || unbekannt "$@"
    cat "$STATE_DIR/status-env" 2>/dev/null
    exit "$(cat "$STATE_DIR/status-rc" 2>/dev/null || echo 0)" ;;
  start)
    [ $# -eq 5 ] || unbekannt "$@"
    [ "$4" = "--network-id" ] || unbekannt "$@"
    # Arbeitsverzeichnis und Netz muessen zueinander passen.
    case "$workdir-$5" in
      supabase-test/runtime-crm-test-loopback|supabase-wiki/runtime-crm-wiki-loopback) : ;;
      *) unbekannt "$@" ;;
    esac
    touch "$STATE_DIR/start-gelaufen"
    [ -d "$STATE_DIR/nach-start" ] && cp -a "$STATE_DIR/nach-start/." "$STATE_DIR/"
    exit "$(cat "$STATE_DIR/start-rc" 2>/dev/null || echo 0)" ;;
  stop)
    [ $# -eq 3 ] || unbekannt "$@"
    if [ ! -f "$STATE_DIR/stop-wirkungslos" ]; then
      if [ -f "$STATE_DIR/stop-laesst-reste" ]; then
        # Container bleiben, aber gestoppt — und zwar konsistent in BEIDEN
        # Sichten: `inspect -f {{.State.Running}}` und dem vollen Inspect-JSON.
        for r in "$STATE_DIR"/running-*; do [ -f "$r" ] && echo "false" > "$r"; done
        for c in "$STATE_DIR"/c-*; do [ -f "$c" ] && sed -i 's/"Running": true/"Running": false/' "$c"; done
      else
        rm -f "$STATE_DIR"/c-* "$STATE_DIR"/label-* "$STATE_DIR"/inv-* "$STATE_DIR"/running-* "$STATE_DIR"/name-* "$STATE_DIR"/all-names 2>/dev/null || true
      fi
    fi
    exit "$(cat "$STATE_DIR/stop-rc" 2>/dev/null || echo 0)" ;;
  *) unbekannt "$@" ;;
esac
STUB

chmod +x "$STUB_DIR/docker" "$STUB_DIR/supabase"

# ── Zustaende ───────────────────────────────────────────────────────────────
netz_zustand() {  # <datei> <name> <zweck> [<abweichung>]
  python3 - "$1" "$2" "$3" "${4:-ok}" <<'PY'
import json, sys
ziel, name, zweck, art = sys.argv[1:5]
e = {"Name": name, "Driver": "bridge",
     "Options": {"com.docker.network.bridge.host_binding_ipv4": "127.0.0.1"},
     "Labels": {"crm.repo": "crm-project", "crm.purpose": zweck}}
if art == "falscher-treiber":  e["Driver"] = "macvlan"
if art == "falsche-option":    e["Options"]["com.docker.network.bridge.host_binding_ipv4"] = "0.0.0.0"
if art == "keine-option":      e["Options"] = {}
if art == "fremdes-label":     e["Labels"]["crm.repo"] = "ein-anderes-projekt"
if art == "falscher-zweck":    e["Labels"]["crm.purpose"] = "etwas-anderes"
if art == "falscher-name":     e["Name"] = name + "-anders"
if art == "kein-json":
    open(ziel, "w").write("das ist kein json\n"); raise SystemExit(0)
if art == "zwei-eintraege":
    open(ziel, "w").write(json.dumps([e, e])); raise SystemExit(0)
open(ziel, "w").write(json.dumps([e]))
PY
}

# Legt Inspect-JSON, Label-Datei, Running-Datei und Bestandseintrag an — so, wie
# Docker sie zusammen liefern wuerde.
container_setzen() {  # <ziel-dir> <container> <projekt> <port> <hostport> <netz> [<art>]
  local ziel="$1" name="$2" projekt="$3" port="$4" hostport="$5" netz="$6" art="${7:-ok}"
  mkdir -p "$ziel"
  python3 - "$ziel/c-$name" "$name" "$projekt" "$port" "$hostport" "$netz" "$art" <<'PY'
import json, sys
ziel, name, projekt, port, hostport, netz, art = sys.argv[1:8]
bindungen = [{"HostIp": "127.0.0.1", "HostPort": hostport}]
netze  = {netz: {}}
laeuft = True
label  = {"com.supabase.cli.project": projekt}
if art == "wildcard":      bindungen = [{"HostIp": "0.0.0.0", "HostPort": hostport}]
if art == "ipv6-wildcard": bindungen = [{"HostIp": "::", "HostPort": hostport}]
if art == "leerer-host":   bindungen = [{"HostIp": "", "HostPort": hostport}]
if art == "gemischt":      bindungen = [{"HostIp": "127.0.0.1", "HostPort": hostport},
                                        {"HostIp": "0.0.0.0", "HostPort": hostport}]
if art == "falscher-port": bindungen = [{"HostIp": "127.0.0.1", "HostPort": "54322"}]
if art == "zweiter-falscher-port":
    bindungen = [{"HostIp": "127.0.0.1", "HostPort": hostport},
                 {"HostIp": "127.0.0.1", "HostPort": "54322"}]
if art == "keine-bindung": bindungen = None
if art == "leere-bindung": bindungen = []
if art == "fremdes-netz":  netze = {"bridge": {}}
if art == "zusatznetz":    netze = {netz: {}, "bridge": {}}
if art == "gestoppt":      laeuft = False
if art == "fremdes-label": label = {"com.supabase.cli.project": "ein-anderes-projekt"}
if art == "ohne-label":    label = {}
if art == "falscher-name":
    open(ziel, "w").write(json.dumps([{"Name": "/etwas-anderes", "State": {"Running": True},
        "Config": {"Labels": label},
        "NetworkSettings": {"Ports": {port: bindungen}, "Networks": netze}}]))
    raise SystemExit(0)
if art == "kein-json":     open(ziel, "w").write("{ kaputt"); raise SystemExit(0)
if art == "leere-liste":   open(ziel, "w").write("[]"); raise SystemExit(0)
if art == "keine-ports":
    open(ziel, "w").write(json.dumps([{"Name": "/" + name, "State": {"Running": True},
        "Config": {"Labels": label}, "NetworkSettings": {"Networks": netze}}]))
    raise SystemExit(0)
ports = {port: bindungen}
# Ein ZWEITER, zusaetzlich veroeffentlichter Port desselben Containers.
if art == "zweiter-port-wildcard":
    ports["9999/tcp"] = [{"HostIp": "0.0.0.0", "HostPort": "9999"}]
if art == "zweiter-port-loopback":
    ports["9999/tcp"] = [{"HostIp": "127.0.0.1", "HostPort": "9999"}]
# Ein zusaetzlicher Port, der NICHT veroeffentlicht ist: erlaubt, auch strikt.
if art == "zusatzport-null":
    ports["9999/tcp"] = None
# Zweimal exakt dieselbe Bindung auf dem geforderten Port.
if art == "doppelte-bindung":
    ports[port] = [{"HostIp": "127.0.0.1", "HostPort": hostport},
                   {"HostIp": "127.0.0.1", "HostPort": hostport}]
# Nur im Docker-Netz erreichbar: Docker traegt dort `null` ein. Das ist der
# Normalfall fuer auth/rest/storage und muss erlaubt bleiben.
if art == "unveroeffentlicht":
    ports = {port: None}
open(ziel, "w").write(json.dumps([{
    "Name": "/" + name, "State": {"Running": laeuft},
    "Config": {"Labels": label},
    "NetworkSettings": {"Ports": ports, "Networks": netze}}]))
PY
  case "$art" in
    fremdes-label) echo "ein-anderes-projekt" > "$ziel/label-$name" ;;
    ohne-label)    : > "$ziel/label-$name" ;;
    *)             echo "$projekt" > "$ziel/label-$name" ;;
  esac
  case "$art" in
    gestoppt) echo "false" > "$ziel/running-$name" ;;
    *)        echo "true"  > "$ziel/running-$name" ;;
  esac
  # Die Bestandsaufnahme liefert "<ID> <Name>"; die Abbildung ID→Name braucht
  # die Attrappe, um `docker inspect <ID>` beantworten zu koennen.
  echo "$name" > "$ziel/name-id_$name"
  echo "$name" >> "$ziel/all-names"
  case "$art" in
    fremdes-label|ohne-label) : ;;
    *) echo "id_$name $name" >> "$ziel/inv-$projekt" ;;
  esac
}

zuruecksetzen() { rm -rf "$STATE_DIR"; mkdir -p "$STATE_DIR"; : > "$ARBEIT/log"; }

# Der DENIED-Vermerk ueberlebt jedes zuruecksetzen. Nach JEDEM Lauf wird er
# geprueft: ein negativer Testfall darf nicht deshalb gruen sein, weil die
# Attrappe rc=99 geliefert hat.
DENIED_LOG="$ARBEIT/DENIED"
: > "$DENIED_LOG"

# Jede eingefangene Teilprozess-Ausgabe landet zusaetzlich hier. Am Ende wird
# das Ganze auf Shell-Laufzeitfehler durchsucht — "command not found",
# "unbound variable" und Verwandte sind stille Testausfaelle, keine Ergebnisse.
AUSGABEN="$ARBEIT/alle-ausgaben"
: > "$AUSGABEN"
merke_ausgabe() { printf '%s\n' "$1" >> "$AUSGABEN"; }
pruefe_denied() {  # <kontext>
  if [ -s "$DENIED_LOG" ]; then
    fail "unerlaubter Werkzeugaufruf bei: $1" "$(head -2 "$DENIED_LOG")"
    : > "$DENIED_LOG"
    return 1
  fi
}

wrapper() {  # <aktion> <stapel> [env=wert ...]
  local aktion="$1" stapel="$2"; shift 2
  : > "$ARBEIT/log"
  LAUF_AUSGABE="$(env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" STATE_DIR="$STATE_DIR" \
    DENIED_LOG="$DENIED_LOG" "$@" bash "$ROOT/scripts/supabase-stack.sh" "$aktion" "$stapel" 2>&1)"
  LAUF_RC=$?
  merke_ausgabe "${LAUF_AUSGABE:-}${HELFER_AUSGABE:-}"; pruefe_denied "wrapper $aktion $stapel"
}

helfer() {  # <funktion mit argumenten...>
  : > "$ARBEIT/log"
  HELFER_AUSGABE="$(env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" STATE_DIR="$STATE_DIR" \
    DENIED_LOG="$DENIED_LOG" bash -c '. scripts/docker-loopback.sh; "$@"' _ "$@" 2>&1)"
  HELFER_RC=$?
  merke_ausgabe "${LAUF_AUSGABE:-}${HELFER_AUSGABE:-}"; pruefe_denied "helfer $1"
}

log_enthaelt() { grep -qF -- "$1" "$ARBEIT/log"; }
kein_unerlaubter_aufruf() { ! printf '%s' "$LAUF_AUSGABE" | grep -q "nicht erlaubter Aufruf"; }

# Der echte Lauf A.5.1a hat gezeigt, dass crm-test ZWEI Container hat, nicht
# einen: `supabase_db_crm-test` und `supabase_kong_crm-test` — letzterer auch
# bei `[api] enabled = false`. Die Fixture bildet das ab, sonst prueft die Suite
# einen Stapel, den es so nicht gibt.
gesund_test() {
  zuruecksetzen
  netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
  container_setzen "$STATE_DIR" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback ok
  container_setzen "$STATE_DIR" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback ok
}

gesund_wiki() {
  zuruecksetzen
  netz_zustand "$STATE_DIR/net-crm-wiki-loopback" "crm-wiki-loopback" "crm-wiki-stack" ok
  container_setzen "$STATE_DIR" supabase_db_crm-wiki   crm-wiki 5432/tcp 54422 crm-wiki-loopback ok
  container_setzen "$STATE_DIR" supabase_kong_crm-wiki crm-wiki 8000/tcp 54421 crm-wiki-loopback ok
}

# ═══ Netzpruefung ═══════════════════════════════════════════════════════════
echo
echo "── Netzpruefung ───────────────────────────────────────────────────────"

zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
helfer loopback_verify_network crm-test-loopback crm-test-stack
[ "$HELFER_RC" = "0" ] && ok "korrektes Netz wird angenommen" || fail "korrektes Netz" "rc=$HELFER_RC: $HELFER_AUSGABE"

for art in falscher-treiber falsche-option keine-option fremdes-label falscher-zweck \
           falscher-name kein-json zwei-eintraege; do
  zuruecksetzen
  netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" "$art"
  helfer loopback_verify_network crm-test-loopback crm-test-stack
  [ "$HELFER_RC" = "1" ] && ok "Netz abgelehnt: $art" || fail "Netz abgelehnt: $art" "rc=$HELFER_RC"
done

zuruecksetzen
helfer loopback_verify_network crm-test-loopback crm-test-stack
[ "$HELFER_RC" = "2" ] && ok "fehlendes Netz meldet 'nicht vorhanden' (rc=2), nicht 'falsch'" \
  || fail "fehlendes Netz → rc=2" "rc=$HELFER_RC"

zuruecksetzen
netz_zustand "$STATE_DIR/net-nach-create-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
helfer loopback_require_network crm-test-loopback crm-test-stack
[ "$HELFER_RC" = "0" ] && ok "fehlendes Netz wird angelegt" || fail "fehlendes Netz anlegen" "rc=$HELFER_RC"
log_enthaelt "docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 --label crm.repo=crm-project --label crm.purpose=crm-test-stack crm-test-loopback" \
  && ok "exakter create-Befehl (Treiber, Bindeoption, beide Label)" \
  || fail "exakter create-Befehl" "$(grep network "$ARBEIT/log" | head -2)"

zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
helfer loopback_require_network crm-test-loopback crm-test-stack
log_enthaelt "network create" && fail "vorhandenes Netz nicht neu anlegen" "create aufgerufen" \
  || ok "vorhandenes Netz wird nicht neu angelegt"

zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" falsche-option
helfer loopback_require_network crm-test-loopback crm-test-stack
[ "$HELFER_RC" = "1" ] && ok "falsches Netz gleichen Namens → Absage" || fail "falsches Netz" "rc=$HELFER_RC"
if log_enthaelt "network rm" || log_enthaelt "network create"; then
  fail "falsches Netz wird nicht angefasst" "rm/create aufgerufen"
else ok "falsches Netz wird weder geloescht noch neu angelegt"; fi

zuruecksetzen
netz_zustand "$STATE_DIR/net-nach-create-crm-test-loopback" "crm-test-loopback" "crm-test-stack" falsche-option
helfer loopback_require_network crm-test-loopback crm-test-stack
[ "$HELFER_RC" = "1" ] && ok "nach dem Anlegen wird erneut geprueft (Wettlauf → Absage)" \
  || fail "Wettlauf nach create" "rc=$HELFER_RC"

# ═══ Container-Identitaet (ein einziges inspect) ════════════════════════════
echo
echo "── Container-Identitaet und Bindungen ─────────────────────────────────"

identitaet_fall() {  # <soll-rc> <beschreibung> <art>
  zuruecksetzen
  container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback "$3"
  helfer loopback_verify_container id_supabase_db_crm-test supabase_db_crm-test crm-test crm-test-loopback 5432/tcp 54342
  if [ "$HELFER_RC" = "$1" ]; then ok "$2"
  else fail "$2" "rc=$HELFER_RC (erwartet $1): $(printf '%s' "$HELFER_AUSGABE" | head -1)"; fi
}

identitaet_fall 0 "laufend, richtiges Label, richtiges Netz, 127.0.0.1 → angenommen" ok
identitaet_fall 1 "0.0.0.0 → abgelehnt"                                   wildcard
identitaet_fall 1 ":: → abgelehnt"                                        ipv6-wildcard
identitaet_fall 1 "leeres HostIp → abgelehnt"                             leerer-host
identitaet_fall 1 "loopback + Wildcard dahinter → abgelehnt"              gemischt
identitaet_fall 1 "falscher Hostport → abgelehnt"                         falscher-port
identitaet_fall 1 "zweite Bindung auf falschem Port → abgelehnt"          zweiter-falscher-port
identitaet_fall 1 "null-Bindung (exponiert, nicht veroeffentlicht) → abgelehnt" keine-bindung
identitaet_fall 1 "leere Bindungsliste → abgelehnt"                       leere-bindung
identitaet_fall 1 "kaputtes JSON → abgelehnt"                             kein-json
identitaet_fall 1 "leere inspect-Liste → abgelehnt"                       leere-liste
identitaet_fall 1 "keine Ports-Tabelle → abgelehnt"                       keine-ports
identitaet_fall 1 "falsches Netz → abgelehnt"                             fremdes-netz
identitaet_fall 1 "zusaetzliches Netz → abgelehnt"                        zusatznetz
identitaet_fall 1 "gestoppter Container → abgelehnt"                      gestoppt
identitaet_fall 1 "fremdes Projektlabel → abgelehnt"                      fremdes-label
identitaet_fall 1 "gar kein Projektlabel → abgelehnt"                     ohne-label
identitaet_fall 1 "anderer .Name im Inspect → abgelehnt"                  falscher-name

zuruecksetzen
helfer loopback_verify_container id_supabase_db_crm-test supabase_db_crm-test crm-test crm-test-loopback 5432/tcp 54342
[ "$HELFER_RC" = "1" ] && ok "nicht vorhandener Container → abgelehnt" || fail "fehlender Container" "rc=$HELFER_RC"

# ═══ Engine-Fassung ═════════════════════════════════════════════════════════
echo
echo "── Docker-Engine-Fassung ──────────────────────────────────────────────"

engine_fall() {  # <soll-rc> <beschreibung> <fassung|->
  zuruecksetzen
  if [ "$3" = "-" ]; then touch "$STATE_DIR/engine-fehlt"; else echo "$3" > "$STATE_DIR/engine"; fi
  helfer loopback_engine_ok
  if [ "$HELFER_RC" = "$1" ]; then ok "$2"; else fail "$2" "rc=$HELFER_RC"; fi
}
engine_fall 0 "Engine 28.1.0 → angenommen"            "28.1.0"
engine_fall 0 "Engine 29.0.0 → angenommen"            "29.0.0"
engine_fall 1 "Engine 27.5.1 → abgelehnt"             "27.5.1"
engine_fall 1 "Engine 24.0.7 → abgelehnt"             "24.0.7"
engine_fall 1 "unlesbare Fassung → abgelehnt"         "-"
engine_fall 1 "unerwartetes Format → abgelehnt"       "podman-kompatibel"

zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
echo "27.5.1" > "$STATE_DIR/engine"
wrapper up test
if [ "$LAUF_RC" != "0" ] && ! log_enthaelt "start --network-id"; then
  ok "zu alte Engine → kein Start"
else fail "zu alte Engine" "rc=$LAUF_RC"; fi

# ═══ Frischer Start ═════════════════════════════════════════════════════════
echo
echo "── Wrapper: frischer Start ────────────────────────────────────────────"

# 1. Erfolgsfall MIT Zustandsuebergang: der Start legt die Container an.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR/nach-start" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback ok
container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback ok
wrapper up test
if [ "$LAUF_RC" = "0" ] && kein_unerlaubter_aufruf; then ok "frischer Start: rc=0"
else fail "frischer Start" "rc=$LAUF_RC: $LAUF_AUSGABE"; fi
log_enthaelt "supabase --workdir supabase-test/runtime start --network-id crm-test-loopback" \
  && ok "Start mit exaktem --network-id" || fail "Start mit --network-id" "$(grep supabase "$ARBEIT/log")"
log_enthaelt "runtime stop" && fail "Erfolgsfall ruft kein stop" "stop aufgerufen" \
  || ok "Erfolgsfall ruft KEIN stop"

# 2. Start legt Teilzustand an und scheitert → Rueckabwicklung.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR/nach-start" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback ok
container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback ok
echo 1 > "$STATE_DIR/start-rc"
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "gescheiterter Start → nonzero" || fail "gescheiterter Start" "rc=0"
log_enthaelt "supabase --workdir supabase-test/runtime stop" \
  && ok "gescheiterter Start → Rueckabwicklung stoppt genau diesen Stapel" \
  || fail "Rueckabwicklung nach gescheitertem Start" "$(grep supabase "$ARBEIT/log")"
case "$LAUF_AUSGABE" in
  *"laeuft im Netz"*) fail "kein Erfolgsmeldung nach Fehlschlag" "Erfolgsmeldung ausgegeben" ;;
  *) ok "keine Erfolgsmeldung nach Fehlschlag" ;;
esac

# 3. Die Rueckabwicklung scheitert selbst.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR/nach-start" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback wildcard
container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback ok
echo 1 > "$STATE_DIR/stop-rc"; touch "$STATE_DIR/stop-wirkungslos"
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "Stop scheitert → nonzero" || fail "Stop scheitert" "rc=0"
case "$LAUF_AUSGABE" in
  *"zurueckgerollt"*) fail "kein 'gestoppt' bei fehlgeschlagenem Stop" "Meldung 'zurueckgerollt' ausgegeben" ;;
  *) ok "kein 'gestoppt' bei fehlgeschlagenem Stop" ;;
esac
case "$LAUF_AUSGABE" in
  *"laeuft moeglicherweise noch"*) ok "laute Warnung: koennte noch laufen" ;;
  *) fail "laute Warnung bei ungeklaertem Zustand" "$(printf '%s' "$LAUF_AUSGABE" | tail -3)" ;;
esac

# 4. Signal im Fenster der Nachpruefung.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR/nach-start" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback ok
container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback ok
touch "$STATE_DIR/term-bei-nachpruefung"
: > "$ARBEIT/log"
( echo $BASHPID > "$STATE_DIR/wrapper-pid"
  exec env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" STATE_DIR="$STATE_DIR" \
    DENIED_LOG="$DENIED_LOG" bash "$ROOT/scripts/supabase-stack.sh" up test >"$ARBEIT/signal.out" 2>&1 ) &
SIGNAL_PID=$!
wait "$SIGNAL_PID"; SIGNAL_RC=$?
[ "$SIGNAL_RC" != "0" ] && ok "TERM waehrend der Nachpruefung → nonzero (rc=$SIGNAL_RC)" \
  || fail "TERM waehrend der Nachpruefung" "rc=0"
grep -qF "supabase --workdir supabase-test/runtime stop" "$ARBEIT/log" \
  && ok "TERM → Rueckabwicklung laeuft" || fail "TERM → Rueckabwicklung" "$(cat "$ARBEIT/signal.out")"

# 9. Nachpruefung findet falsches Label → Rueckabwicklung.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR/nach-start" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback fremdes-label
container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback ok
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "Nachpruefung: fremdes Label → Absage" || fail "Nachpruefung fremdes Label" "rc=0"
log_enthaelt "runtime stop" && ok "Nachpruefung: fremdes Label → Rueckabwicklung" \
  || fail "Rueckabwicklung bei fremdem Label" "$(grep supabase "$ARBEIT/log")"

# ═══ Vorgefundener Zustand ══════════════════════════════════════════════════
echo
echo "── Wrapper: vorgefundener Zustand ─────────────────────────────────────"

gesund_test
wrapper up test
if [ "$LAUF_RC" = "0" ] && ! log_enthaelt "start --network-id"; then
  ok "geprueft vorhandener Stapel wird weiterverwendet, nicht neu gestartet"
else fail "vorhandener Stapel" "rc=$LAUF_RC: $LAUF_AUSGABE"; fi

gesund_test
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback wildcard
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "vorhandener Stapel mit Wildcard → Absage" || fail "vorhandener Wildcard-Stapel" "rc=0"
if log_enthaelt "runtime stop" || log_enthaelt "docker rm"; then
  fail "vorgefundener unsicherer Stapel wird nicht angefasst" "stop/rm aufgerufen"
else ok "vorgefundener unsicherer Stapel wird NICHT gestoppt oder geloescht"; fi

# 7. Gestoppter Container gilt nicht als sicher.
gesund_test
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback gestoppt
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "gestoppter DB-Container → Absage" || fail "gestoppter Container" "rc=0"

# 8. Halber Zustand: Reste mit richtigem Label, aber ohne DB.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-wiki-loopback" "crm-wiki-loopback" "crm-wiki-stack" ok
container_setzen "$STATE_DIR" supabase_kong_crm-wiki crm-wiki 8000/tcp 54421 crm-wiki-loopback ok
wrapper up wiki
[ "$LAUF_RC" != "0" ] && ok "halber Zustand (Kong ohne DB) → Absage" || fail "halber Zustand" "rc=0"
if log_enthaelt "start --network-id" || log_enthaelt "runtime stop"; then
  fail "halber Zustand: weder Start noch Stop" "$(grep supabase "$ARBEIT/log")"
else ok "halber Zustand: weder gestartet noch gestoppt"; fi

# ═══ Wiki: Kong ist Pflicht ═════════════════════════════════════════════════
echo
echo "── Wiki: Kong ist nicht optional ──────────────────────────────────────"

gesund_wiki
wrapper up wiki
[ "$LAUF_RC" = "0" ] && ok "Wiki: DB und Kong sicher → angenommen" || fail "Wiki gesund" "rc=$LAUF_RC: $LAUF_AUSGABE"

# 5. DB sicher, Kong fehlt ganz.
gesund_wiki
rm -f "$STATE_DIR/c-supabase_kong_crm-wiki" "$STATE_DIR/label-supabase_kong_crm-wiki" \
      "$STATE_DIR/running-supabase_kong_crm-wiki"
printf 'supabase_db_crm-wiki\n' > "$STATE_DIR/inv-crm-wiki"
wrapper up wiki
[ "$LAUF_RC" != "0" ] && ok "Wiki: Kong fehlt → Absage" || fail "Wiki ohne Kong" "rc=0"
case "$LAUF_AUSGABE" in
  *"geprueft und wird weiterverwendet"*|*"laeuft im Netz"*) fail "Wiki ohne Kong: keine Erfolgsmeldung" "Erfolgsmeldung ausgegeben" ;;
  *) ok "Wiki ohne Kong: keine Erfolgsmeldung" ;;
esac
log_enthaelt "runtime stop" && fail "Wiki ohne Kong: kein automatischer Stop" "stop aufgerufen" \
  || ok "Wiki ohne Kong: kein automatischer Stop"

for art in wildcard falscher-port fremdes-label gestoppt fremdes-netz; do
  gesund_wiki
  container_setzen "$STATE_DIR" supabase_kong_crm-wiki crm-wiki 8000/tcp 54421 crm-wiki-loopback "$art"
  wrapper up wiki
  [ "$LAUF_RC" != "0" ] && ok "Wiki: Kong '$art' → Absage" || fail "Wiki Kong $art" "rc=0"
done

# ═══ down ═══════════════════════════════════════════════════════════════════
echo
echo "── Wrapper: down ──────────────────────────────────────────────────────"

gesund_test
wrapper down test
if [ "$LAUF_RC" = "0" ] && log_enthaelt "supabase --workdir supabase-test/runtime stop"; then
  ok "down stoppt den geprueften Stapel"
else fail "down" "rc=$LAUF_RC: $LAUF_AUSGABE"; fi
log_enthaelt "network rm" && fail "down entfernt kein Netz" "network rm aufgerufen" \
  || ok "down entfernt das Netz NICHT"

# 10a. Unsicheres Binding darf das Herunterfahren nicht verhindern.
gesund_test
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback wildcard
wrapper down test
[ "$LAUF_RC" = "0" ] && ok "down funktioniert auch bei unsicherer Bindung" \
  || fail "down bei unsicherer Bindung" "rc=$LAUF_RC: $LAUF_AUSGABE"

# 10b. Halber, aber richtig etikettierter Zustand laesst sich herunterfahren.
zuruecksetzen
container_setzen "$STATE_DIR" supabase_kong_crm-wiki crm-wiki 8000/tcp 54421 crm-wiki-loopback ok
wrapper down wiki
[ "$LAUF_RC" = "0" ] && ok "down: halber Stapel mit richtigem Label wird gestoppt" \
  || fail "down halber Stapel" "rc=$LAUF_RC: $LAUF_AUSGABE"

# 10c. Fremder Container unter unserem Namen.
zuruecksetzen
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback fremdes-label
wrapper down test
[ "$LAUF_RC" != "0" ] && ok "down: fremdes Label unter unserem Namen → Absage" || fail "down fremdes Label" "rc=0"
log_enthaelt "runtime stop" && fail "down: fremder Container wird nicht gestoppt" "stop aufgerufen" \
  || ok "down: fremder Container wird NICHT gestoppt"

# 10d. Stop scheitert.
gesund_test
echo 1 > "$STATE_DIR/stop-rc"; touch "$STATE_DIR/stop-wirkungslos"
wrapper down test
[ "$LAUF_RC" != "0" ] && ok "down: fehlgeschlagener Stop wird gemeldet" || fail "down Stop-Fehler" "rc=0"
case "$LAUF_AUSGABE" in
  *"gestoppt. Netz"*) fail "down: kein 'gestoppt' nach Fehlschlag" "Erfolgsmeldung ausgegeben" ;;
  *) ok "down: kein 'gestoppt' nach Fehlschlag" ;;
esac

zuruecksetzen
wrapper down test
[ "$LAUF_RC" = "0" ] && ok "down ohne laufenden Stapel: nichts zu tun" || fail "down ohne Stapel" "rc=$LAUF_RC"

# ═══ Die echten Verbraucher, ebenfalls stubbed ══════════════════════════════
echo
echo "── Verbraucher halten VOR dem zerstoerenden Teil ───────────────────────"

verbraucher() {  # <skript> <env...>
  local skript="$1"; shift
  : > "$ARBEIT/log"
  LAUF_AUSGABE="$(env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" STATE_DIR="$STATE_DIR" \
    DENIED_LOG="$DENIED_LOG" "$@" bash "$ROOT/$skript" 2>&1)"
  LAUF_RC=$?
  merke_ausgabe "${LAUF_AUSGABE:-}${HELFER_AUSGABE:-}"; pruefe_denied "$skript"
}

for art in wildcard gemischt falscher-port fremdes-label gestoppt fremdes-netz; do
  gesund_test
  container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback "$art"
  verbraucher scripts/test-db.sh CRM_TEST_ENV=1 TEST_DB_ADMIN_PASSWORD=egal
  if [ "$LAUF_RC" != "0" ] && ! log_enthaelt "docker exec"; then
    ok "test-db.sh haelt bei '$art' vor jedem docker exec / DROP SCHEMA"
  else
    fail "test-db.sh bei '$art'" "rc=$LAUF_RC, exec=$(grep -c 'docker exec' "$ARBEIT/log")"
  fi
done

for art in wildcard falscher-port fremdes-label gestoppt; do
  gesund_wiki
  container_setzen "$STATE_DIR" supabase_kong_crm-wiki crm-wiki 8000/tcp 54421 crm-wiki-loopback "$art"
  verbraucher scripts/wiki-db.sh CRM_WIKI_ENV=1
  if [ "$LAUF_RC" != "0" ] && ! log_enthaelt "docker exec"; then
    ok "wiki-db.sh haelt bei Kong '$art' vor jedem docker exec / DROP SCHEMA"
  else
    fail "wiki-db.sh bei Kong '$art'" "rc=$LAUF_RC, exec=$(grep -c 'docker exec' "$ARBEIT/log")"
  fi
done

gesund_wiki
rm -f "$STATE_DIR/c-supabase_kong_crm-wiki" "$STATE_DIR/label-supabase_kong_crm-wiki" \
      "$STATE_DIR/running-supabase_kong_crm-wiki"
verbraucher scripts/wiki-db.sh CRM_WIKI_ENV=1
if [ "$LAUF_RC" != "0" ] && ! log_enthaelt "docker exec"; then
  ok "wiki-db.sh haelt bei fehlendem Kong vor jedem docker exec / DROP SCHEMA"
else fail "wiki-db.sh ohne Kong" "rc=$LAUF_RC"; fi

# ═══ Unlesbarer Zustand: nie zu "es gibt nichts" runden ═════════════════════
echo
echo "── Bestandsaufnahme faellt aus ────────────────────────────────────────"

# 1. `docker ps` scheitert beim up.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
touch "$STATE_DIR/ps-schlaegt-fehl"
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "up: Bestandsaufnahme scheitert → nonzero" || fail "up ohne Bestandsaufnahme" "rc=0"
if log_enthaelt "start --network-id" || log_enthaelt "runtime stop"; then
  fail "up: kein Start und kein Stop ohne Bestandsaufnahme" "$(grep supabase "$ARBEIT/log")"
else ok "up: weder gestartet noch gestoppt, solange der Bestand unbekannt ist"; fi

# 2. `docker ps` scheitert beim down.
zuruecksetzen
touch "$STATE_DIR/ps-schlaegt-fehl"
wrapper down test
[ "$LAUF_RC" != "0" ] && ok "down: Bestandsaufnahme scheitert → nonzero" || fail "down ohne Bestandsaufnahme" "rc=0"
case "$LAUF_AUSGABE" in
  *"Kein Container des Projekts"*) fail "down: keine 'nichts zu stoppen'-Meldung bei unbekanntem Bestand" "Erfolgsmeldung ausgegeben" ;;
  *) ok "down: keine 'nichts zu stoppen'-Meldung bei unbekanntem Bestand" ;;
esac
log_enthaelt "runtime stop" && fail "down: kein Stop bei unbekanntem Bestand" "stop aufgerufen" \
  || ok "down: kein Stop bei unbekanntem Bestand"

# 3. Leere Label-Bestandsaufnahme, aber ein Container unter unserem Namen.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback fremdes-label
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "up: fremder Container unter unserem Namen → Absage" || fail "fremder Name" "rc=0"
if log_enthaelt "start --network-id" || log_enthaelt "runtime stop"; then
  fail "up: fremder Name → weder Start noch Stop" "$(grep supabase "$ARBEIT/log")"
else ok "up: fremder Name → weder gestartet noch gestoppt"; fi

# 4. Nach dem Stop ist der Zustand nicht lesbar.
gesund_test
touch "$STATE_DIR/stop-laesst-reste" "$STATE_DIR/state-schlaegt-fehl"
wrapper down test
[ "$LAUF_RC" = "3" ] && ok "down: unlesbarer Zustand nach dem Stop → rc=3" || fail "unlesbarer Zustand" "rc=$LAUF_RC"
case "$LAUF_AUSGABE" in
  *"gestoppt. Netz"*|*"bleibt stehen"*) fail "down: keine Erfolgsmeldung bei unlesbarem Zustand" "Erfolgsmeldung" ;;
  *) ok "down: keine Erfolgsmeldung bei unlesbarem Zustand" ;;
esac

# 5. DB und Kong gestoppt, aber ein anderer Projektcontainer laeuft noch.
gesund_wiki
container_setzen "$STATE_DIR" supabase_auth_crm-wiki crm-wiki 9999/tcp 0 crm-wiki-loopback unveroeffentlicht
touch "$STATE_DIR/stop-wirkungslos"
python3 -c 'import sys; p=sys.argv[1]
for n in ("supabase_db_crm-wiki","supabase_kong_crm-wiki"): open(p+"/running-"+n,"w").write("false")' "$STATE_DIR"
wrapper down wiki
[ "$LAUF_RC" = "3" ] && ok "down: anderer Projektcontainer laeuft noch → rc=3" || fail "restlaufender Container" "rc=$LAUF_RC"

# Gestoppte Reste sind KEIN Fehler — aber sie werden genannt, und der naechste
# up verweigert deswegen.
gesund_test
touch "$STATE_DIR/stop-laesst-reste"
wrapper down test
[ "$LAUF_RC" = "0" ] && ok "down: gestoppte Reste sind kein Fehler" || fail "gestoppte Reste" "rc=$LAUF_RC"
case "$LAUF_AUSGABE" in
  *"gestoppte Reste"*) ok "down: gestoppte Reste werden ausdruecklich genannt" ;;
  *) fail "gestoppte Reste genannt" "$(printf '%s' "$LAUF_AUSGABE" | tail -2)" ;;
esac
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "der naechste up verweigert wegen der gestoppten Reste" || fail "up nach Resten" "rc=0"

# ═══ Der ganze Stapel, nicht nur DB und Kong ════════════════════════════════
echo
echo "── Alle Projektcontainer werden geprueft ──────────────────────────────"

# 8. Zusaetzliche, nur intern erreichbare Container sind in Ordnung.
gesund_wiki
container_setzen "$STATE_DIR" supabase_auth_crm-wiki crm-wiki 9999/tcp 0 crm-wiki-loopback unveroeffentlicht
container_setzen "$STATE_DIR" supabase_rest_crm-wiki crm-wiki 3000/tcp 0 crm-wiki-loopback unveroeffentlicht
wrapper up wiki
[ "$LAUF_RC" = "0" ] && ok "unveroeffentlichte Zusatzcontainer → angenommen" || fail "Zusatzcontainer" "rc=$LAUF_RC: $LAUF_AUSGABE"

# 6. Ein Zusatzcontainer mit Wildcard-Bindung.
gesund_wiki
container_setzen "$STATE_DIR" supabase_auth_crm-wiki crm-wiki 9999/tcp 9999 crm-wiki-loopback wildcard
wrapper up wiki
[ "$LAUF_RC" != "0" ] && ok "Zusatzcontainer auf 0.0.0.0 → Absage" || fail "Zusatzcontainer Wildcard" "rc=0"

gesund_wiki
container_setzen "$STATE_DIR" supabase_auth_crm-wiki crm-wiki 9999/tcp 9999 crm-wiki-loopback fremdes-netz
wrapper up wiki
[ "$LAUF_RC" != "0" ] && ok "Zusatzcontainer im falschen Netz → Absage" || fail "Zusatzcontainer Netz" "rc=0"

# 7. Ein ZWEITER veroeffentlichter Port an DB bzw. Kong.
gesund_test
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback zweiter-port-wildcard
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "DB: zweiter Port auf 0.0.0.0 → Absage" || fail "zweiter Port DB" "rc=0"

gesund_wiki
container_setzen "$STATE_DIR" supabase_kong_crm-wiki crm-wiki 8000/tcp 54421 crm-wiki-loopback zweiter-port-wildcard
wrapper up wiki
[ "$LAUF_RC" != "0" ] && ok "Kong: zweiter Port auf 0.0.0.0 → Absage" || fail "zweiter Port Kong" "rc=0"

gesund_test
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback zweiter-port-loopback
wrapper up test
[ "$LAUF_RC" = "0" ] && ok "DB: zweiter Port auf 127.0.0.1 → in Ordnung" || fail "zweiter Loopback-Port" "rc=$LAUF_RC"

gesund_test
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback zweiter-port-wildcard
verbraucher scripts/test-db.sh CRM_TEST_ENV=1 TEST_DB_ADMIN_PASSWORD=egal
if [ "$LAUF_RC" != "0" ] && ! log_enthaelt "docker exec"; then
  ok "test-db.sh haelt beim zweiten Wildcard-Port vor docker exec / DROP SCHEMA"
else fail "test-db.sh zweiter Port" "rc=$LAUF_RC"; fi

# 10. Frischer Wiki-Start, danach fehlt oder stimmt Kong nicht.
for art in fehlt fremdes-label wildcard; do
  zuruecksetzen
  netz_zustand "$STATE_DIR/net-crm-wiki-loopback" "crm-wiki-loopback" "crm-wiki-stack" ok
  container_setzen "$STATE_DIR/nach-start" supabase_db_crm-wiki crm-wiki 5432/tcp 54422 crm-wiki-loopback ok
  [ "$art" = "fehlt" ] || container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-wiki crm-wiki 8000/tcp 54421 crm-wiki-loopback "$art"
  wrapper up wiki
  if [ "$LAUF_RC" != "0" ] && log_enthaelt "supabase --workdir supabase-wiki/runtime stop"; then
    ok "frischer Wiki-Start, Kong '$art' → Rueckabwicklung + nonzero"
  else fail "frischer Wiki-Start, Kong '$art'" "rc=$LAUF_RC"; fi
done

# 9. TERM: genau EIN stop, kein Erfolg, nachweislich beendet.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR/nach-start" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback ok
container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback ok
touch "$STATE_DIR/term-bei-nachpruefung"
: > "$ARBEIT/log"
( echo $BASHPID > "$STATE_DIR/wrapper-pid"
  exec env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" STATE_DIR="$STATE_DIR" \
    DENIED_LOG="$DENIED_LOG" bash "$ROOT/scripts/supabase-stack.sh" up test >"$ARBEIT/signal2.out" 2>&1 ) &
wait $!; SIG_RC=$?
pruefe_denied "TERM-Lauf"
[ "$SIG_RC" != "0" ] && ok "TERM: nonzero (rc=$SIG_RC)" || fail "TERM nonzero" "rc=0"
gleich 1 "$(grep -c 'runtime stop' "$ARBEIT/log")" "TERM: genau EIN stop-Aufruf"
case "$(cat "$ARBEIT/signal2.out")" in
  *"laeuft im Netz"*) fail "TERM: keine Erfolgsmeldung" "Erfolgsmeldung ausgegeben" ;;
  *) ok "TERM: keine Erfolgsmeldung" ;;
esac
case "$(cat "$ARBEIT/signal2.out")" in
  *"zurueckgerollt"*) ok "TERM: nachweislich gestoppt gemeldet" ;;
  *) fail "TERM: Nachweis gemeldet" "$(tail -2 "$ARBEIT/signal2.out")" ;;
esac

# ═══ Gateway-Port: ein ausdruecklicher Vertrag, kein stiller Standard ═══════
echo
echo "── Gateway-Port (crm-test 54341, wiki 54421) ──────────────────────────"

# Der erste echte Lauf (A.5.1a) hat den Grund geliefert: bei `[api] enabled =
# false` startete die CLI 2.98.2 trotzdem einen Gateway und veroeffentlichte ihn
# auf 127.0.0.1:54321 — dem Port des WURZELPROJEKTS. Loopback war er, richtig war
# er nicht. Genau deshalb darf der Gateway nicht in den generischen Zweig fallen,
# in dem nur "keine Bindung ausserhalb 127.0.0.1" gilt.
gateway_fall() {  # <soll> <beschreibung> <art> [<hostport>]
  gesund_test
  container_setzen "$STATE_DIR" supabase_kong_crm-test crm-test 8000/tcp "${4:-54341}" crm-test-loopback "$3"
  wrapper up test
  if [ "$1" = "0" ]; then
    [ "$LAUF_RC" = "0" ] && ok "$2" || fail "$2" "rc=$LAUF_RC: $(printf '%s' "$LAUF_AUSGABE" | tail -2)"
  else
    [ "$LAUF_RC" != "0" ] && ok "$2" || fail "$2" "rc=0, Absage erwartet"
  fi
}

gateway_fall 0 "crm-test: DB + Gateway auf 54341 → angenommen"          ok
gateway_fall 1 "crm-test: Gateway auf dem Standard 54321 → Absage"      ok 54321
gateway_fall 1 "crm-test: Gateway auf einem anderen Loopback-Port → Absage" ok 54999
gateway_fall 1 "crm-test: Gateway auf 0.0.0.0 → Absage"                 wildcard
gateway_fall 1 "crm-test: Gateway auf :: → Absage"                      ipv6-wildcard
gateway_fall 1 "crm-test: Gateway mit leerem HostIp → Absage"           leerer-host
gateway_fall 1 "crm-test: Gateway loopback + Wildcard dahinter → Absage" gemischt

# Gateway fehlt ganz — auch das ist bei `enabled = false` eine Absage.
gesund_test
rm -f "$STATE_DIR/c-supabase_kong_crm-test" "$STATE_DIR/label-supabase_kong_crm-test" \
      "$STATE_DIR/running-supabase_kong_crm-test"
printf 'id_supabase_db_crm-test supabase_db_crm-test\n' > "$STATE_DIR/inv-crm-test"
printf 'supabase_db_crm-test\n' > "$STATE_DIR/all-names"
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "crm-test: Gateway fehlt → Absage" || fail "Gateway fehlt" "rc=0"
gleich 0 "$(grep -c 'runtime stop' "$ARBEIT/log")" "crm-test: fehlender Gateway → kein automatischer Stop"

# Der Wiki-Stapel mit seinem eigenen Port.
gesund_wiki
wrapper up wiki
[ "$LAUF_RC" = "0" ] && ok "wiki: Gateway auf 54421 → angenommen" || fail "wiki Gateway 54421" "rc=$LAUF_RC"

gesund_wiki
container_setzen "$STATE_DIR" supabase_kong_crm-wiki crm-wiki 8000/tcp 54341 crm-wiki-loopback ok
wrapper up wiki
[ "$LAUF_RC" != "0" ] && ok "wiki: Gateway auf dem crm-test-Port → Absage" || fail "wiki fremder Gateway-Port" "rc=0"

# ── Der Port muss in der Konfiguration stehen, und zwar brauchbar ──────────
# Geprueft wird an einer KOPIE des Arbeitsverzeichnisses; die echte
# Konfiguration wird nicht angefasst.
# Laeuft den Wrapper gegen eine KOPIE der Konfiguration; die echte wird nie
# angefasst. `ausdruck` ist ein sed-Ausdruck auf die [api]-Portzeile.
mit_konfig() {  # <aktion> <sed-Ausdruck>
  local aktion="$1" ausdruck="$2"
  local kopie="$ARBEIT/konfig"
  rm -rf "$kopie"; mkdir -p "$kopie/supabase-test/runtime/supabase" "$kopie/scripts" "$ARBEIT/locks"
  cp scripts/supabase-stack.sh scripts/docker-loopback.sh "$kopie/scripts/"
  sed "$ausdruck" supabase-test/runtime/supabase/config.toml \
    > "$kopie/supabase-test/runtime/supabase/config.toml"
  : > "$ARBEIT/log"
  LAUF_AUSGABE="$(cd "$kopie" && env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" \
    STATE_DIR="$STATE_DIR" DENIED_LOG="$DENIED_LOG" TMPDIR="$ARBEIT/locks" \
    bash scripts/supabase-stack.sh "$aktion" test 2>&1)"
  LAUF_RC=$?
  merke_ausgabe "$LAUF_AUSGABE"
  pruefe_denied "mit_konfig $aktion"
}

port_vertrag() {  # <beschreibung> <sed-Ausdruck>
  local was="$1"
  mit_konfig up "$2"
  [ "$LAUF_RC" != "0" ] && ok "$was" || fail "$was" "rc=0, Absage erwartet"
  gleich 0 "$(grep -cE '^docker |^supabase ' "$ARBEIT/log")" "$was: kein einziger Werkzeugaufruf"
}

# Dieselbe kaputte Konfiguration, aber `down`: das MUSS weiter funktionieren.
# Vorher lief die Portpruefung vor der Verzweigung — eine fehlerhafte
# Portangabe sperrte damit ausgerechnet das Herunterfahren aus. Genau
# andersherum: ein Stapel mit falscher Konfiguration ist einer, den man dringend
# beenden koennen muss.
down_trotz_konfig() {  # <beschreibung> <sed-Ausdruck>
  local was="$1"
  gesund_test
  mit_konfig down "$2"
  [ "$LAUF_RC" = "0" ] && ok "$was" || fail "$was" "rc=$LAUF_RC: $(printf '%s' "$LAUF_AUSGABE" | tail -2)"
  gleich 1 "$(grep -c 'runtime stop' "$ARBEIT/log")" "$was: genau EIN stop-Aufruf"
}

gesund_test
port_vertrag "[api] port fehlt → Absage vor jedem Werkzeugaufruf"     '/^port = 54341$/d'
port_vertrag "[api] port leer → Absage vor jedem Werkzeugaufruf"      's/^port = 54341$/port = /'
port_vertrag "[api] port nicht numerisch → Absage"                    's/^port = 54341$/port = abc/'
port_vertrag "[api] port ausserhalb 1-65535 → Absage"                 's/^port = 54341$/port = 70000/'
port_vertrag "[api] port gleich dem DB-Port → Absage"                 's/^port = 54341$/port = 54342/'

# Nachpruefung nach frischem Start: nur der selbst gestartete Stapel wird
# gestoppt, ein vorgefundener nicht.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR/nach-start" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback ok
container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-test crm-test 8000/tcp 54321 crm-test-loopback ok
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "frischer Start, Gateway auf 54321 → Absage" || fail "frischer Start 54321" "rc=0"
gleich 1 "$(grep -c 'runtime stop' "$ARBEIT/log")" "frischer Start, falscher Gateway → genau EIN Stop (Rueckabwicklung)"

gesund_test
container_setzen "$STATE_DIR" supabase_kong_crm-test crm-test 8000/tcp 54321 crm-test-loopback ok
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "vorgefundener Stapel, Gateway auf 54321 → Absage" || fail "vorgefunden 54321" "rc=0"
gleich 0 "$(grep -c 'runtime stop' "$ARBEIT/log")" "vorgefundener falscher Stapel → KEIN Stop"

# ═══ down bleibt erreichbar, auch bei kaputtem Portvertrag ══════════════════
echo
echo "── down trotz fehlerhafter Portangabe ─────────────────────────────────"

down_trotz_konfig "down bei fehlendem [api] port"            '/^port = 54341$/d'
down_trotz_konfig "down bei Gateway-Port 70000"              's/^port = 54341$/port = 70000/'
down_trotz_konfig "down bei Gateway-Port gleich DB-Port"     's/^port = 54341$/port = 54342/'

# Ein falsches project_id ist etwas anderes als ein falscher Port: dann ist gar
# nicht klar, wessen Stapel gemeint ist. Da wird nicht gestoppt.
gesund_test
mit_konfig down 's/^project_id = "crm-test"$/project_id = "etwas-anderes"/'
[ "$LAUF_RC" != "0" ] && ok "down bei falschem project_id → Absage" || fail "down falsches project_id" "rc=0"
gleich 0 "$(grep -c 'runtime stop' "$ARBEIT/log")" "down bei falschem project_id → kein Stop"

# Unsichere Bindung darf das Herunterfahren weiterhin nicht verhindern.
gesund_test
container_setzen "$STATE_DIR" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback wildcard
wrapper down test
[ "$LAUF_RC" = "0" ] && ok "down bei unsicherer Gateway-Bindung → funktioniert" || fail "down unsichere Bindung" "rc=$LAUF_RC"

# ═══ Strikter Gateway-Modus ═════════════════════════════════════════════════
echo
echo "── Gateway strikt: genau EINE Tuer ────────────────────────────────────"

strikt_fall() {  # <soll-rc-klasse: 0|1> <beschreibung> <art>
  gesund_test
  container_setzen "$STATE_DIR" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback "$3"
  wrapper up test
  if [ "$1" = "0" ]; then
    [ "$LAUF_RC" = "0" ] && ok "$2" || fail "$2" "rc=$LAUF_RC: $(printf '%s' "$LAUF_AUSGABE" | tail -2)"
  else
    [ "$LAUF_RC" != "0" ] && ok "$2" || fail "$2" "rc=0, Absage erwartet"
  fi
}

strikt_fall 0 "Gateway: nur die eine exakte Bindung → angenommen"                  ok
strikt_fall 1 "Gateway: zweiter veroeffentlichter Port 127.0.0.1:9999 → Absage"  zweiter-port-loopback
strikt_fall 1 "Gateway: zweiter veroeffentlichter Port auf 0.0.0.0 → Absage"     zweiter-port-wildcard
strikt_fall 1 "Gateway: zwei identische Bindungen auf 8000/tcp → Absage"         doppelte-bindung
strikt_fall 0 "Gateway: zusaetzlicher Port ohne Veroeffentlichung (null) → angenommen" zusatzport-null

# Die DB bleibt beim bisherigen Vertrag: ein zweiter LOOPBACK-Port ist dort
# weiterhin in Ordnung. Der strikte Modus gilt ausschliesslich dem Gateway.
gesund_test
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback zweiter-port-loopback
wrapper up test
[ "$LAUF_RC" = "0" ] && ok "DB: zweiter Loopback-Port bleibt erlaubt (unveraendert)" || fail "DB zweiter Loopback-Port" "rc=$LAUF_RC"

gesund_test
container_setzen "$STATE_DIR" supabase_auth_crm-test crm-test 9999/tcp 0 crm-test-loopback unveroeffentlicht
wrapper up test
[ "$LAUF_RC" = "0" ] && ok "generischer Container mit ausschliesslich null-Ports → angenommen" || fail "generischer Container" "rc=$LAUF_RC"

# Ein einziges `docker inspect` je Container — auch im strikten Modus.
gesund_test
wrapper up test
gleich 2 "$(grep -cE '^docker inspect [^-]' "$ARBEIT/log")" \
  "genau EIN vollstaendiges docker inspect je Container (2 Container, kein zweiter Aufruf)"

# Verstoss NACH dem frischen Start → genau eine Rueckabwicklung.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR/nach-start" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback ok
container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback zweiter-port-loopback
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "frischer Start, strikter Verstoss → Absage" || fail "frischer Start strikt" "rc=0"
gleich 1 "$(grep -c 'runtime stop' "$ARBEIT/log")" "frischer Start, strikter Verstoss → genau EIN Stop"

# Derselbe Verstoss an einem VORGEFUNDENEN Stapel → kein Stop.
gesund_test
container_setzen "$STATE_DIR" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback zweiter-port-loopback
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "vorgefundener Stapel, strikter Verstoss → Absage" || fail "vorgefunden strikt" "rc=0"
gleich 0 "$(grep -c 'runtime stop' "$ARBEIT/log")" "vorgefundener Stapel, strikter Verstoss → KEIN Stop"

# Ein unbekannter Moduswert ist ein Abbruch, kein stiller Normalmodus.
gesund_test
helfer loopback_verify_container id_supabase_kong_crm-test supabase_kong_crm-test crm-test crm-test-loopback 8000/tcp 54341 halbstreng
[ "$HELFER_RC" = "1" ] && ok "unbekannter Pruefmodus → Absage" || fail "unbekannter Modus" "rc=$HELFER_RC"
helfer loopback_verify_container id_supabase_kong_crm-test supabase_kong_crm-test crm-test crm-test-loopback "" "" strict
[ "$HELFER_RC" = "1" ] && ok "strikter Modus ohne Portvorgabe → Absage" || fail "strikt ohne Port" "rc=$HELFER_RC"

# ═══ Exakter Name: drei Antworten, nicht zwei ═══════════════════════════════
echo
echo "── Namensinventar (exact name) ────────────────────────────────────────"

# Projektbestand gelungen+leer, aber das Namensinventar ist nicht lesbar.
# Frueher hiess "docker inspect nonzero" schlicht "gibt es nicht" — und daraus
# folgte "also darf gestartet werden".
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
touch "$STATE_DIR/namen-schlagen-fehl"
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "up: Namensinventar unlesbar → nonzero" || fail "up ohne Namensinventar" "rc=0"
gleich 0 "$(grep -c 'start --network-id' "$ARBEIT/log")" "up: kein Start bei unlesbarem Namensinventar"
gleich 0 "$(grep -c 'runtime stop'      "$ARBEIT/log")" "up: kein Stop bei unlesbarem Namensinventar"

zuruecksetzen
touch "$STATE_DIR/namen-schlagen-fehl"
wrapper down test
[ "$LAUF_RC" != "0" ] && ok "down: Namensinventar unlesbar → nonzero" || fail "down ohne Namensinventar" "rc=0"
gleich 0 "$(grep -c 'runtime stop' "$ARBEIT/log")" "down: kein Stop bei unlesbarem Namensinventar"
case "$LAUF_AUSGABE" in
  *"Kein Container des Projekts"*) fail "down: keine 'nichts zu stoppen'-Meldung" "Erfolgsmeldung ausgegeben" ;;
  *) ok "down: keine 'nichts zu stoppen'-Meldung bei unlesbarem Namensinventar" ;;
esac

# Gelungen + abwesend: der frische Start darf laufen.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
: > "$STATE_DIR/all-names"
container_setzen "$STATE_DIR/nach-start" supabase_db_crm-test   crm-test 5432/tcp 54342 crm-test-loopback ok
container_setzen "$STATE_DIR/nach-start" supabase_kong_crm-test crm-test 8000/tcp 54341 crm-test-loopback ok
wrapper up test
[ "$LAUF_RC" = "0" ] && ok "up: Namensinventar gelungen und leer → frischer Start" || fail "frischer Start bei leerem Inventar" "rc=$LAUF_RC: $LAUF_AUSGABE"
gleich 1 "$(grep -c 'start --network-id' "$ARBEIT/log")" "up: genau EIN Startaufruf"

# Gelungen + exakter Name belegt, aber ohne Projektlabel.
zuruecksetzen
netz_zustand "$STATE_DIR/net-crm-test-loopback" "crm-test-loopback" "crm-test-stack" ok
container_setzen "$STATE_DIR" supabase_db_crm-test crm-test 5432/tcp 54342 crm-test-loopback ohne-label
wrapper up test
[ "$LAUF_RC" != "0" ] && ok "up: exakter Name ohne Projektlabel → Absage" || fail "labelloser Container" "rc=0"
gleich 0 "$(grep -c 'start --network-id' "$ARBEIT/log")" "up: kein Start bei labellosem Namensbeleger"
gleich 0 "$(grep -c 'runtime stop'      "$ARBEIT/log")" "up: kein Stop bei labellosem Namensbeleger"

# ═══ Die gemeinsame Sperre ══════════════════════════════════════════════════
echo
echo "── Lebenszyklus-Sperre ────────────────────────────────────────────────"

# Ein fremder Prozess haelt die Sperre desselben Projekts. Alles laeuft in
# $TMPDIR und gegen die Attrappen; es wird nichts gestartet.
SPERR_TMP="$ARBEIT/locks"; mkdir -p "$SPERR_TMP"

# Ein fremder Prozess haelt die Sperre, bis eine Freigabedatei verschwindet.
#
# Zwei Fallen stecken darin, und beide sind hier schon zugeschnappt:
#   - `PID="$(halter)"` blockiert, bis der Hintergrundprozess ENDET: er erbt die
#     Pipe der Kommandosubstitution als stdout. Der Halter war damit jedes Mal
#     laengst wieder weg, wenn die Zusicherung lief — die Sperre wurde nie
#     geprueft. Deshalb: stdout weg vom Aufruf, PID ueber eine Datei.
#   - Ein `sleep` als Kind erbt den Deskriptor und haelt die Sperre WEITER,
#     nachdem der Halter getoetet wurde. Deshalb endet der Halter von selbst,
#     sobald die Freigabedatei fehlt, statt getoetet zu werden.
FREIGABE="$SPERR_TMP/halten"
fremde_sperre() {  # <projekt> — kehrt erst zurueck, wenn die Sperre wirklich haelt
  # Zwei Anweisungen: `local a="$1" b="…$a…"` expandiert alle Worte vor der
  # Zuweisung — dieselbe Falle wie in loopback_stack_lock.
  local projekt="$1"
  local beleg="$SPERR_TMP/gehalten-$projekt"
  rm -f "$beleg"; : > "$FREIGABE"
  ( exec 7>"$SPERR_TMP/crm-stack-${projekt}.lock"
    flock 7 || exit 1
    echo "haelt" > "$beleg"
    i=0
    while [ -e "$FREIGABE" ] && [ "$i" -lt 600 ]; do sleep 0.1; i=$((i+1)); done ) >/dev/null 2>&1 &
  local i=0
  while [ ! -s "$beleg" ] && [ "$i" -lt 100 ]; do sleep 0.1; i=$((i+1)); done
  [ -s "$beleg" ] || fail "Testaufbau: die fremde Sperre fuer '$projekt' kam nicht zustande"
}
sperre_frei() { rm -f "$FREIGABE"; wait 2>/dev/null || true; }

mit_sperre() {  # <kommando...> — setzt LAUF_RC/LAUF_AUSGABE
  : > "$ARBEIT/log"
  LAUF_AUSGABE="$(env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" STATE_DIR="$STATE_DIR" \
    DENIED_LOG="$DENIED_LOG" TMPDIR="$SPERR_TMP" LOOPBACK_LOCK_WAIT=1 "$@" 2>&1)"
  LAUF_RC=$?
  merke_ausgabe "$LAUF_AUSGABE"
  pruefe_denied "mit_sperre $*"
}

gesund_test
fremde_sperre crm-test
mit_sperre bash "$ROOT/scripts/supabase-stack.sh" up test
[ "$LAUF_RC" != "0" ] && ok "up: belegte Sperre → nonzero" || fail "up bei belegter Sperre" "rc=0"
gleich 0 "$(grep -c '^docker '   "$ARBEIT/log")" "up: kein einziger docker-Aufruf vor der Sperre"
gleich 0 "$(grep -c '^supabase ' "$ARBEIT/log")" "up: kein einziger supabase-Aufruf vor der Sperre"

mit_sperre bash "$ROOT/scripts/supabase-stack.sh" down test
[ "$LAUF_RC" != "0" ] && ok "down: belegte Sperre → nonzero" || fail "down bei belegter Sperre" "rc=0"
gleich 0 "$(grep -c '^supabase ' "$ARBEIT/log")" "down: kein Stop bei belegter Sperre"

mit_sperre env CRM_TEST_ENV=1 TEST_DB_ADMIN_PASSWORD=egal bash "$ROOT/scripts/test-db.sh"
[ "$LAUF_RC" != "0" ] && ok "test-db.sh: belegte Sperre → nonzero" || fail "test-db.sh bei belegter Sperre" "rc=0"
gleich 0 "$(grep -c '^docker ' "$ARBEIT/log")" "test-db.sh: kein docker-Aufruf vor der Sperre"

# Die Sperre des einen Projekts darf das andere nicht behindern.
gesund_wiki
mit_sperre bash "$ROOT/scripts/supabase-stack.sh" up wiki
[ "$LAUF_RC" = "0" ] && ok "crm-test-Sperre behindert crm-wiki nicht" || fail "Sperre je Projekt" "rc=$LAUF_RC: $LAUF_AUSGABE"

sperre_frei

# Nach dem Freigeben laeuft es wieder.
gesund_test
mit_sperre bash "$ROOT/scripts/supabase-stack.sh" up test
[ "$LAUF_RC" = "0" ] && ok "freigegebene Sperre → Lauf geht wieder durch" || fail "nach Freigabe" "rc=$LAUF_RC: $LAUF_AUSGABE"

# Ein unbrauchbarer Wartewert ist ein Abbruch, kein stiller Standard.
gesund_test
LAUF_AUSGABE="$(env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" STATE_DIR="$STATE_DIR" \
  DENIED_LOG="$DENIED_LOG" TMPDIR="$SPERR_TMP" LOOPBACK_LOCK_WAIT=abc \
  bash "$ROOT/scripts/supabase-stack.sh" up test 2>&1)"; LAUF_RC=$?
merke_ausgabe "$LAUF_AUSGABE"
[ "$LAUF_RC" != "0" ] && ok "unbrauchbarer LOOPBACK_LOCK_WAIT → Absage" || fail "LOOPBACK_LOCK_WAIT-Pruefung" "rc=0"

# ═══ wiki-db.sh: EIN strikter Gateway-Check ═════════════════════════════════
echo
echo "── wiki-db.sh: Gateway strikt, eine einzige Inspektion ────────────────"

wiki_verbraucher() {  # <soll: 0=Guard besteht, 1=Absage> <beschreibung> <art> [<hostport>]
  gesund_wiki
  [ "$3" = "fehlt" ] \
    && { rm -f "$STATE_DIR/c-supabase_kong_crm-wiki" "$STATE_DIR/label-supabase_kong_crm-wiki" \
                "$STATE_DIR/running-supabase_kong_crm-wiki"
         printf 'id_supabase_db_crm-wiki supabase_db_crm-wiki\n' > "$STATE_DIR/inv-crm-wiki"
         printf 'supabase_db_crm-wiki\n' > "$STATE_DIR/all-names"; } \
    || container_setzen "$STATE_DIR" supabase_kong_crm-wiki crm-wiki 8000/tcp "${4:-54421}" crm-wiki-loopback "$3"
  verbraucher scripts/wiki-db.sh CRM_WIKI_ENV=1
  if [ "$1" = "0" ]; then
    case "$LAUF_AUSGABE" in
      *"wiki-guard: target verified"*) ok "$2" ;;
      *) fail "$2" "Guard hat nicht bestanden: $(printf '%s' "$LAUF_AUSGABE" | grep REFUSING | head -1)" ;;
    esac
  else
    if [ "$LAUF_RC" != "0" ] && ! log_enthaelt "docker exec"; then ok "$2"
    else fail "$2" "rc=$LAUF_RC, docker-exec-Aufrufe=$(grep -c 'docker exec' "$ARBEIT/log")"; fi
  fi
}

wiki_verbraucher 0 "gesunder Gateway → Guard besteht"                          ok
wiki_verbraucher 1 "Gateway fehlt → Absage vor jeder DB-Mutation"              fehlt
wiki_verbraucher 1 "zweiter veroeffentlichter Loopback-Port → Absage"          zweiter-port-loopback
wiki_verbraucher 1 "zweiter veroeffentlichter Wildcard-Port → Absage"          zweiter-port-wildcard
wiki_verbraucher 1 "mehrfach dieselbe 8000/tcp-Bindung → Absage"               doppelte-bindung
wiki_verbraucher 1 "Gateway auf falschem Port → Absage"                        ok 54999
wiki_verbraucher 0 "zusaetzlicher nicht veroeffentlichter Port → Guard besteht" zusatzport-null

# Genau EINE vollstaendige Inspektion des Gateways — die frühere Existenzprobe ist weg.
gesund_wiki
verbraucher scripts/wiki-db.sh CRM_WIKI_ENV=1
gleich 1 "$(grep -c '^docker inspect supabase_kong_crm-wiki$' "$ARBEIT/log")" \
  "wiki-db.sh inspiziert den Gateway genau EINMAL (keine zweite Sonde)"
gleich 1 "$(grep -c '^docker inspect supabase_db_crm-wiki$' "$ARBEIT/log")" \
  "wiki-db.sh inspiziert die Datenbank genau EINMAL"

# ═══ `supabase status` darf keine Schluessel ausschuetten ═══════════════════
echo
echo "── wiki-seed.mjs: keine Secrets in Fehlermeldungen ────────────────────"

# Zwei unverwechselbare Sentinel-Werte. Frueher druckte der Fehlerpfad die GANZE
# Ausgabe von `supabase status -o env` — also genau diese beiden Schluessel — und
# der wahrscheinlichste Fehler (Stapel laeuft nicht) war zugleich das Leck.
SENTINEL_ANON="SENTINEL-ANON-c4f1a9e2b7d8"
SENTINEL_SRV="SENTINEL-SERVICE-9b3e6d0a5c71"

seed_lauf() {  # <beschreibung> <status-rc> <status-ausgabe>
  local was="$1"
  zuruecksetzen
  printf '%s\n' "$3" > "$STATE_DIR/status-env"
  echo "$2" > "$STATE_DIR/status-rc"
  : > "$ARBEIT/log"
  SEED_OUT="$(env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" STATE_DIR="$STATE_DIR" \
    DENIED_LOG="$DENIED_LOG" node "$ROOT/scripts/wiki-seed.mjs" 2>"$ARBEIT/seed.err")"
  SEED_RC=$?
  SEED_ERR="$(cat "$ARBEIT/seed.err")"
  merke_ausgabe "$SEED_OUT$SEED_ERR"
  pruefe_denied "$was"
  [ "$SEED_RC" != "0" ] && ok "$was: nonzero" || fail "$was: nonzero" "rc=0"
  case "$SEED_OUT$SEED_ERR" in
    *"$SENTINEL_ANON"*|*"$SENTINEL_SRV"*)
      fail "$was: kein Sentinel in stdout/stderr" "ein Sentinel-Wert ist ausgegeben worden" ;;
    *) ok "$was: kein Sentinel in stdout/stderr" ;;
  esac
}

seed_lauf "fehlendes API_URL" 0 "ANON_KEY=\"$SENTINEL_ANON\"
SERVICE_ROLE_KEY=\"$SENTINEL_SRV\""

seed_lauf "status endet nonzero, Sentinel auf stdout" 1 "API_URL=\"http://127.0.0.1:54421\"
ANON_KEY=\"$SENTINEL_ANON\"
SERVICE_ROLE_KEY=\"$SENTINEL_SRV\""

seed_lauf "fehlendes SERVICE_ROLE_KEY" 0 "API_URL=\"http://127.0.0.1:54421\"
ANON_KEY=\"$SENTINEL_ANON\""

# Die Meldung soll den NAMEN des fehlenden Schluessels nennen — das ist der Zweck.
case "$SEED_ERR" in
  *"'SERVICE_ROLE_KEY' missing"*) ok "die Meldung nennt den fehlenden Schluesselnamen" ;;
  *) fail "die Meldung nennt den fehlenden Schluesselnamen" "$(printf '%s' "$SEED_ERR" | head -1)" ;;
esac

# Kein echtes Supabase erreicht: der Aufruf ging an die Attrappe. Gezaehlt wird
# der LETZTE Lauf — `zuruecksetzen` leert das Protokoll vor jedem seed_lauf.
gleich 1 "$(grep -c 'status -o env' "$ARBEIT/log")" "der status-Aufruf ging an die Attrappe, nicht an das echte Binary"

# ═══ Credentials: 0600 auch beim Ueberschreiben ═════════════════════════════
echo
echo "── Credentials-Datei: Modus wird neu gesetzt ──────────────────────────"

# Fingerabdruck der ECHTEN Datei vorher. Sie stammt aus einem frueheren Lauf und
# darf von diesem Test unter keinen Umstaenden beruehrt werden.
ECHT_CRED="$ROOT/supabase-wiki/.runtime/credentials.json"
ECHT_VORHER="$( [ -e "$ECHT_CRED" ] && printf '%s %s' "$(stat -c '%a %Y %s' "$ECHT_CRED")" "vorhanden" || printf 'nicht-vorhanden')"

CRED_DIR="$ARBEIT/creds"
rm -rf "$CRED_DIR"; mkdir -p "$CRED_DIR"
# Eine Datei aus einem "frueheren Lauf" mit zu weiten Rechten.
printf '{"alt":true}\n' > "$CRED_DIR/credentials.json"
chmod 0644 "$CRED_DIR/credentials.json"
gleich "644" "$(stat -c '%a' "$CRED_DIR/credentials.json")" "Ausgangslage: Datei liegt auf 0644"

CRED_LOG="$(node -e '
import("'"$ROOT"'/scripts/wiki-runtime-credentials.mjs").then(async (m) => {
  const p = m.writeRuntimeCredentials(process.argv[1], {
    email: "anna.beispiel@example.test", password: "SENTINEL-CRED-PW", userId: "u-1",
    anchor: "2026-08-02", apiUrl: "http://127.0.0.1:54421",
  });
  process.stdout.write(p);
})' "$CRED_DIR" 2>&1)"
gleich "600" "$(stat -c '%a' "$CRED_DIR/credentials.json")" "nach dem Schreiben: exakt 0600"

# Inhalt korrekt — geprueft wird der SCHLUESSELSATZ, nicht der Wert.
node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const soll=["email","password","userId","anchor","apiUrl"];
const ist=Object.keys(j).sort().join(",");
process.exit(ist===soll.sort().join(",") && j.email==="anna.beispiel@example.test" ? 0 : 1);
' "$CRED_DIR/credentials.json" && ok "Inhalt vollstaendig geschrieben (Schluesselsatz + E-Mail)"   || fail "Inhalt vollstaendig geschrieben"

case "$CRED_LOG" in
  *SENTINEL-CRED-PW*) fail "der Helfer gibt kein Passwort aus" "Passwort in der Ausgabe" ;;
  *) ok "der Helfer gibt kein Passwort aus" ;;
esac
merke_ausgabe "$CRED_LOG"

# Das echte Laufzeitverzeichnis wurde nicht angefasst — weder angelegt noch
# veraendert. Verglichen werden Modus, mtime und Groesse.
ECHT_NACHHER="$( [ -e "$ECHT_CRED" ] && printf '%s %s' "$(stat -c '%a %Y %s' "$ECHT_CRED")" "vorhanden" || printf 'nicht-vorhanden')"
gleich "$ECHT_VORHER" "$ECHT_NACHHER" "die echte supabase-wiki/.runtime/credentials.json blieb unberuehrt"

# ═══ Die Attrappen selbst sind streng ═══════════════════════════════════════
echo
echo "── Strenge der Attrappen (Mutationen) ─────────────────────────────────"

mutation() {  # <beschreibung> <werkzeug> <argumente...>
  local was="$1" werkzeug="$2"; shift 2
  : > "$DENIED_LOG"
  local rc=0
  env PATH="$STUB_DIR:$PATH" STUB_LOG="$ARBEIT/log" STATE_DIR="$STATE_DIR" \
    DENIED_LOG="$DENIED_LOG" "$werkzeug" "$@" >/dev/null 2>&1 || rc=$?
  if [ "$rc" = "99" ] && [ -s "$DENIED_LOG" ]; then ok "abgelehnt und vermerkt: $was"
  else fail "abgelehnt und vermerkt: $was" "rc=$rc, DENIED=$([ -s "$DENIED_LOG" ] && echo ja || echo nein)"; fi
  : > "$DENIED_LOG"
}

mutation "network create ohne --driver"        docker network create --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 --label crm.repo=crm-project --label crm.purpose=crm-test-stack crm-test-loopback
mutation "network create mit 0.0.0.0"          docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=0.0.0.0 --label crm.repo=crm-project --label crm.purpose=crm-test-stack crm-test-loopback
mutation "network create ohne Eigentuemerlabel" docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 --label crm.repo=fremd --label crm.purpose=crm-test-stack crm-test-loopback
mutation "network create mit falschem Zweck"   docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 --label crm.repo=crm-project --label crm.purpose=crm-wiki-stack crm-test-loopback
mutation "network create mit fremdem Netznamen" docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 --label crm.repo=crm-project --label crm.purpose=crm-test-stack fremdes-netz
mutation "docker ps mit anderem Format"        docker ps -a --filter label=com.supabase.cli.project=crm-test --format '{{.Names}}'
mutation "docker ps mit fremdem Projekt"       docker ps -a --filter label=com.supabase.cli.project=fremd --format '{{.ID}} {{.Names}}'
mutation "docker version ohne Format"          docker version
mutation "docker inspect mit fremdem Template" docker inspect -f '{{.Config.Image}}' supabase_db_crm-test
mutation "docker rm"                           docker rm supabase_db_crm-test
mutation "docker port (das alte Muster)"       docker port supabase_db_crm-test 5432/tcp
mutation "supabase start mit falschem Netz"    supabase --workdir supabase-test/runtime start --network-id crm-wiki-loopback
mutation "supabase start ohne --network-id"    supabase --workdir supabase-test/runtime start
mutation "supabase mit fremdem workdir"        supabase --workdir supabase/ start --network-id crm-test-loopback
mutation "supabase stop --no-backup"           supabase --workdir supabase-test/runtime stop --no-backup
mutation "supabase db reset"                   supabase --workdir supabase-test/runtime db reset

# ═══ Zusicherungen ueber die Attrappen selbst ═══════════════════════════════
echo
echo "── Zusicherungen ueber den Testaufbau ─────────────────────────────────"

# Kein absoluter Pfad, der an PATH und damit an den Attrappen vorbeifuehrt.
if grep -nE '(/usr/bin|/usr/local/bin|/bin|/opt/[^ ]*)/(docker|supabase)' \
     scripts/docker-loopback.sh scripts/supabase-stack.sh scripts/test-db.sh scripts/wiki-db.sh; then
  fail "kein absoluter docker/supabase-Pfad im Quelltext"
else
  ok "kein absoluter docker/supabase-Pfad — alle Aufrufe laufen ueber PATH"
fi

# Die Attrappen haben tatsaechlich gearbeitet, und kein Aufruf ist durchgefallen.
gesund_test
wrapper up test
if [ -s "$ARBEIT/log" ] && grep -q '^docker ' "$ARBEIT/log"; then
  ok "die Attrappen wurden wirklich aufgerufen (protokolliert)"
else fail "Attrappen wurden aufgerufen" "leeres Protokoll"; fi
kein_unerlaubter_aufruf && ok "kein Aufruf ausserhalb der Erlaubnisliste" \
  || fail "Erlaubnisliste" "$(printf '%s' "$LAUF_AUSGABE" | grep 'nicht erlaubter' | head -2)"

# Alle Zusicherungswerkzeuge existieren wirklich (siehe gleich() oben).
selbstpruefung

# Kein Teilprozess ist an einem Shell-Laufzeitfehler gescheitert. Genau so ist
# die `gleich`-Zusicherung im TERM-Fall monatelang unbemerkt durchgefallen: die
# Funktion war nicht definiert, die Zeile endete als "command not found", und
# gezaehlt wurde weder ok noch FAIL.
if grep -qE "command not found|unbound variable|syntax error|: not found" "$AUSGABEN"; then
  fail "keine Shell-Laufzeitfehler in den eingefangenen Ausgaben" \
       "$(grep -E "command not found|unbound variable|syntax error|: not found" "$AUSGABEN" | head -2)"
else
  ok "keine Shell-Laufzeitfehler in den eingefangenen Ausgaben"
fi

# Letzte Zusicherung: ueber die ganze Suite hinweg ist kein einziger Aufruf
# ausserhalb der Erlaubnisliste stehen geblieben.
if [ -s "$DENIED_LOG" ]; then
  fail "am Ende der Suite steht ein unerlaubter Aufruf im DENIED-Vermerk" "$(head -3 "$DENIED_LOG")"
else
  ok "DENIED-Vermerk ist am Ende der Suite leer"
fi

echo
printf 'bestanden %d, gescheitert %d\n' "$BESTANDEN" "$GESCHEITERT"
[ "$GESCHEITERT" = "0" ] || exit 1
