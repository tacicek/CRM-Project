#!/usr/bin/env bash
# Startet und stoppt die beiden lokalen Wegwerf-Stapel — und nur die.
#
#   bash scripts/supabase-stack.sh up   test|wiki
#   bash scripts/supabase-stack.sh down test|wiki
#
# ── Warum es diesen Wrapper gibt ────────────────────────────────────────────
#
# `supabase start` veroeffentlicht die Ports so, wie Docker es voreingestellt
# tut: auf 0.0.0.0, also auf jeder Schnittstelle des Rechners. Ein Teststapel
# mit bekanntem Passwort ist damit im WLAN und im VPN erreichbar. Die
# Bindeadresse laesst sich nicht am Aufruf setzen, wohl aber am NETZ:
#
#   docker network create --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1
#
# und `supabase start --network-id <netz>` legt den Stapel dort hinein. Genau
# das macht dieser Wrapper — und prueft anschliessend nach, ob es gewirkt hat.
#
# Die globale Docker-Einstellung waere der kuerzere Weg und ist deshalb NICHT
# genommen worden: sie gilt fuer jeden Container auf dem Rechner, auch fremde,
# und eine solche Aenderung gehoert nicht in ein Projekt-Repository.
#
# ── Was er ueber vorhandene Stapel tut, genau ───────────────────────────────
#
# UP findet drei Lagen vor und behandelt sie verschieden:
#
#   kein Container dieses Projekts   → frischer Start
#   vollstaendiger Stapel            → GEPRUEFT und, wenn er besteht,
#                                      weiterverwendet (nicht neu gestartet)
#   halber Stapel / fremdes Label    → Absage. Nichts wird gestoppt, nichts
#                                      geloescht, nichts uebernommen.
#
# Automatisch gestoppt wird ausschliesslich der Stapel, den DIESER Lauf gerade
# selbst gestartet hat, und nur wenn die Nachpruefung scheitert. Es gibt keinen
# dauerhaften Beleg darueber, wer einen laufenden Stapel einmal gestartet hat —
# also wird auch nicht behauptet, der Wrapper stoppe "nur Selbstgestartetes".
#
# DOWN ist der ausdrueckliche Wunsch des Menschen und stoppt den geprueften
# Projekt-Stapel — auch einen unsicher veroeffentlichten. Genau der muss sich
# beenden lassen; eine Bindungspruefung als Vorbedingung wuerde den
# gefaehrlichen Fall aussperren. Geprueft wird vorher trotzdem: Projekt,
# Arbeitsverzeichnis, exakte Containernamen und das CLI-Projektlabel.
#
# Netze werden nie automatisch geloescht.

set -euo pipefail
cd "$(dirname "$0")/.."

. scripts/docker-loopback.sh

refuse() { echo "REFUSING (stack-guard): $1" >&2; exit 2; }

AKTION="${1:-}"
STAPEL="${2:-}"

# ── Feste Zuordnung ─────────────────────────────────────────────────────────
# Projekt, Arbeitsverzeichnis und Netz stehen hier zusammen und werden gegen die
# Konfiguration gegengeprueft. Ein Tippfehler in der einen oder der anderen
# Datei fuehrt damit zur Absage, nicht zu einem Stapel im falschen Netz.
case "$STAPEL" in
  test)
    WORKDIR="supabase-test/runtime"
    PROJEKT="crm-test"
    NETZ="crm-test-loopback"
    ZWECK="crm-test-stack"
    ;;
  wiki)
    WORKDIR="supabase-wiki/runtime"
    PROJEKT="crm-wiki"
    NETZ="crm-wiki-loopback"
    ZWECK="crm-wiki-stack"
    ;;
  *)
    echo "Aufruf: bash scripts/supabase-stack.sh up|down test|wiki" >&2
    exit 2 ;;
esac

CONFIG="$WORKDIR/supabase/config.toml"
[ -f "$CONFIG" ] || refuse "Konfiguration '$CONFIG' fehlt."

