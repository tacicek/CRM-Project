#!/usr/bin/env bash
# Gemeinsame Pruefungen fuer die beiden lokalen Wegwerf-Stapel: dass sie
# ausschliesslich auf 127.0.0.1 veroeffentlicht werden, und dass sie das in
# einem eigens dafuer angelegten Docker-Netz tun.
#
# ── Wogegen das schuetzt ────────────────────────────────────────────────────
#
# Docker veroeffentlicht Ports standardmaessig auf 0.0.0.0 — also auf JEDER
# Schnittstelle des Rechners, inklusive WLAN und VPN. Ein lokaler Teststapel
# mit bekannten Zugangsdaten ist damit im ganzen Netz erreichbar.
#
# Die bisherigen Waechter haben genau das durchgelassen: `0.0.0.0` und `::`
# standen in test-db.sh und wiki-db.sh in der Liste der "lokalen" Hosts, und
# src/test/db-guard.ts hat diesen Irrtum als Spezifikation festgeschrieben.
# `0.0.0.0` ist das Gegenteil von loopback — es ist "ueberall".
#
# Dazu kamen zwei Ausleseprobleme:
#   - `docker port … | head -1` zeigt die ERSTE Bindung. Ein Container darf
#     mehrere haben; eine zweite auf 0.0.0.0 blieb damit unsichtbar.
#   - Bei Kong wurde ueberhaupt nur der Port verglichen, der Host gar nicht.
#
# Deshalb hier: KEIN `docker port`, KEIN Textparsen, KEIN `head -1`. Gelesen
# werden die echten Laufzeit-Bindungen aus `docker inspect` als JSON, und
# geprueft wird JEDE davon.
#
# ── Das Netz ────────────────────────────────────────────────────────────────
#
# Die Bindeadresse laesst sich pro Docker-Netz festlegen:
#
#   com.docker.network.bridge.host_binding_ipv4=127.0.0.1
#
# Jeder Stapel bekommt sein eigenes solches Netz. Die globale Docker-Einstellung
# (/etc/docker/daemon.json) wird NICHT angefasst — sie gilt fuer jeden Container
# auf diesem Rechner, auch fremde, und eine solche Aenderung gehoert nicht in
# ein Projekt-Repository.
#
# Diese Datei wird gesourct, nicht ausgefuehrt.

# Genau diese Bindeadresse ist erlaubt. IPv6-Loopback (::1) steht bewusst NICHT
# hier: ohne Beleg aus einem echten Lauf, dass die Werkzeugkette es sauber
# behandelt, waere das eine Annahme — und Annahmen sind in dieser Kette schon
# zweimal zu Loechern geworden.
LOOPBACK_HOST_IP="127.0.0.1"
LOOPBACK_BRIDGE_OPTION="com.docker.network.bridge.host_binding_ipv4"
LOOPBACK_LABEL_OWNER="crm.repo"
LOOPBACK_LABEL_PURPOSE="crm.purpose"
LOOPBACK_OWNER_VALUE="crm-project"

loopback_refuse() { echo "REFUSING (loopback-guard): $1" >&2; return 1; }

# ── Netz ────────────────────────────────────────────────────────────────────

