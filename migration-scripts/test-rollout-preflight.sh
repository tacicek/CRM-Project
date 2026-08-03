#!/bin/bash
#
# Testlauf fuer rollout-preflight.sh — ohne Server, ohne Docker, ohne psql
# ========================================================================
#
# Das Skript, das hier geprueft wird, faellt fail-closed. Genau das laesst sich
# an einem echten Server schlecht zeigen: dort ist entweder alles in Ordnung
# oder man haette den Fehlerfall erst herstellen muessen.
#
# Deshalb eine Attrappe. Ein `ssh` in einem eigenen Verzeichnis, das PATH
# voransteht, beantwortet jede Fernmessung nach Drehbuch — und protokolliert
# nebenbei jeden Befehl, den das Preflight abzusetzen versucht. Damit laesst
# sich zweierlei pruefen: dass die Einstufung stimmt, und dass nichts
# Unerlaubtes hinausgeht.
#
# Aufruf:  bash migration-scripts/test-rollout-preflight.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFLIGHT="$REPO_ROOT/migration-scripts/rollout-preflight.sh"
FN_SRC="$REPO_ROOT/supabase/functions"

GRUEN='\033[0;32m'; ROT='\033[0;31m'; AUS='\033[0m'

WERKBANK="$(mktemp -d "${TMPDIR:-/tmp}/preflight-test-XXXXXX")"
trap 'rm -rf "$WERKBANK"' EXIT

# Ein Wert, der in keiner Ausgabe des Preflights auftauchen darf. Die Attrappe
# streut ihn in die Rohprotokolle — so wie dort in Wirklichkeit Kundendaten
# stehen.
SENTINEL="GEHEIM-KUNDENDATEN-4711-nicht-ausgeben"

ECHTE_ID="7639710127421538342"

# ── Die Attrappe ───────────────────────────────────────────────────────────
cat > "$WERKBANK/ssh" <<'STUB'
#!/bin/bash
# Attrappe. Letztes Argument ist der Fernbefehl.
BEFEHL="${!#}"
# Ein Befehl, eine Protokollzeile. Mehrzeiliges SQL wird zusammengezogen —
# sonst zaehlten Fortsetzungszeilen als eigene Fernbefehle, und sowohl die
# Erlaubnisliste als auch die SSH-Zaehlung laesen Unsinn.
printf '%s\n' "$(printf '%s' "$BEFEHL" | tr '\n' ' ')" >> "$STUB_LOG"

hash_von() { printf 'HASH %s\n' "$1"; }

# ── Cluster-Identitaet ──
case "$BEFEHL" in
  *system_identifier*)
    [ "${STUB_ID_RC:-0}" = "0" ] || exit "$STUB_ID_RC"
    printf '%s\n' "${STUB_ID:-$STUB_ECHTE_ID}"; exit 0 ;;
esac

# ── Existenzprobe (resend-email) ──
case "$BEFEHL" in
  *"-e '"*"/resend-email'"*)
    [ "${STUB_RESEND_RC:-0}" = "0" ] || exit "$STUB_RESEND_RC"
    printf '%s\n' "${STUB_RESEND:-ABSENT}"; exit 0 ;;
esac

# ── Hash-Proben ──
case "$BEFEHL" in
  *retiredAdminEndpoint.ts*)
    [ "${STUB_HELFER_RC:-0}" = "0" ] || exit "$STUB_HELFER_RC"
    printf '%s\n' "${STUB_HELFER:-HASH $STUB_HELFER_HASH}"; exit 0 ;;
  *admin-create-user*)
    [ "${STUB_ADMIN1_RC:-0}" = "0" ] || exit "$STUB_ADMIN1_RC"
    printf '%s\n' "${STUB_ADMIN1:-HASH $STUB_ADMIN1_HASH}"; exit 0 ;;
  *admin-*)
    printf '%s\n' "${STUB_ADMINREST:-ABSENT}"; exit 0 ;;
  *cleanup-besichtigung/index.ts*)
    [ "${STUB_CLEAN_RC:-0}" = "0" ] || exit "$STUB_CLEAN_RC"
    printf '%s\n' "${STUB_CLEAN:-HASH $STUB_CLEAN_HASH}"; exit 0 ;;
  *cronAuth.ts*)
    printf '%s\n' "${STUB_CRONAUTH:-HASH $STUB_CRONAUTH_HASH}"; exit 0 ;;
esac