CONFIG_PROJEKT="$(grep -E '^project_id[[:space:]]*=' "$CONFIG" | head -1 | cut -d'"' -f2)"
[ "$CONFIG_PROJEKT" = "$PROJEKT" ] \
  || refuse "'$CONFIG' nennt project_id '$CONFIG_PROJEKT', dieser Wrapper erwartet '$PROJEKT'."

konfig_port() {  # <abschnitt>
  awk -v s="[$1]" '$0==s{f=1;next} /^\[/{f=0} f && /^port[[:space:]]*=/{print $3; exit}' "$CONFIG"
}

# Portpruefung VOR allem anderen — vor der Sperre, vor dem ersten docker- oder
# supabase-Aufruf. Eine Konfiguration, die den Zielport nicht eindeutig nennt,
# ist kein Zustand, in dem irgendetwas gestartet werden darf.
port_pruefen() {  # <name> <wert>
  case "$2" in
    ''|*[!0-9]*) refuse "'$CONFIG': $1 ist '$2' — keine Zahl. Ohne einen eindeutigen
  Port laesst sich nicht pruefen, wohin veroeffentlicht wird." ;;
  esac
  if [ "$2" -lt 1 ] || [ "$2" -gt 65535 ]; then
    refuse "'$CONFIG': $1 ist $2 und liegt ausserhalb von 1-65535."
  fi
}

DB_PORT="$(konfig_port db)"

# Der Name ist GATEWAY_PORT, weil der Wert NICHT sagt, ob PostgREST laeuft.
#
# Im ersten echten Lauf (A.5.1a) startete die CLI 2.98.2 bei `[api] enabled =
# false` trotzdem einen Gateway-Container und veroeffentlichte 8000/tcp auf dem
# Standard-Port 54321 — dem Port des WURZELPROJEKTS, der in dieser Konfiguration
# nirgends vorkommt. Der alte Name legte nahe, ein leerer Wert bedeute "kein
# Gateway"; er bedeutete in Wahrheit "Gateway auf einem Port, den niemand
# aufgeschrieben hat".
#
# Deshalb ist der Port jetzt Pflicht, fuer BEIDE Stapel, und wird so streng
# geprueft wie der DB-Port.
GATEWAY_PORT="$(konfig_port api)"

# Die Pruefung selbst haengt an `up` und NICHT an dieser Stelle.
#
# Vorher lief sie hier, also vor der Verzweigung — und damit sperrte eine
# fehlerhafte Portangabe auch das HERUNTERFAHREN aus. Das ist genau verkehrt
# herum: ein Stapel, dessen Konfiguration nicht stimmt, ist ein Stapel, den man
# besonders dringend beenden koennen muss. `down` braucht die Ports ohnehin
# nicht; es arbeitet ueber Projektlabel, Containernamen und Bestandsaufnahme.
ports_pruefen_fuer_start() {
  port_pruefen "[db] port" "$DB_PORT"
  port_pruefen "[api] port (Gateway)" "$GATEWAY_PORT"
  if [ "$GATEWAY_PORT" = "$DB_PORT" ]; then
    refuse "'$CONFIG': Gateway- und DB-Port sind beide $DB_PORT."
  fi
}

DB_CONTAINER="supabase_db_${PROJEKT}"
KONG_CONTAINER="supabase_kong_${PROJEKT}"

# ── Nur ein Lauf pro Projekt ────────────────────────────────────────────────
# Zwei gleichzeitige Laeufe wuerden einander den Zustand unter den Fuessen
# wegziehen: der eine inventarisiert, waehrend der andere startet, und beide
# zoegen falsche Schluesse. Dieselbe Sperre halten test-db.sh und wiki-db.sh
# waehrend ihres zerstoerenden Teils — sonst koennte zwischen deren Pruefung und
# dem `DROP SCHEMA` ein `down` oder ein zweites `up` dazwischenfahren.
loopback_stack_lock "$PROJEKT" || exit 2