# Prueft ein VORHANDENES Netz vollstaendig. Kein Teilerfolg: Name, Treiber,
# Bindeoption und beide Label muessen stimmen.
#
# Rueckgabe:
#   0  Netz vorhanden und korrekt
#   1  Netz vorhanden, aber falsch — oder unlesbar
#   2  Netz nicht vorhanden
#
# Ein Netz gleichen Namens, das die Pruefung nicht besteht, wird NICHT geloescht
# und NICHT umgebaut. Es koennte von etwas anderem benutzt werden, und ein
# Werkzeug, das fremde Docker-Netze entfernt, ist gefaehrlicher als das Problem,
# das es loesen soll. Stattdessen: anhalten und den Menschen entscheiden lassen.
loopback_verify_network() {  # <netz> <zweck>
  local netz="$1" zweck="$2" datei rc

  datei="$(mktemp)" || return 1
  if ! docker network inspect "$netz" >"$datei" 2>/dev/null; then
    rm -f "$datei"; return 2
  fi
  if [ ! -s "$datei" ]; then
    rm -f "$datei"; return 2
  fi

  LOOPBACK_NETZ="$netz" LOOPBACK_ZWECK="$zweck" \
  LOOPBACK_OPTION="$LOOPBACK_BRIDGE_OPTION" LOOPBACK_IP="$LOOPBACK_HOST_IP" \
  LOOPBACK_OWNER_KEY="$LOOPBACK_LABEL_OWNER" LOOPBACK_OWNER_VAL="$LOOPBACK_OWNER_VALUE" \
  LOOPBACK_ZWECK_KEY="$LOOPBACK_LABEL_PURPOSE" \
  python3 - "$datei" <<'PY'
import json, os, sys

def refuse(text):
    print("REFUSING (loopback-guard): " + text, file=sys.stderr)
    raise SystemExit(1)

netz = os.environ["LOOPBACK_NETZ"]
try:
    with open(sys.argv[1], encoding="utf-8") as fh:
        daten = json.load(fh)
except (ValueError, OSError, UnicodeDecodeError) as fehler:
    refuse("'docker network inspect %s' lieferte kein gueltiges JSON: %s" % (netz, fehler))

if not isinstance(daten, list) or len(daten) != 1:
    refuse("'docker network inspect %s' lieferte nicht genau einen Eintrag." % netz)

eintrag = daten[0]
if not isinstance(eintrag, dict):
    refuse("Netzbeschreibung von %s ist kein Objekt." % netz)

if eintrag.get("Name") != netz:
    refuse("Netz heisst '%s', erwartet '%s'." % (eintrag.get("Name"), netz))

if eintrag.get("Driver") != "bridge":
    refuse("Netz %s hat Treiber '%s', erwartet 'bridge'." % (netz, eintrag.get("Driver")))

optionen = eintrag.get("Options")
if not isinstance(optionen, dict):
    refuse("Netz %s fuehrt keine Options-Tabelle." % netz)
ist = optionen.get(os.environ["LOOPBACK_OPTION"])
if ist != os.environ["LOOPBACK_IP"]:
    refuse("Netz %s bindet auf '%s', erwartet '%s' (%s). Ein Netz ohne diese Option "
           "veroeffentlicht auf 0.0.0.0 — also im ganzen Netzwerk."
           % (netz, ist, os.environ["LOOPBACK_IP"], os.environ["LOOPBACK_OPTION"]))

label = eintrag.get("Labels")
if not isinstance(label, dict):
    refuse("Netz %s fuehrt keine Labels." % netz)
if label.get(os.environ["LOOPBACK_OWNER_KEY"]) != os.environ["LOOPBACK_OWNER_VAL"]:
    refuse("Netz %s traegt nicht das Eigentuemer-Label %s=%s — es stammt nicht aus "
           "diesem Repository und wird deshalb nicht benutzt."
           % (netz, os.environ["LOOPBACK_OWNER_KEY"], os.environ["LOOPBACK_OWNER_VAL"]))
if label.get(os.environ["LOOPBACK_ZWECK_KEY"]) != os.environ["LOOPBACK_ZWECK"]:
    refuse("Netz %s traegt Zweck-Label '%s', erwartet '%s'."
           % (netz, label.get(os.environ["LOOPBACK_ZWECK_KEY"]), os.environ["LOOPBACK_ZWECK"]))
PY
  rc=$?
  rm -f "$datei"
  return $rc
}

# Legt das Netz an. Nur aufzurufen, wenn loopback_verify_network mit 2 ("nicht
# vorhanden") geantwortet hat.
loopback_create_network() {  # <netz> <zweck>
  local netz="$1" zweck="$2"
  docker network create \
    --driver bridge \
    --opt "${LOOPBACK_BRIDGE_OPTION}=${LOOPBACK_HOST_IP}" \
    --label "${LOOPBACK_LABEL_OWNER}=${LOOPBACK_OWNER_VALUE}" \
    --label "${LOOPBACK_LABEL_PURPOSE}=${zweck}" \
    "$netz" >/dev/null
}