# ── Cron ──
case "$BEFEHL" in
  *cron.job*)
    [ "${STUB_CRON_RC:-0}" = "0" ] || exit "$STUB_CRON_RC"
    printf '%s\n' "${STUB_CRON-$STUB_CRON_PROD}"; exit 0 ;;
esac

# ── Edge-Protokoll ──
case "$BEFEHL" in
  *"docker logs"*)
    [ "${STUB_E2E_RC:-0}" = "0" ] || exit "$STUB_E2E_RC"
    # Der Sentinel steht hier fuer die Rohzeilen, die niemals herauskommen duerfen.
    : "$SENTINEL"
    printf '%s\n' "${STUB_E2E:-E2E 1 0 2026-08-03T03:00:11.123Z}"; exit 0 ;;
esac

printf 'ATTRAPPE: unbekannter Befehl\n' >&2
exit 97
STUB
chmod +x "$WERKBANK/ssh"

export PATH="$WERKBANK:$PATH"
export STUB_ECHTE_ID="$ECHTE_ID"
export SENTINEL
export STUB_HELFER_HASH;   STUB_HELFER_HASH="$(sha256sum "$FN_SRC/_shared/retiredAdminEndpoint.ts" | cut -d' ' -f1)"
export STUB_ADMIN1_HASH;   STUB_ADMIN1_HASH="$(sha256sum "$FN_SRC/admin-create-user/index.ts" | cut -d' ' -f1)"
export STUB_CLEAN_HASH;    STUB_CLEAN_HASH="$(sha256sum "$FN_SRC/cleanup-besichtigung/index.ts" | cut -d' ' -f1)"
export STUB_CRONAUTH_HASH; STUB_CRONAUTH_HASH="$(sha256sum "$FN_SRC/_shared/cronAuth.ts" | cut -d' ' -f1)"

# Der Cron-Satz, wie ihn die Produktionsmessung vom 2026-08-03 ergeben hat,
# uebersetzt in die kanonische Form, die das Skript jetzt anfordert:
# aktiv, Zeitplan 0 3 * * *, exakter Vertragsbefehl, 3.81 h alt und damit frisch.
#
# WARUM KANONISCH: die erste Fassung liess die Datenbank den Wahrheitswert als
# Text ausgeben und verglich im Skript dagegen. Postgres hat dafuer zwei Wege —
# eine Boolean-Spalte kommt kurz heraus (ein Buchstabe), ein Cast nach text
# ausgeschrieben. Diese Attrappe hatte die kurze Form eingesetzt, das Skript
# erzeugte die lange, und beide waren sich einig, dass sie recht haben. Die
# Produktion entschied den Streit: der Job war aktiv und wurde als inaktiv
# gemeldet.
#
# Deshalb liefert die Datenbank jetzt 1/0 aus einem CASE. Das hat nur zwei
# Auspraegungen und keinen zweiten Ausgabeweg, an dem sich Code und Vorgabe
# auseinanderleben koennten. Lokal gegen echtes Postgres nachgemessen:
#   SELECT true;        -> t
#   SELECT true::text;  -> true
#   CASE WHEN true ...  -> 1
export STUB_CRON_PROD="daily-besichtigung-cleanup|1|0 3 * * *|1|1|3.81"

# ── Testgeruest ────────────────────────────────────────────────────────────
BESTANDEN=0; GESCHEITERT=0
LETZTE_AUSGABE=""; LETZTER_RC=0; LETZTES_LOG=""

lauf() {   # lauf <beschreibung> — Umgebung kommt von aussen
  LETZTES_LOG="$WERKBANK/befehle.log"; : > "$LETZTES_LOG"
  export STUB_LOG="$LETZTES_LOG"
  LETZTE_AUSGABE="$(CRM_PROD_SYSTEM_IDENTIFIER="${ID_VORGABE-$ECHTE_ID}" \
      bash "$PREFLIGHT" "${ZIEL_VORGABE-root@example.test}" 2>&1)"
  LETZTER_RC=$?
  # Die Etiketten tragen Farbcodes mitten im Text ("ABSENT<reset>   nicht ...").
  # Ohne dieses Abstreifen prueft der Test die Faerbung statt der Aussage.
  LETZTE_AUSGABE="$(printf '%s' "$LETZTE_AUSGABE" | sed 's/\x1b\[[0-9;]*m//g')"
}