# ── Bestandsaufnahme ────────────────────────────────────────────────────────
# Gestoppte Container zaehlen mit. Ein gestoppter Container ist nicht "weg": er
# belegt den Namen und kann jederzeit wieder anlaufen.
#
# Die Abfrage kann DREI Dinge bedeuten, und sie werden auseinandergehalten:
# gelungen+leer, gelungen+gefunden, und misslungen. Der dritte Fall wird nirgends
# zu "es gibt nichts" gerundet — vorher stand hier `$(… || true)`, und ein
# fehlgeschlagenes `docker ps` sah damit aus wie ein sauberer, leerer Rechner.
bestand_lesen() {  # setzt BESTAND; rc 1 wenn die Abfrage misslang
  BESTAND="$(loopback_project_containers "$PROJEKT")" || return 1
}

# Namensinventar des ganzen Rechners, EINE Abfrage, danach lokal verglichen.
#
# Frueher stand hier `docker inspect "$1" >/dev/null 2>&1` als Ja/Nein-Frage.
# `inspect` endet aber auch dann nonzero, wenn der Daemon nicht erreichbar ist
# oder die Berechtigung fehlt — "nonzero" hiess damit "existiert nicht", und
# daraus folgte "also darf gestartet werden". Drei Antworten in zwei Faechern.
namen_lesen() {  # setzt NAMEN; rc 1 wenn die Abfrage misslang oder unplausibel war
  NAMEN="$(loopback_container_names)" || return 1
}

name_vorhanden() {  # <name>; setzt voraus, dass namen_lesen gelaufen ist
  local rc=0
  printf '%s\n' "$NAMEN" | grep -qxF -- "$1" || rc=$?
  case "$rc" in
    0) return 0 ;;   # vorhanden
    1) return 1 ;;   # nicht vorhanden
    *) return 2 ;;   # grep selbst gescheitert → unbekannt
  esac
}

# Prueft beide erwarteten Namen gegen ein frisch gelesenes Inventar.
#   rc 0  beide nachweislich abwesend
#   rc 1  mindestens einer vorhanden — Name wird in FREMDER_NAME hinterlegt
#   rc 2  unbekannt (Abfrage misslungen)
namen_frei() {
  FREMDER_NAME=""
  namen_lesen || return 2
  local c rc
  for c in "$DB_CONTAINER" "$KONG_CONTAINER"; do
    rc=0; name_vorhanden "$c" || rc=$?
    case "$rc" in
      0) FREMDER_NAME="$c"; return 1 ;;
      1) : ;;
      *) return 2 ;;
    esac
  done
  return 0
}