# Stellt sicher, dass das Netz existiert UND stimmt.
#
# Nach dem Anlegen wird erneut inspiziert, statt dem Erfolg des create-Aufrufs
# zu vertrauen: zwischen "nicht vorhanden" und "angelegt" kann ein zweiter
# Prozess dasselbe getan haben — moeglicherweise mit anderen Optionen. Was
# danach zaehlt, ist ausschliesslich das, was wirklich im Docker steht.
loopback_require_network() {  # <netz> <zweck>
  local netz="$1" zweck="$2" rc=0

  loopback_verify_network "$netz" "$zweck" || rc=$?
  case "$rc" in
    0) return 0 ;;
    2) : ;;                       # nicht vorhanden → anlegen
    *) loopback_refuse "Netz '$netz' existiert, entspricht aber nicht den Vorgaben.
  Es wird WEDER geloescht NOCH umgebaut — es koennte einem anderen Projekt
  gehoeren. Pruefe es von Hand:   docker network inspect $netz
  Wenn es wirklich verwaist ist:  docker network rm $netz"
       return 1 ;;
  esac

  echo "  Netz '$netz' fehlt — wird angelegt (bindet auf ${LOOPBACK_HOST_IP})."
  if ! loopback_create_network "$netz" "$zweck"; then
    # Kein Abbruch: ein paralleler Lauf koennte gerade gewonnen haben. Die
    # naechste Inspektion entscheidet, nicht dieser Rueckgabewert.
    echo "  (Anlegen fehlgeschlagen — pruefe, ob es inzwischen existiert.)"
  fi

  rc=0
  loopback_verify_network "$netz" "$zweck" || rc=$?
  case "$rc" in
    0) return 0 ;;
    2) loopback_refuse "Netz '$netz' liess sich nicht anlegen." ; return 1 ;;
    *) loopback_refuse "Netz '$netz' existiert nach dem Anlegen, entspricht aber nicht
  den Vorgaben (Wettlauf mit einem anderen Prozess?). Kein Start."
       return 1 ;;
  esac
}

# ── Gemeinsame Lebenszyklus-Sperre ──────────────────────────────────────────

# EINE Sperre je Projekt, geteilt zwischen dem Start/Stop-Wrapper und den beiden
# zerstoerenden Verbrauchern.
#
# Ohne sie gibt es ein Fenster: test-db.sh prueft die Identitaet des Containers,
# und WAEHREND es danach `DROP SCHEMA` ausfuehrt, faehrt ein `npm run test:db:down`
# den Stapel herunter oder ein `up` startet einen anderen. Die Pruefung galt dann
# fuer etwas anderes als das, was am Ende getroffen wird.
#
# ── Der Deskriptor ist 9 ────────────────────────────────────────────────────
# Er steht hier als Zahl im Code und nirgends als Konstante daneben: `exec` will
# an dieser Stelle eine wortwoertliche Ziffer, und eine Konstante, die dann doch
# nicht benutzt wird, waere ein Hinweis, der ins Leere zeigt.
#
# Warum 9 und nicht 8: 8 haelt baseline_read_lock (scripts/baseline-artifacts.sh)
# waehrend des Einspielens der Rechte-Schnappschuesse. Beide Sperren muessen
# gleichzeitig haltbar sein.
#
# LOOPBACK_LOCK_WAIT ist nur die WARTEZEIT, nicht die Frage, ob gesperrt wird.
# Die Tests setzen sie klein, damit eine belegte Sperre in Sekunden statt in
# Minuten sichtbar wird. Ein unbrauchbarer Wert ist ein Abbruch, kein Standard.
loopback_stack_lock() {  # <projekt>
  # Zwei Anweisungen, nicht eine: `local a="$1" b="…$a…"` expandiert ALLE Worte,
  # bevor es zuweist — `$a` waere dort unter `set -u` noch ungesetzt.
  local projekt="$1"
  local datei="${TMPDIR:-/tmp}/crm-stack-${projekt}.lock"
  local warte="${LOOPBACK_LOCK_WAIT:-300}"

  case "$warte" in
    ''|*[!0-9]*) loopback_refuse "LOOPBACK_LOCK_WAIT='$warte' ist keine Zahl."; return 1 ;;
  esac

  exec 9>"$datei" || { loopback_refuse "Sperrdatei '$datei' nicht schreibbar."; return 1; }
  if ! flock -w "$warte" 9; then
    loopback_refuse "ein anderer Lauf fuer '$projekt' haelt seit ueber ${warte}s die Sperre ($datei).
  Solange sie belegt ist, wird nichts gestartet, gestoppt oder geaendert."
    return 1
  fi
}