pruefe() {  # pruefe <was> <erwartet-rc> [erwartete-ssh-anzahl]
  local was="$1" erwartet="$2" ssh_anz="${3:-}"
  local ist_anz; ist_anz="$(wc -l < "$LETZTES_LOG" | tr -d ' ')"
  if [ "$LETZTER_RC" != "$erwartet" ]; then
    printf "  ${ROT}✗${AUS} %-52s rc=%s erwartet=%s\n" "$was" "$LETZTER_RC" "$erwartet"
    printf '%s\n' "$LETZTE_AUSGABE" | tail -4 | sed 's/^/      /'
    GESCHEITERT=$((GESCHEITERT + 1)); return
  fi
  if [ -n "$ssh_anz" ] && [ "$ist_anz" != "$ssh_anz" ]; then
    printf "  ${ROT}✗${AUS} %-52s SSH-Aufrufe=%s erwartet=%s\n" "$was" "$ist_anz" "$ssh_anz"
    GESCHEITERT=$((GESCHEITERT + 1)); return
  fi
  printf "  ${GRUEN}✓${AUS} %-52s rc=%s%s\n" "$was" "$LETZTER_RC" \
    "$([ -n "$ssh_anz" ] && printf ' ssh=%s' "$ist_anz")"
  BESTANDEN=$((BESTANDEN + 1))
}

enthaelt() {  # enthaelt <was> <text>
  if printf '%s' "$LETZTE_AUSGABE" | grep -qF "$2"; then
    printf "  ${GRUEN}✓${AUS} %s\n" "$1"; BESTANDEN=$((BESTANDEN + 1))
  else
    printf "  ${ROT}✗${AUS} %s — '%s' fehlt in der Ausgabe\n" "$1" "$2"; GESCHEITERT=$((GESCHEITERT + 1))
  fi
}

enthaelt_nicht() {
  if printf '%s' "$LETZTE_AUSGABE" | grep -qF "$2"; then
    printf "  ${ROT}✗${AUS} %s — '%s' steht in der Ausgabe\n" "$1" "$2"; GESCHEITERT=$((GESCHEITERT + 1))
  else
    printf "  ${GRUEN}✓${AUS} %s\n" "$1"; BESTANDEN=$((BESTANDEN + 1))
  fi
}

sauber() {  # alle Drehbuch-Variablen zuruecksetzen
  unset STUB_ID STUB_ID_RC STUB_HELFER STUB_HELFER_RC STUB_ADMIN1 STUB_ADMIN1_RC \
        STUB_ADMINREST STUB_RESEND STUB_RESEND_RC STUB_CLEAN STUB_CLEAN_RC \
        STUB_CRONAUTH STUB_CRON STUB_CRON_RC STUB_E2E STUB_E2E_RC \
        ID_VORGABE ZIEL_VORGABE FUNCTIONS_DIR DB_CONTAINER EDGE_CONTAINER
}

echo "══ Eingaben werden vor jedem SSH geprueft ══"
sauber; ID_VORGABE=""            ; lauf; pruefe "erwartete Identitaet fehlt"            2 0
sauber; ID_VORGABE="nicht-numerisch"; lauf; pruefe "erwartete Identitaet keine Zahl"    2 0
sauber; ZIEL_VORGABE="-oProxyCommand=x"; lauf; pruefe "SSH-Ziel beginnt mit '-'"        2 0
sauber; ZIEL_VORGABE='root@host;rm -rf /'; lauf; pruefe "SSH-Ziel mit Metazeichen"      2 0
sauber; export FUNCTIONS_DIR="relativ/pfad"; lauf; pruefe "FUNCTIONS_DIR nicht absolut"  2 0
sauber; export FUNCTIONS_DIR="/data/../etc"; lauf; pruefe "FUNCTIONS_DIR enthaelt '..'"  2 0
sauber; export FUNCTIONS_DIR="/data/fn'; id #"; lauf; pruefe "FUNCTIONS_DIR mit Quote"   2 0
sauber; export DB_CONTAINER="db; rm -rf /"  ; lauf; pruefe "DB_CONTAINER unzulaessig"    2 0
sauber; export EDGE_CONTAINER="-boese"      ; lauf; pruefe "EDGE_CONTAINER unzulaessig"  2 0

echo
echo "══ Cluster-Identitaet ══"
sauber; export STUB_ID="1111111111111111111"; lauf; pruefe "falscher Cluster"            2 1
enthaelt_nicht "und danach wird nicht weiter gemessen" "Admin-Endpunkte"
sauber; export STUB_ID_RC=255              ; lauf; pruefe "SSH-Fehler bei der Identitaet" 2 1