# Prueft den GANZEN Stapel, nicht nur die zwei bekannten Container.
#
# Frueher wurden ausschliesslich DB und Kong angesehen. Ein drittes Container
# desselben Projekts — auth, rest, storage — konnte daneben auf 0.0.0.0
# veroeffentlicht sein, und der Waechter sagte trotzdem "sicher". Jetzt geht
# jeder Eintrag der Bestandsaufnahme durch dieselbe Pruefung; DB und Kong
# zusaetzlich mit der Forderung nach ihrem exakten Hostport.
stapel_pruefen() {
  local id name db_ref="" kong_ref=""

  if ! bestand_lesen; then
    echo "REFUSING (stack-guard): die Bestandsaufnahme fuer '$PROJEKT' ist fehlgeschlagen." >&2
    echo "  Ob und was laeuft, ist damit unbekannt — es wird nichts angenommen." >&2
    return 1
  fi
  if [ -z "$BESTAND" ]; then
    echo "REFUSING (stack-guard): kein Container des Projekts '$PROJEKT' vorhanden." >&2
    return 1
  fi

  while read -r id name; do
    [ -n "$name" ] || continue
    case "$name" in
      "$DB_CONTAINER")   db_ref="$id" ;;
      "$KONG_CONTAINER") kong_ref="$id" ;;
    esac
  done <<< "$BESTAND"

  if [ -z "$db_ref" ]; then
    echo "REFUSING (stack-guard): '$DB_CONTAINER' ist nicht in der Bestandsaufnahme." >&2
    return 1
  fi
  if [ -z "$kong_ref" ]; then
    # Der Gateway-Container ist NICHT optional — auch nicht bei `[api] enabled =
    # false`. Genau dort startete die CLI 2.98.2 im ersten echten Lauf einen und
    # veroeffentlichte ihn auf einem Port, den niemand aufgeschrieben hatte.
    #
    # Fehlt er, gibt es zwei Moeglichkeiten, und beide sind ein Halt: entweder
    # ist der Stapel unvollstaendig, oder die CLI hat den Gateway umbenannt.
    # Im zweiten Fall soll dieser Waechter stehenbleiben und nicht raten —
    # eine Liste moeglicher kuenftiger Namen waere wieder eine Vermutung.
    echo "REFUSING (stack-guard): '$KONG_CONTAINER' fehlt in der Bestandsaufnahme." >&2
    echo "  Der Gateway-Container ist Pflicht (Port $GATEWAY_PORT). Entweder ist der" >&2
    echo "  Stapel unvollstaendig, oder die CLI benutzt einen anderen Gateway-Namen —" >&2
    echo "  in beiden Faellen wird hier nicht weitergemacht." >&2
    return 1
  fi

  while read -r id name; do
    [ -n "$name" ] || continue
    case "$name" in
      "$DB_CONTAINER")   loopback_verify_container "$id" "$name" "$PROJEKT" "$NETZ" "5432/tcp" "$DB_PORT" || return 1 ;;
      # Der Gateway faellt NIEMALS in den generischen Zweig unten. Dort gilt nur
      # "keine Bindung ausserhalb 127.0.0.1" — und genau damit waere der
      # beobachtete Standard-Port 54321 durchgegangen, weil auch er loopback ist.
      # `strict`: der Gateway ist die EINE Tuer nach aussen. Genau eine
      # veroeffentlichte Bindung, genau dieser Port, kein zweiter
      # veroeffentlichter Port — auch kein loopbacker.
      "$KONG_CONTAINER") loopback_verify_container "$id" "$name" "$PROJEKT" "$NETZ" "8000/tcp" "$GATEWAY_PORT" strict || return 1 ;;
      *)                 loopback_verify_container "$id" "$name" "$PROJEKT" "$NETZ" || return 1 ;;
    esac
  done <<< "$BESTAND"
}

# Beleg, dass nach einem Stop nichts mehr laeuft.
#
#   rc 0  bewiesen: die Bestandsaufnahme gelang, und jeder gefundene Container
#         wurde erfolgreich als "nicht laufend" gelesen
#   rc 1  nicht bewiesen — laeuft noch etwas, oder ein Zustand war unlesbar
#
# Gemessen wird ueber die Bestandsaufnahme des ganzen Projekts, nicht ueber die
# zwei Namen, die dieses Skript kennt.
nachweis_gestoppt() {
  local id name rc laufend="" unbekannt="" geblieben=""

  if ! bestand_lesen; then
    echo "!! die Bestandsaufnahme nach dem Stop ist fehlgeschlagen." >&2
    echo "!! Ob noch etwas laeuft, ist damit UNBEKANNT." >&2
    return 1
  fi
  if [ -z "$BESTAND" ]; then
    echo "  kein Container des Projekts '$PROJEKT' mehr vorhanden."
    return 0
  fi

  while read -r id name; do
    [ -n "$name" ] || continue
    rc=0; loopback_container_state "$id" || rc=$?
    case "$rc" in
      0) laufend="$laufend $name" ;;
      1) geblieben="$geblieben $name" ;;
      *) unbekannt="$unbekannt $name" ;;
    esac
  done <<< "$BESTAND"

  if [ -n "$laufend" ] || [ -n "$unbekannt" ]; then
    [ -n "$laufend" ]   && echo "!! laeuft noch:$laufend" >&2
    [ -n "$unbekannt" ] && echo "!! Zustand nicht lesbar:$unbekannt" >&2
    return 1
  fi

  # Gestoppte Reste sind KEIN Fehler: die Zusicherung lautet "nichts von diesem
  # Projekt laeuft", und ein gestoppter Container bedient niemanden. Gemeldet
  # werden sie trotzdem — und der naechste `up` verweigert wegen ihnen den
  # Dienst, was die richtige Stelle ist, sie wegzuraeumen.
  echo "  gestoppt. Es bleiben gestoppte Reste:$geblieben"
  echo "  (kein Fehler — aber der naechste 'up' verweigert deswegen; dann:"
  echo "   docker rm$geblieben )"
}