# ── Docker-Engine ───────────────────────────────────────────────────────────

# Ab welcher Engine-Fassung die Loopback-Veroeffentlichung wirklich haelt.
#
# Docker dokumentiert fuer aeltere Engines, dass auf localhost veroeffentlichte
# Ports aus demselben L2-Segment erreichbar bleiben konnten — die Bindeadresse
# stand dann zwar auf 127.0.0.1, schuetzte aber nicht. Ein Waechter, der genau
# diese Adresse prueft, wuerde dort das Falsche bestaetigen.
LOOPBACK_MIN_ENGINE_MAJOR=28

# Liest die Server-Fassung und entscheidet. Fail-closed: unlesbar, unerwartetes
# Format oder zu alt heisst NEIN, nicht "wahrscheinlich schon".
loopback_engine_ok() {
  local fassung major
  fassung="$(docker version --format '{{.Server.Version}}' 2>/dev/null)" || fassung=""
  if [ -z "$fassung" ]; then
    loopback_refuse "die Docker-Server-Fassung liess sich nicht lesen.
  Ohne sie ist unbekannt, ob eine Veroeffentlichung auf ${LOOPBACK_HOST_IP} wirklich
  auf diesen Rechner beschraenkt bleibt. Kein Start."
    return 1
  fi
  major="${fassung%%.*}"
  case "$major" in
    ''|*[!0-9]*)
      loopback_refuse "unerwartete Docker-Server-Fassung '$fassung' — Hauptversion nicht ablesbar. Kein Start."
      return 1 ;;
  esac
  if [ "$major" -lt "$LOOPBACK_MIN_ENGINE_MAJOR" ]; then
    loopback_refuse "Docker-Engine $fassung ist aelter als $LOOPBACK_MIN_ENGINE_MAJOR.
  Fuer aeltere Engines ist dokumentiert, dass auf localhost veroeffentlichte Ports
  aus demselben Netzsegment erreichbar bleiben konnten. Die Bindung auf
  ${LOOPBACK_HOST_IP} waere dann eine Zusicherung, die nicht traegt. Kein Start.
  (Das Herunterfahren eines Stapels bleibt davon unberuehrt — ein gefaehrlicher
  Stapel muss sich immer beenden lassen.)"
    return 1
  fi
}

# ── Container ───────────────────────────────────────────────────────────────

# Bestandsaufnahme eines CLI-Projekts: eine Zeile "<ID> <Name>" je Container,
# laufend UND gestoppt.
#
#   rc 0  Abfrage gelungen (die Ausgabe darf leer sein: dann gibt es keine)
#   rc 1  Abfrage MISSLUNGEN — es ist unbekannt, ob es Container gibt
#
# Der Unterschied zwischen den beiden ist der ganze Punkt. Vorher stand an den
# Aufrufstellen `$(… || true)`: eine fehlgeschlagene Abfrage sah damit aus wie
# "keine Container vorhanden" und fuehrte beim `up` zu einem frischen Start und
# beim `down` zu "nichts zu stoppen". Beides waere eine Aussage ueber etwas,
# das nie gemessen wurde.
#
# Die ID wird mitgefuehrt und fuer die Pruefungen benutzt: ein Name kann in der
# Zeit zwischen Bestandsaufnahme und Inspektion auf einen anderen Container
# zeigen, eine ID nicht.
loopback_project_containers() {  # <projekt>
  docker ps -a --filter "label=com.supabase.cli.project=$1" --format '{{.ID}} {{.Names}}' 2>/dev/null
}