echo
echo "══ Messfehler ist niemals ABSENT ══"
sauber; export STUB_HELFER_RC=255; lauf; pruefe "SSH-Fehler bei der Hash-Probe"          2
enthaelt "wird als Messfehler gemeldet" "MESSUNG FEHLGESCHLAGEN"
enthaelt_nicht "und nicht als ABSENT verbucht" "ABSENT     nicht ausgeliefert"
sauber; export STUB_HELFER="UNREADABLE"; lauf; pruefe "Datei da, aber nicht lesbar"       2
sauber; export STUB_HELFER="voelliger Unsinn"; lauf; pruefe "unerwartete Antwortform"     2

echo
echo "══ Einstufung der Admin-Endpunkte ══"
sauber; lauf; pruefe "Grundfall laeuft durch"                                            0
enthaelt "echtes Fehlen wird ABSENT"        "ABSENT     nicht ausgeliefert"
enthaelt "Adapter+Helfer aktuell = TOMBSTONE" "TOMBSTONE  Adapter und Helfer aktuell"
sauber; export STUB_HELFER="ABSENT"; lauf; pruefe "Adapter gleich, Helfer fehlt"          0
enthaelt "wird NICHT als TOMBSTONE gezaehlt" "INCOMPLETE Adapter aktuell, Helfer FEHLT"
enthaelt_nicht "und taucht nicht als TOMBSTONE auf" "TOMBSTONE  Adapter und Helfer aktuell"
sauber; export STUB_HELFER="HASH 0000000000000000000000000000000000000000000000000000000000000000"
lauf; pruefe "Adapter gleich, Helfer driftet"                                            0
enthaelt "ebenfalls INCOMPLETE" "INCOMPLETE Adapter aktuell, Helfer DRIFT"
sauber; export STUB_ADMIN1="HASH 1111111111111111111111111111111111111111111111111111111111111111"
lauf; pruefe "Adapter driftet"                                                           0
enthaelt "wird OLD" "OLD        alte Fassung"

echo
echo "══ resend-email ist ein echter Blocker ══"
sauber; export STUB_RESEND="PRESENT"; lauf; pruefe "resend-email vorhanden"               1
enthaelt "haelt den Rollout an" "ROLLOUT ANHALTEN"
sauber; export STUB_RESEND_RC=255  ; lauf; pruefe "resend-email nicht messbar"            2

echo
echo "══ cleanup-besichtigung: Quelle ══"
sauber; export STUB_CLEAN="ABSENT"; lauf; pruefe "cleanup fehlt"                          1
sauber; export STUB_CLEAN="HASH 2222222222222222222222222222222222222222222222222222222222222222"
lauf; pruefe "cleanup driftet"                                                            1
sauber; export STUB_CRONAUTH="HASH 3333333333333333333333333333333333333333333333333333333333333333"
lauf; pruefe "cronAuth driftet"                                                           1
sauber; export STUB_CLEAN_RC=255 ; lauf; pruefe "cleanup nicht messbar"                   2

echo
echo "══ Cron: Zeilenzahl ══"
sauber; export STUB_CRON=""; lauf; pruefe "kein Job gefunden"                             1
sauber; export STUB_CRON="daily-besichtigung-cleanup|1|0 3 * * *|1|1|3.81
daily-besichtigung-cleanup|1|0 3 * * *|1|1|9.20"
lauf; pruefe "zwei gleichnamige Jobs -> fail-closed"                                      1
enthaelt "und die zweite Zeile wird nicht verschwiegen" "Es gibt 2 Jobs"

echo
echo "══ Cron: kanonische Wahrheitswerte ══"
sauber; export STUB_CRON="daily-besichtigung-cleanup|0|0 3 * * *|1|1|3.81"
lauf; pruefe "aktiv=0 blockiert"                                                          1
sauber; export STUB_CRON="daily-besichtigung-cleanup|1|0 3 * * *|0|1|3.81"
lauf; pruefe "Vertragsbefehl=0 blockiert"                                                 1
sauber; export STUB_CRON="daily-besichtigung-cleanup|1|0 5 * * *|1|1|3.81"
lauf; pruefe "falscher Zeitplan blockiert"                                                1