# ── down ────────────────────────────────────────────────────────────────────
if [ "$AKTION" = "down" ]; then
  # Eine misslungene Bestandsaufnahme ist KEIN "nichts zu stoppen".
  if ! bestand_lesen; then
    # Der Text vermeidet bewusst die Wendung der Erfolgsmeldung weiter unten:
    # eine Pruefung, die auf diese Meldung sieht, darf nicht an einer Erklaerung
    # haengenbleiben.
    refuse "die Bestandsaufnahme fuer '$PROJEKT' ist fehlgeschlagen.
  Ob etwas laeuft, ist damit unbekannt — es wird weder gestoppt noch eine Aussage
  darueber gemacht, ob ueberhaupt etwas vorhanden ist."
  fi

  # Namensinventar: eine Abfrage, deren Gelingen sichtbar ist.
  if ! namen_lesen; then
    refuse "das Containernamen-Inventar liess sich nicht lesen.
  Ob unter '$DB_CONTAINER' oder '$KONG_CONTAINER' etwas laeuft, ist damit unbekannt —
  es wird weder gestoppt noch eine Aussage darueber gemacht, ob etwas vorhanden ist."
  fi

  # Fremde Container unter unseren Namen: anhalten. Der Name allein beweist
  # nichts; das Projektlabel schon.
  VORHANDEN=0
  for c in "$DB_CONTAINER" "$KONG_CONTAINER"; do
    NRC=0; name_vorhanden "$c" || NRC=$?
    case "$NRC" in
      0) VORHANDEN=1
         L="$(docker inspect -f '{{ index .Config.Labels "com.supabase.cli.project" }}' "$c" 2>/dev/null || true)"
         [ "$L" = "$PROJEKT" ] || refuse "'$c' traegt das CLI-Projektlabel '$L', erwartet '$PROJEKT'.
  Das ist ein fremder Container unter einem unserer Namen. Er wird nicht gestoppt." ;;
      1) : ;;
      *) refuse "der Namensvergleich fuer '$c' ist fehlgeschlagen — Zustand unbekannt." ;;
    esac
  done

  if [ -z "$BESTAND" ] && [ "$VORHANDEN" = "0" ]; then
    echo "Kein Container des Projekts '$PROJEKT' vorhanden — nichts zu stoppen."
    exit 0
  fi

  echo "==> stoppe '$PROJEKT' (Arbeitsverzeichnis $WORKDIR)"
  STOP_RC=0
  supabase --workdir "$WORKDIR" stop || STOP_RC=$?

  if ! nachweis_gestoppt; then
    echo "!! '$PROJEKT' ist NICHT nachweislich gestoppt." >&2
    echo "!! Von Hand pruefen:  docker ps --filter label=com.supabase.cli.project=$PROJEKT" >&2
    exit 3
  fi
  if [ "$STOP_RC" -ne 0 ]; then
    # Es laeuft nichts mehr, aber der Stop hat sich beschwert. Das wird gemeldet,
    # nicht verschwiegen — und es wird nicht "gestoppt" darueber geschrieben.
    echo "!! 'supabase stop' endete mit rc=$STOP_RC. Es laeuft zwar nichts mehr," >&2
    echo "!! aber der Aufruf war nicht sauber — bitte die Ausgabe oben lesen." >&2
    exit 3
  fi

  # Ueber das Netz wird hier NICHTS behauptet: auf diesem Weg wird es nicht
  # inspiziert. Es bleibt einfach stehen, und der naechste `up` prueft es.
  echo "Stapel '$PROJEKT' gestoppt. Netz '$NETZ' bleibt stehen; der naechste 'up' prueft es erneut."
  exit 0