# ALLE Containernamen des Rechners, einer je Zeile — ohne Filter.
#
#   rc 0  Abfrage gelungen (die Ausgabe darf leer sein)
#   rc 1  Abfrage MISSLUNGEN oder unplausibel
#
# Wozu: die Bestandsaufnahme oben filtert nach dem Projektlabel. Ein Container
# unter einem unserer Namen, der ein fremdes oder gar kein Label traegt, taucht
# dort nicht auf — und genau der ist der gefaehrliche Fall.
#
# Frueher wurde er mit `docker inspect <name> >/dev/null 2>&1` gesucht. Das ist
# eine Ja/Nein-Antwort auf eine Frage mit drei Antworten: `inspect` endet auch
# dann nonzero, wenn der Daemon nicht erreichbar ist, die Berechtigung fehlt
# oder der Aufruf abbricht. "Nonzero" hiess damit "gibt es nicht", und daraus
# folgte "also kann gestartet werden".
#
# Deshalb: EINE Abfrage, deren Gelingen sichtbar ist, und der Namensvergleich
# danach lokal. Ein Containername enthaelt keinen Leerraum; kommt in einer Zeile
# doch einer vor, ist die Antwort nicht die erwartete und die Abfrage gilt als
# misslungen.
loopback_container_names() {
  local ausgabe zeile
  ausgabe="$(docker ps -a --format '{{.Names}}' 2>/dev/null)" || return 1
  while IFS= read -r zeile; do
    [ -n "$zeile" ] || continue
    case "$zeile" in *[[:space:]]*) return 1 ;; esac
  done <<< "$ausgabe"
  printf '%s' "$ausgabe"
}

# Laufzustand mit drei Antworten:
#   0  laeuft
#   1  laeuft nachweislich nicht
#   2  UNBEKANNT (Abfrage fehlgeschlagen, unerwartete Antwort)
#
# Frueher gab es nur "laeuft / laeuft nicht", und ein fehlgeschlagenes
# `docker inspect` fiel in "laeuft nicht". Damit belegte ausgerechnet ein
# Lesefehler die Behauptung "gestoppt".
loopback_container_state() {  # <ref = ID oder Name>
  local ausgabe
  ausgabe="$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" || return 2
  case "$ausgabe" in
    true)  return 0 ;;
    false) return 1 ;;
    *)     return 2 ;;
  esac
}