# Die Regression zur Produktionsmessung: die alte Textform darf nicht mehr
# stillschweigend als "nein" durchgehen. Sie ist eine misslungene Messung.
sauber; export STUB_CRON="daily-besichtigung-cleanup|true|0 3 * * *|1|1|3.81"
lauf; pruefe "aktiv='true' ist Messfehler, nicht inaktiv"                                 2
sauber; export STUB_CRON="daily-besichtigung-cleanup|t|0 3 * * *|1|1|3.81"
lauf; pruefe "aktiv='t' ist Messfehler, nicht inaktiv"                                    2
sauber; export STUB_CRON="daily-besichtigung-cleanup|1|0 3 * * *|f|1|3.81"
lauf; pruefe "Befehlsfeld='f' ist Messfehler"                                             2
sauber; export STUB_CRON="daily-besichtigung-cleanup|1|0 3 * * *|1|ja|3.81"
lauf; pruefe "Frische='ja' ist Messfehler"                                                2
sauber; export STUB_CRON_RC=255; lauf; pruefe "Cron nicht messbar"                        2

echo
echo "══ Cron: die 36-Stunden-Grenze entscheidet die Datenbank ══"
sauber; export STUB_CRON="daily-besichtigung-cleanup|1|0 3 * * *|1|1|36.00"
lauf; pruefe "genau 36.00 h -> frisch, laeuft durch"                                      0
sauber; export STUB_CRON="daily-besichtigung-cleanup|1|0 3 * * *|1|0|36.01"
lauf; pruefe "36.01 h -> abgelehnt"                                                       1
sauber; export STUB_CRON="daily-besichtigung-cleanup|1|0 3 * * *|1|0|72.00"
lauf; pruefe "72 h -> abgelehnt"                                                          1
sauber; export STUB_CRON="daily-besichtigung-cleanup|1|0 3 * * *|1|NONE|-"
lauf; pruefe "nie erfolgreich gelaufen -> eigener Zustand, abgelehnt"                     1
enthaelt "und wird als solcher benannt" "Kein einziger erfolgreicher Lauf"

echo
echo "══ Der Vertragsbefehl wird in SQL exakt verglichen ══"
# Der Vergleich selbst passiert in der Datenbank, nicht in der Shell. Geprueft
# wird deshalb, dass das Skript die exakte Gleichheit anfordert und nicht mehr
# das alte Enthaeltsein. Die drei Faelle sind lokal gegen echtes Postgres
# gemessen: exakter Befehl 1, blosse Erwaehnung 0, angehaengtes Statement 0.
PF_SQL="$(cat "$PREFLIGHT")"
if printf '%s' "$PF_SQL" | grep -qF 'format($$SELECT public.invoke_edge_function(%L)$$'; then
  printf "  ${GRUEN}✓${AUS} baut den Vertragstext mit format(%%L)\n"; BESTANDEN=$((BESTANDEN + 1))
else
  printf "  ${ROT}✗${AUS} format(%%L) fehlt\n"; GESCHEITERT=$((GESCHEITERT + 1))
fi
if printf '%s' "$PF_SQL" | grep -qF 'j.command = format('; then
  printf "  ${GRUEN}✓${AUS} vergleicht auf Gleichheit\n"; BESTANDEN=$((BESTANDEN + 1))
else
  printf "  ${ROT}✗${AUS} kein Gleichheitsvergleich des Befehls\n"; GESCHEITERT=$((GESCHEITERT + 1))
fi
if printf '%s' "$PF_SQL" | grep -q 'j.command LIKE'; then
  printf "  ${ROT}✗${AUS} vergleicht immer noch mit LIKE\n"; GESCHEITERT=$((GESCHEITERT + 1))
else
  printf "  ${GRUEN}✓${AUS} kein LIKE mehr auf dem Befehl\n"; BESTANDEN=$((BESTANDEN + 1))
fi
if printf '%s' "$PF_SQL" | grep -qF 'GROUP BY j.jobid'; then
  printf "  ${GRUEN}✓${AUS} gruppiert je Job, damit Doppelte sichtbar bleiben\n"; BESTANDEN=$((BESTANDEN + 1))
else
  printf "  ${ROT}✗${AUS} gruppiert nicht je jobid — Doppelte fielen zusammen\n"; GESCHEITERT=$((GESCHEITERT + 1))
fi

echo
echo "══ Der in Produktion gemessene Satz wird angenommen ══"
sauber; lauf; pruefe "Produktionsformat (aktiv, 0 3 * * *, exakt, 3.81 h)"                0
enthaelt "aktiv kanonisch gemeldet" "aktiv:              1"
enthaelt "Vertragsbefehl kanonisch gemeldet" "Vertragsbefehl:     1"
enthaelt "Frische kanonisch gemeldet" "innerhalb 36 h:     1"
enthaelt "Alter nur zum Mitlesen" "letzter Erfolg vor: 3.81 h"