fi

[ "$AKTION" = "up" ] || { echo "Aufruf: bash scripts/supabase-stack.sh up|down test|wiki" >&2; exit 2; }

# ── 0. Portvertrag ──────────────────────────────────────────────────────────
# Vor der Engine-Frage, vor der CLI-Frage, vor dem Netz — vor jedem docker- und
# supabase-Aufruf. Wer nicht sagen kann, wohin veroeffentlicht werden soll, darf
# nichts starten.
ports_pruefen_fuer_start

# ── 1. Engine-Fassung ───────────────────────────────────────────────────────
# Vor allem anderen: taugt diese Docker-Engine ueberhaupt fuer die Zusicherung,
# die hier gegeben werden soll?
loopback_engine_ok || exit 2

# ── 2. Kann die installierte CLI ueberhaupt --network-id? ───────────────────
# Ohne diese Option landet der Stapel im Standardnetz und damit auf 0.0.0.0.
# Das faellt zwar spaeter bei der Bindungspruefung auf, aber dann laeuft er
# schon — besser vorher fragen.
if ! supabase start --help 2>/dev/null | grep -q -- '--network-id'; then
  refuse "die installierte Supabase-CLI kennt '--network-id' nicht.
  Ohne diese Option laesst sich die Bindeadresse nicht auf ${LOOPBACK_HOST_IP} festlegen,
  und der Stapel waere im ganzen Netzwerk erreichbar. Bitte die CLI aktualisieren
  ('supabase --version' zeigt die installierte Fassung)."
fi

# ── 3. Netz pruefen oder anlegen ────────────────────────────────────────────
loopback_require_network "$NETZ" "$ZWECK" || exit 2

# ── 4. Bestandsaufnahme VOR dem Start ───────────────────────────────────────
if ! bestand_lesen; then
  refuse "die Bestandsaufnahme fuer '$PROJEKT' ist fehlgeschlagen.
  Ob schon etwas laeuft, ist damit unbekannt. Ein frischer Start wuerde auf
  moeglicherweise vorhandene Container treffen — es wird nichts gestartet und
  nichts gestoppt."
fi

if [ -n "$BESTAND" ]; then
  echo "==> Container des Projekts '$PROJEKT' gefunden:"
  printf '      %s\n' "$BESTAND"

  if ! stapel_pruefen; then
    refuse "der vorgefundene Stapel '$PROJEKT' besteht die Pruefung nicht (Grund oben).
  Er wird NICHT automatisch gestoppt oder geloescht. Ausdruecklich beenden mit:
      npm run ${STAPEL}:db:down"
  fi

  echo "Vorgefundener Stapel '$PROJEKT' ist geprueft und wird weiterverwendet."
  exit 0
fi

# Die Bestandsaufnahme filtert nach dem Projektlabel. Ein Container unter einem
# unserer Namen, der KEIN oder ein fremdes Label traegt, taucht dort nicht auf —
# und `supabase start` liefe genau in diesen Namenskonflikt. Also getrennt und
# labelunabhaengig nachsehen, und zwar mit drei moeglichen Antworten.
FREI_RC=0
namen_frei || FREI_RC=$?
case "$FREI_RC" in
  0) : ;;   # beide Namen nachweislich frei → weiter
  1) refuse "'$FREMDER_NAME' existiert bereits, taucht aber nicht in der Bestandsaufnahme
  des Projekts '$PROJEKT' auf — er traegt also ein fremdes oder gar kein Projektlabel.
  Es wird weder gestartet noch etwas gestoppt oder geloescht. Von Hand ansehen:
      docker inspect $FREMDER_NAME" ;;
  *) refuse "das Containernamen-Inventar liess sich nicht lesen.
  Ob '$DB_CONTAINER' oder '$KONG_CONTAINER' bereits existiert, ist damit unbekannt.
  Ein Start wuerde moeglicherweise in einen Namenskonflikt laufen — es wird nichts
  gestartet und nichts gestoppt." ;;