# Die vollstaendige Identitaets- und Bindungspruefung eines Containers — aus
# GENAU EINEM `docker inspect`.
#
#   loopback_verify_container <ref> <name> <projekt> <netz> [<port> <hostport>]
#
# <ref> ist die ID aus der Bestandsaufnahme, <name> der dort gelesene Name; die
# Pruefung stellt sicher, dass beide zusammengehoeren.
#
# Warum aus einem einzigen Aufruf: vorher wurde das Projektlabel mit dem einen
# `docker inspect -f` gelesen und die Bindungen mit einem zweiten Aufruf.
# Zwischen beiden kann sich der Container austauschen — geprueft waere dann das
# Label des einen und die Bindung des anderen.
#
# Immer verlangt:
#   - genau ein Eintrag, gueltiges JSON
#   - .Name ist exakt der erwartete Container
#   - .State.Running ist true (ein gestoppter Container ist kein sicherer)
#   - .Config.Labels["com.supabase.cli.project"] ist exakt das erwartete Projekt
#   - .NetworkSettings.Networks besteht aus genau dem erwarteten Netz
#   - JEDE veroeffentlichte Bindung JEDES Ports liegt auf 127.0.0.1
#
# Das letzte ist neu und der Grund, warum diese Funktion auch fuer Container
# ohne Portvorgabe aufgerufen wird: geprueft wurde bisher nur der EINE Port, um
# den es ging. Ein zweiter, zusaetzlich veroeffentlichter Port desselben
# Containers — oder ein ganz anderer Container des Projekts — konnte daneben
# ungeprueft auf 0.0.0.0 stehen.
#
# Nicht veroeffentlichte Ports (Docker traegt dort `null` ein) sind in Ordnung:
# ein Container, der nur im Docker-Netz erreichbar ist, ist genau das, was hier
# erwuenscht ist.
#
# Mit <port> und <hostport> kommt die schaerfere Forderung dazu: dieser Port
# MUSS veroeffentlicht sein, und zwar auf genau diesem Hostport.
#
# Mit dem siebten Argument `strict` kommt die schaerfste: der Container darf dann
# GENAU EINE veroeffentlichte Bindung haben, naemlich diese. Kein zweiter
# veroeffentlichter Port, auch kein loopbacker, und auch keine Wiederholung
# derselben Bindung. Gedacht ist das fuer den Gateway: er ist die eine Tuer nach
# aussen, und ueber jede weitere ist nichts vereinbart. Nicht veroeffentlichte
# Ports (`null`) bleiben auch strikt erlaubt.
#
# Der Modus wird aus DEMSELBEN `docker inspect` entschieden wie alles andere —
# ein zweiter Aufruf waere wieder das TOCTOU-Fenster, das A.5.0.1 geschlossen
# hat. Ein unbekannter Moduswert ist ein Abbruch.
loopback_verify_container() {  # <ref> <name> <projekt> <netz> [<port> <hostport> [strict]]
  local ref="$1" name="$2" projekt="$3" netz="$4" port="${5:-}" hostport="${6:-}"
  local modus="${7:-}" datei rc

  datei="$(mktemp)" || return 1
  if ! docker inspect "$ref" >"$datei" 2>/dev/null; then
    rm -f "$datei"
    loopback_refuse "Container '$name' ($ref) liess sich nicht inspizieren."
    return 1
  fi

  LOOPBACK_REF="$ref" LOOPBACK_NAME="$name" LOOPBACK_PROJEKT="$projekt" \
  LOOPBACK_NETZ="$netz" LOOPBACK_PORT="$port" LOOPBACK_HOSTPORT="$hostport" \
  LOOPBACK_MODUS="$modus" LOOPBACK_IP="$LOOPBACK_HOST_IP" \
  python3 - "$datei" <<'PY'
import json, os, sys

def refuse(text):
    print("REFUSING (loopback-guard): " + text, file=sys.stderr)
    raise SystemExit(1)

name     = os.environ["LOOPBACK_NAME"]
projekt  = os.environ["LOOPBACK_PROJEKT"]
netz     = os.environ["LOOPBACK_NETZ"]
port     = os.environ["LOOPBACK_PORT"]
hostport = os.environ["LOOPBACK_HOSTPORT"]
erlaubt  = os.environ["LOOPBACK_IP"]
modus    = os.environ["LOOPBACK_MODUS"]

# Ein unbekannter Modus ist ein Abbruch, kein "dann eben der normale".
if modus not in ("", "strict"):
    refuse("unbekannter Pruefmodus '%s' fuer %s." % (modus, name))
strikt = modus == "strict"
if strikt and not port:
    refuse("strikter Modus fuer %s ohne Portvorgabe — dann gaebe es nichts, "
           "worauf sich 'genau diese eine Bindung' beziehen koennte." % name)

try:
    with open(sys.argv[1], encoding="utf-8") as fh:
        daten = json.load(fh)
except (ValueError, OSError, UnicodeDecodeError) as fehler:
    refuse("'docker inspect %s' lieferte kein gueltiges JSON: %s" % (name, fehler))

if not isinstance(daten, list) or len(daten) != 1 or not isinstance(daten[0], dict):
    refuse("'docker inspect %s' lieferte nicht genau einen Container." % name)
eintrag = daten[0]

ist_name = eintrag.get("Name")
if not isinstance(ist_name, str) or ist_name.lstrip("/") != name:
    refuse("Container heisst '%s', erwartet '%s'." % (ist_name, name))

zustand = eintrag.get("State")
if not isinstance(zustand, dict):
    refuse("%s fuehrt keinen State." % name)
if zustand.get("Running") is not True:
    refuse("%s laeuft nicht (State.Running = %r). Ein gestoppter Container ist kein "
           "sicherer Container — er belegt den Namen und kann jederzeit anlaufen."
           % (name, zustand.get("Running")))

konfig = eintrag.get("Config")
label = konfig.get("Labels") if isinstance(konfig, dict) else None
if not isinstance(label, dict):
    refuse("%s fuehrt keine Labels." % name)
ist_label = label.get("com.supabase.cli.project")
if ist_label != projekt:
    refuse("%s traegt das CLI-Projektlabel '%s', erwartet '%s'." % (name, ist_label, projekt))

netzeinstellungen = eintrag.get("NetworkSettings")
if not isinstance(netzeinstellungen, dict):
    refuse("%s fuehrt keine NetworkSettings." % name)

netze = netzeinstellungen.get("Networks")
if not isinstance(netze, dict) or not netze:
    refuse("%s haengt an keinem erkennbaren Netz." % name)
namen = sorted(netze)
if namen != [netz]:
    refuse("%s haengt an %s, erwartet ausschliesslich '%s'. Ein zusaetzliches Netz kann "
           "eine eigene Bindeadresse mitbringen."
           % (name, ", ".join("'%s'" % n for n in namen), netz))

ports = netzeinstellungen.get("Ports")
if not isinstance(ports, dict):
    refuse("%s fuehrt keine Ports-Tabelle." % name)

# ── JEDER veroeffentlichte Port, nicht nur der gefragte ─────────────────────
for p in sorted(ports):
    bindungen = ports[p]
    if bindungen is None:
        continue                      # exponiert, aber nicht veroeffentlicht: in Ordnung
    if not isinstance(bindungen, list):
        refuse("%s: die Bindungen von %s sind keine Liste." % (name, p))
    if strikt and bindungen and p != port:
        # Der Gateway soll GENAU eine Tuer haben. Ein zweiter veroeffentlichter
        # Port waere auch dann eine, wenn er auf 127.0.0.1 laege — und ueber ihn
        # ist nichts vereinbart.
        refuse("%s: strikt — ausser %s ist zusaetzlich %s veroeffentlicht." % (name, port, p))
    for nr, bindung in enumerate(bindungen, 1):
        if not isinstance(bindung, dict):
            refuse("%s: Bindung %d von %s ist kein Objekt." % (name, nr, p))
        host_ip = bindung.get("HostIp")
        if host_ip != erlaubt:
            refuse("%s: Bindung %d von %s liegt auf '%s', erlaubt ist ausschliesslich "
                   "'%s'. '0.0.0.0', '::' und ein leeres Feld bedeuten JEDE Schnittstelle "
                   "des Rechners — das Gegenteil von loopback."
                   % (name, nr, p, "" if host_ip is None else host_ip, erlaubt))

# ── der ausdruecklich geforderte Port ───────────────────────────────────────
if port:
    bindungen = ports.get(port)
    if bindungen is None:
        refuse("%s veroeffentlicht %s nicht." % (name, port))
    if not isinstance(bindungen, list) or not bindungen:
        refuse("%s: %s hat keine veroeffentlichte Bindung." % (name, port))
    if strikt and len(bindungen) != 1:
        # Auch zwei IDENTISCHE Bindungen sind hier ein Fund: eine Wiederholung,
        # die niemand angeordnet hat, ist ein Zustand, ueber den nichts bekannt
        # ist — und "sieht harmlos aus" ist in dieser Kette schon oft genug
        # danebengelegen.
        refuse("%s: strikt — %s hat %d Bindungen, erwartet genau eine."
               % (name, port, len(bindungen)))
    for nr, bindung in enumerate(bindungen, 1):
        if bindung.get("HostPort") != hostport:
            refuse("%s: Bindung %d von %s liegt auf Hostport '%s', erwartet '%s'."
                   % (name, nr, port, bindung.get("HostPort"), hostport))

if port:
    print("    %s: laeuft, Projekt %s, Netz %s, %s -> %s:%s" % (name, projekt, netz, port, erlaubt, hostport))
else:
    print("    %s: laeuft, Projekt %s, Netz %s, keine Bindung ausserhalb %s" % (name, projekt, netz, erlaubt))
PY
  rc=$?
  rm -f "$datei"
  return $rc
}