echo "══ Ende zu Ende: hat die Funktion selbst gemeldet? ══"
sauber; export STUB_E2E="E2E 0 NA -"; lauf; pruefe "Cron gruen, aber keine Abschlussmeldung" 1
enthaelt "wird als unbelegt gemeldet" "END_TO_END_UNPROVEN"
sauber; export STUB_E2E="E2E 1 3 2026-08-03T03:00:11Z"; lauf; pruefe "storage_errors=3"   1
sauber; export STUB_E2E="E2E 1 NA 2026-08-03T03:00:11Z"; lauf; pruefe "storage_errors nicht auslesbar" 1
enthaelt "kein Gruen erfunden" "END_TO_END_UNPROVEN"
enthaelt "und die naechste Runde wird benannt" "ausdrueckliche Freigabe"
sauber; export STUB_E2E="LOGERR"; lauf; pruefe "Protokoll nicht lesbar"                   2
sauber; export STUB_E2E_RC=255  ; lauf; pruefe "docker logs bricht ab"                    2
sauber; export STUB_E2E="voellig anderes Format"; lauf; pruefe "unerwartete Protokollform" 2

echo
echo "══ Der gruene Fall ══"
sauber; lauf; pruefe "alle Bedingungen erfuellt"                                          0
enthaelt "Rollout wird freigegeben" "Der Rollout darf beginnen"

echo
echo "══ Was nach draussen geht ══"
enthaelt_nicht "kein Sentinel aus den Rohprotokollen" "$SENTINEL"
enthaelt_nicht "kein Rohprotokoll" "GEHEIM"

# Jeder abgesetzte Fernbefehl muss einer der drei erlaubten Formen entsprechen.
UNERLAUBT=0
while IFS= read -r befehl; do
  case "$befehl" in
    "docker exec -i -e PGOPTIONS=--default_transaction_read_only=on "*" psql -U postgres -d postgres -qtA -c '"*) ;;
    "if [ ! -e '"*) ;;
    "if [ -e '"*) ;;
    'M="[cleanup-besichtigung] Cleanup complete:"'*) ;;
    *) printf "  ${ROT}✗${AUS} unerlaubter Fernbefehl: %s\n" "${befehl:0:80}"; UNERLAUBT=$((UNERLAUBT + 1)) ;;
  esac
done < "$LETZTES_LOG"
if [ "$UNERLAUBT" -eq 0 ]; then
  printf "  ${GRUEN}✓${AUS} alle %s Fernbefehle stehen auf der Erlaubnisliste\n" "$(wc -l < "$LETZTES_LOG" | tr -d ' ')"
  BESTANDEN=$((BESTANDEN + 1))
else
  GESCHEITERT=$((GESCHEITERT + UNERLAUBT))
fi

# Und keiner davon schreibt.
if grep -qE '\b(rm|mv|cp|scp|rsync|mkdir|touch|tee|dd)\b|docker (restart|stop|start|kill|cp|rm)|INSERT |UPDATE |DELETE |DROP |ALTER |CREATE |TRUNCATE |GRANT |REVOKE ' "$LETZTES_LOG"; then
  printf "  ${ROT}✗${AUS} ein Fernbefehl schreibt\n"; GESCHEITERT=$((GESCHEITERT + 1))
else
  printf "  ${GRUEN}✓${AUS} kein Fernbefehl schreibt\n"; BESTANDEN=$((BESTANDEN + 1))
fi

# Und alle SQL-Aufrufe sind read-only gestellt.
SQL_ANZ="$(grep -c 'psql -U postgres' "$LETZTES_LOG" || true)"
SQL_RO="$(grep -c 'PGOPTIONS=--default_transaction_read_only=on' "$LETZTES_LOG" || true)"
if [ "$SQL_ANZ" -gt 0 ] && [ "$SQL_ANZ" = "$SQL_RO" ]; then
  printf "  ${GRUEN}✓${AUS} alle %s SQL-Aufrufe laufen read-only\n" "$SQL_ANZ"; BESTANDEN=$((BESTANDEN + 1))
else
  printf "  ${ROT}✗${AUS} SQL-Aufrufe=%s, davon read-only=%s\n" "$SQL_ANZ" "$SQL_RO"; GESCHEITERT=$((GESCHEITERT + 1))
fi

echo
echo "═══════════════════════════════════════════════"
printf "bestanden %s, gescheitert %s\n" "$BESTANDEN" "$GESCHEITERT"
[ "$GESCHEITERT" -eq 0 ] || exit 1
exit 0