esac

# ── 5. Frischer Start ───────────────────────────────────────────────────────
# Die Rueckabwicklung wird VOR dem Start scharf gemacht. Vorher stand sie
# dahinter — und `set -e` beendete das Skript bei einem fehlgeschlagenen Start
# sofort, sodass halb angelegte Container einfach stehen blieben.
AUFRAEUMEN_SCHARF=1

aufraeumen() {  # $1 = Ersatz-Rueckgabewert, falls der urspruengliche 0 war
  local urspruenglich=$?
  local ersatz="${1:-2}"

  # Idempotent: der Signal-Handler und der EXIT-Handler feuern nacheinander.
  [ "$AUFRAEUMEN_SCHARF" = "1" ] || return 0
  AUFRAEUMEN_SCHARF=0

  local ende="$urspruenglich"
  [ "$ende" = "0" ] && ende="$ersatz"

  echo "==> Rueckabwicklung: stoppe '$PROJEKT' (von diesem Lauf gestartet)" >&2
  local stop_rc=0
  supabase --workdir "$WORKDIR" stop || stop_rc=$?

  # Nachmessen statt glauben. Ein `stop`, dessen Wirkung niemand prueft, ist
  # eine Behauptung. Gemessen wird ueber die Bestandsaufnahme des ganzen
  # Projekts — nicht ueber die zwei Namen, die dieses Skript kennt.
  if ! nachweis_gestoppt; then
    echo "!! ACHTUNG: der Stapel ist NICHT nachweislich gestoppt." >&2
    echo "!! Es laeuft moeglicherweise noch etwas. Bitte von Hand pruefen:" >&2
    echo "!!     docker ps --filter label=com.supabase.cli.project=$PROJEKT" >&2
    echo "!!     npm run ${STAPEL}:db:down" >&2
    exit 3
  fi
  if [ "$stop_rc" -ne 0 ]; then
    echo "!! 'supabase stop' endete mit rc=$stop_rc. Es laeuft zwar nichts mehr," >&2
    echo "!! aber der Aufruf war nicht sauber — bitte die Ausgabe oben lesen." >&2
    exit 3
  fi

  echo "==> zurueckgerollt: '$PROJEKT' gestoppt. Das Netz '$NETZ' bleibt bestehen." >&2
  exit "$ende"
}

trap 'aufraeumen 2'   EXIT
trap 'aufraeumen 130' HUP INT TERM

echo "==> starte '$PROJEKT' im Netz '$NETZ'"
# Rueckgabewert ausdruecklich einfangen. Unter `set -e` waere das Skript hier
# sonst wortlos ausgestiegen — mit dem EXIT-Trap zwar noch aufgeraeumt, aber
# ohne die Meldung, woran es lag.
START_RC=0
supabase --workdir "$WORKDIR" start --network-id "$NETZ" || START_RC=$?

if [ "$START_RC" -ne 0 ]; then
  echo "REFUSING (stack-guard): 'supabase start' endete mit rc=$START_RC." >&2
  exit 2      # der EXIT-Trap raeumt auf
fi

# ── 6. Nach dem Start erneut pruefen ────────────────────────────────────────
# Der Start selbst ist kein Beleg. Geprueft wird, was danach wirklich laeuft und
# gebunden ist.
if ! stapel_pruefen; then
  echo "REFUSING (stack-guard): der frisch gestartete Stapel bestand die Pruefung nicht (Grund oben)." >&2
  exit 2      # der EXIT-Trap raeumt auf
fi

# Erst jetzt entschaerfen: ab hier ist der Stapel geprueft und soll stehen
# bleiben.
AUFRAEUMEN_SCHARF=0
trap - EXIT HUP INT TERM

echo "Stapel '$PROJEKT' laeuft im Netz '$NETZ', ausschliesslich auf ${LOOPBACK_HOST_IP} veroeffentlicht."
