#!/bin/bash
#
# Rollout-Preflight fuer das Sicherheitspaket vom 2026-08-03
# =========================================================
#
# Misst die Bedingungen, die vor dem Rollout erfuellt sein muessen — und nichts
# sonst. Es liest ausschliesslich: kein Deploy, kein Restart, kein Schreiben,
# keine Migration. Die beiden SQL-Abfragen laufen mit
# `--default_transaction_read_only=on`, damit ein Tippfehler kein Schreibrecht
# findet.
#
# ── Der Grundsatz ──────────────────────────────────────────────────────────
#
# Eine fehlgeschlagene Messung ist KEIN Befund. Sie ist der Abbruch.
#
# Das ist der Unterschied zur ersten Fassung dieses Skripts: dort endete jeder
# Fernaufruf auf `|| true`, und eine verweigerte SSH-Verbindung, ein falscher
# Pfad oder ein Rechtefehler kamen als leere Antwort zurueck — also als
# "ABSENT", also als gruen. Wer nicht hinsehen kann, darf nicht Entwarnung
# geben. Jede Messung hier liefert deshalb genau eines von dreien:
#
#     HASH <sha256> / PRESENT   — gemessen, da
#     ABSENT                    — gemessen, nicht da
#     (Abbruch mit rc=2)        — nicht gemessen
#
# ── Aufruf ─────────────────────────────────────────────────────────────────
#
#   CRM_PROD_SYSTEM_IDENTIFIER=<zahl> \
#     bash migration-scripts/rollout-preflight.sh <ssh-ziel>
#
# Der erwartete `system_identifier` ist Pflicht und hat keinen Vorgabewert. Er
# wird beim Initialisieren eines Clusters vergeben und ueberlebt Umbenennungen,
# Ports und Containernamen; er ist das einzige Merkmal, das nicht versehentlich
# auf einen anderen Cluster passt. Ohne ihn misst dieses Skript nicht.
#
# Optional per Umgebung (jeweils streng geprueft):
#   FUNCTIONS_DIR    Pfad der ausgelieferten Funktionen
#   DB_CONTAINER     Postgres-Container
#   EDGE_CONTAINER   Edge-Runtime-Container
#   SSH_TIMEOUT      Verbindungszeitgrenze in Sekunden (Vorgabe 10)
#
# ── Rueckgabewert ──────────────────────────────────────────────────────────
#
#   0  Alle Bedingungen erfuellt — der Rollout darf beginnen.
#   1  Eine Bedingung ist verletzt — der Rollout MUSS anhalten.
#   2  Eine Messung war nicht moeglich — es gibt kein Urteil.
#
# Ein OLD-Befund bei den Admin-Endpunkten faerbt den Rueckgabewert nicht: er
# ist Arbeit (Grabstein ausliefern), kein Fehler.

set -euo pipefail

GRUEN='\033[0;32m'; ROT='\033[0;31m'; GELB='\033[1;33m'; BLAU='\033[0;34m'; AUS='\033[0m'

abbruch_messung() {   # rc=2: nicht gemessen
  printf "\n${ROT}MESSUNG FEHLGESCHLAGEN${AUS} — %s\n" "$1" >&2
  printf "Kein Urteil. Der Rollout beginnt nicht auf Grundlage einer Messung,\n" >&2
  printf "die nicht stattgefunden hat.\n" >&2
  exit 2
}

abbruch_befund() {    # rc=1: gemessen, und das Ergebnis verbietet den Rollout
  printf "\n${ROT}ROLLOUT ANHALTEN${AUS} — %s\n" "$1" >&2
  exit 1
}

trenner() { printf '\n── %s ──────────────────────────────────\n' "$1"; }

# ═══════════════════════════════════════════════════════════════════════════
# 1. Alles pruefen, bevor irgendetwas nach draussen geht
# ═══════════════════════════════════════════════════════════════════════════

if [ "$#" -ne 1 ]; then
  echo "Aufruf: CRM_PROD_SYSTEM_IDENTIFIER=<zahl> bash $0 <ssh-ziel>" >&2
  echo "Genau ein Argument erwartet, $# erhalten." >&2
  exit 2
fi

ZIEL="$1"
ERWARTETE_ID="${CRM_PROD_SYSTEM_IDENTIFIER:-}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-/data/coolify/services/aw0c0w440o8k0cccokow0csw/volumes/functions}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db-aw0c0w440o8k0cccokow0csw}"
EDGE_CONTAINER="${EDGE_CONTAINER:-supabase-edge-functions-aw0c0w440o8k0cccokow0csw}"
SSH_TIMEOUT="${SSH_TIMEOUT:-10}"

if [ -z "$ERWARTETE_ID" ]; then
  echo "CRM_PROD_SYSTEM_IDENTIFIER fehlt." >&2
  echo "Ohne den erwarteten Cluster gibt es nichts, wogegen sich der gemessene" >&2
  echo "vergleichen liesse — und dann misst dieses Skript irgendeine Datenbank." >&2
  exit 2
fi
if ! printf '%s' "$ERWARTETE_ID" | grep -qE '^[0-9]+$'; then
  echo "CRM_PROD_SYSTEM_IDENTIFIER besteht nicht nur aus Ziffern." >&2
  exit 2
fi

# Das SSH-Ziel darf nicht mit `-` beginnen, sonst liest ssh es als Option.
case "$ZIEL" in
  -*) echo "SSH-Ziel beginnt mit '-' — das waere fuer ssh eine Option." >&2; exit 2 ;;
esac
if ! printf '%s' "$ZIEL" | grep -qE '^[A-Za-z0-9_.-]+(@[A-Za-z0-9_.-]+)?$'; then
  echo "SSH-Ziel enthaelt Zeichen ausserhalb von [A-Za-z0-9_.-] bzw. user@host." >&2
  exit 2
fi

pruefe_containernamen() {
  local wert="$1" name="$2"
  if ! printf '%s' "$wert" | grep -qE '^[A-Za-z0-9][A-Za-z0-9_.-]*$'; then
    echo "$name ist kein gueltiger Containername: '$wert'" >&2
    exit 2
  fi
}
pruefe_containernamen "$DB_CONTAINER"   "DB_CONTAINER"
pruefe_containernamen "$EDGE_CONTAINER" "EDGE_CONTAINER"

# Der Pfad wird in Fernbefehle eingesetzt. Erlaubt sind deshalb nur Zeichen,
# die dort nichts bedeuten — kein Anfuehrungszeichen, kein Leerraum, kein
# Metazeichen, und kein `..`, mit dem sich die Messung aus dem Funktionsbaum
# herausbewegen liesse.
case "$FUNCTIONS_DIR" in
  /*) : ;;
  *) echo "FUNCTIONS_DIR ist kein absoluter Pfad: '$FUNCTIONS_DIR'" >&2; exit 2 ;;
esac
if ! printf '%s' "$FUNCTIONS_DIR" | grep -qE '^[A-Za-z0-9/._-]+$'; then
  echo "FUNCTIONS_DIR enthaelt unerlaubte Zeichen: '$FUNCTIONS_DIR'" >&2
  exit 2
fi
case "$FUNCTIONS_DIR" in
  *..*) echo "FUNCTIONS_DIR enthaelt '..': '$FUNCTIONS_DIR'" >&2; exit 2 ;;
esac
if ! printf '%s' "$SSH_TIMEOUT" | grep -qE '^[0-9]+$'; then
  echo "SSH_TIMEOUT ist keine Zahl: '$SSH_TIMEOUT'" >&2; exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FN_SRC="$REPO_ROOT/supabase/functions"

# ═══════════════════════════════════════════════════════════════════════════
# 2. Die drei Messformen
# ═══════════════════════════════════════════════════════════════════════════

fern() {
  ssh -o BatchMode=yes -o "ConnectTimeout=$SSH_TIMEOUT" "$ZIEL" "$1"
}

repo_hash() {
  local datei="$1"
  [ -f "$datei" ] || abbruch_messung "Repo-Datei fehlt, Vergleich unmoeglich: $datei"
  sha256sum "$datei" | cut -d' ' -f1
}

# Gibt "HASH <sha256>" oder "ABSENT" aus. Alles andere bricht ab.
mess_hash() {
  local pfad="$1" was="$2" ausgabe rc=0
  ausgabe="$(fern "if [ ! -e '$pfad' ]; then echo ABSENT; elif [ ! -r '$pfad' ]; then echo UNREADABLE; else sha256sum '$pfad' | cut -d' ' -f1 | sed 's/^/HASH /'; fi")" || rc=$?
  [ "$rc" -eq 0 ] || abbruch_messung "$was: SSH-Aufruf endete mit rc=$rc"
  case "$ausgabe" in
    ABSENT) printf 'ABSENT' ; return 0 ;;
    UNREADABLE) abbruch_messung "$was: Datei vorhanden, aber nicht lesbar ($pfad)" ;;
  esac
  if printf '%s' "$ausgabe" | grep -qE '^HASH [0-9a-f]{64}$'; then
    printf '%s' "$ausgabe"; return 0
  fi
  abbruch_messung "$was: unerwartete Antwort statt HASH/ABSENT"
}

# Gibt "PRESENT" oder "ABSENT" aus. Alles andere bricht ab.
mess_existenz() {
  local pfad="$1" was="$2" ausgabe rc=0
  ausgabe="$(fern "if [ -e '$pfad' ]; then echo PRESENT; else echo ABSENT; fi")" || rc=$?
  [ "$rc" -eq 0 ] || abbruch_messung "$was: SSH-Aufruf endete mit rc=$rc"
  case "$ausgabe" in
    PRESENT|ABSENT) printf '%s' "$ausgabe"; return 0 ;;
  esac
  abbruch_messung "$was: unerwartete Antwort statt PRESENT/ABSENT"
}

# Lesende SQL-Abfrage. `$$…$$` statt einfacher Anfuehrungszeichen, damit der
# Befehl ohne Quoting-Verrenkungen durch die Ferne kommt.
mess_sql() {
  local sql="$1" was="$2" ausgabe rc=0
  ausgabe="$(fern "docker exec -i -e PGOPTIONS=--default_transaction_read_only=on $DB_CONTAINER psql -U postgres -d postgres -qtA -c '$sql'")" || rc=$?
  [ "$rc" -eq 0 ] || abbruch_messung "$was: SQL-Aufruf endete mit rc=$rc"
  printf '%s' "$ausgabe"
}

# ═══════════════════════════════════════════════════════════════════════════
trenner "0. Cluster-Identitaet"
# ═══════════════════════════════════════════════════════════════════════════

echo "SSH-Ziel:        $ZIEL"
echo "Funktionspfad:   $FUNCTIONS_DIR"
echo "DB-Container:    $DB_CONTAINER"
echo "Edge-Container:  $EDGE_CONTAINER"

GEMESSENE_ID="$(mess_sql 'SELECT (pg_control_system()).system_identifier' 'Cluster-Identitaet')"

if ! printf '%s' "$GEMESSENE_ID" | grep -qE '^[0-9]+$'; then
  abbruch_messung "Cluster-Identitaet: Antwort ist keine Zahl"
fi
if [ "$GEMESSENE_ID" != "$ERWARTETE_ID" ]; then
  printf "\n${ROT}FALSCHER CLUSTER${AUS}\n" >&2
  printf "  erwartet: %s\n  gemessen: %s\n" "$ERWARTETE_ID" "$GEMESSENE_ID" >&2
  printf "Es wird nichts weiter gemessen.\n" >&2
  exit 2
fi
echo -e "Cluster:         ${BLAU}${GEMESSENE_ID}${AUS} — stimmt mit der Erwartung ueberein"

# ═══════════════════════════════════════════════════════════════════════════
trenner "1. Admin-Endpunkte: ABSENT / OLD / TOMBSTONE"
# ═══════════════════════════════════════════════════════════════════════════

# Ein Grabstein besteht aus zwei Teilen: dem Adapter und dem gemeinsamen
# Helfer, den alle sechs aufrufen. Stimmt nur der Adapter, ist der Endpunkt
# nicht stillgelegt — er laedt dann eine fremde oder fehlende
# `retiredAdminEndpoint.ts` und tut, was dort steht. Deshalb zaehlt beides.
HELFER_REL="_shared/retiredAdminEndpoint.ts"
HELFER_REPO="$(repo_hash "$FN_SRC/$HELFER_REL")"
HELFER_FERN="$(mess_hash "$FUNCTIONS_DIR/$HELFER_REL" 'Grabstein-Helfer')"

if [ "$HELFER_FERN" = "ABSENT" ]; then
  HELFER_ZUSTAND="FEHLT"
elif [ "$HELFER_FERN" = "HASH $HELFER_REPO" ]; then
  HELFER_ZUSTAND="AKTUELL"
else
  HELFER_ZUSTAND="DRIFT"
fi
echo "  gemeinsamer Helfer ($HELFER_REL): $HELFER_ZUSTAND"

ADMIN_FUNKTIONEN=(
  "admin-add-company-member" "admin-create-user" "admin-delete-user"
  "admin-remove-company-member" "admin-reset-password" "admin-update-user-email"
)

ANZ_ABSENT=0; ANZ_OLD=0; ANZ_TOMB=0
OFFEN=()

for fn in "${ADMIN_FUNKTIONEN[@]}"; do
  repo="$(repo_hash "$FN_SRC/$fn/index.ts")"
  gemessen="$(mess_hash "$FUNCTIONS_DIR/$fn/index.ts" "$fn")"

  if [ "$gemessen" = "ABSENT" ]; then
    printf '  %-30s %b\n' "$fn" "${GRUEN}ABSENT${AUS}     nicht ausgeliefert — NICHT neu anlegen"
    ANZ_ABSENT=$((ANZ_ABSENT + 1))
  elif [ "$gemessen" != "HASH $repo" ]; then
    printf '  %-30s %b\n' "$fn" "${GELB}OLD${AUS}        alte Fassung — Grabstein ausliefern"
    ANZ_OLD=$((ANZ_OLD + 1)); OFFEN+=("$fn (Adapter alt)")
  elif [ "$HELFER_ZUSTAND" != "AKTUELL" ]; then
    # Adapter stimmt, Helfer nicht: nach aussen sieht das aus wie ein
    # Grabstein und ist keiner.
    printf '  %-30s %b\n' "$fn" "${GELB}INCOMPLETE${AUS} Adapter aktuell, Helfer $HELFER_ZUSTAND"
    ANZ_OLD=$((ANZ_OLD + 1)); OFFEN+=("$fn (Helfer $HELFER_ZUSTAND)")
  else
    printf '  %-30s %b\n' "$fn" "${GRUEN}TOMBSTONE${AUS}  Adapter und Helfer aktuell"
    ANZ_TOMB=$((ANZ_TOMB + 1))
  fi
done

echo
echo "  Summe: ABSENT=$ANZ_ABSENT  TOMBSTONE=$ANZ_TOMB  OLD/INCOMPLETE=$ANZ_OLD"

# ═══════════════════════════════════════════════════════════════════════════
trenner "2. resend-email"
# ═══════════════════════════════════════════════════════════════════════════

RESEND="$(mess_existenz "$FUNCTIONS_DIR/resend-email" 'resend-email')"
if [ "$RESEND" = "PRESENT" ]; then
  echo -e "  ${ROT}PRESENT${AUS} — der unauthentifizierte Relay liegt auf dem Server."
  abbruch_befund "resend-email ist ausgeliefert. Erst klaeren, woher, dann weiter."
fi
echo -e "  ${GRUEN}ABSENT${AUS} — so muss es sein."

# ═══════════════════════════════════════════════════════════════════════════
trenner "3. cleanup-besichtigung: Quelle"
# ═══════════════════════════════════════════════════════════════════════════

# Die blosse Existenz genuegt nicht. Eine alte Fassung raeumt zwar auf, aber
# womoeglich anders, als das Repo behauptet — und die Aufbewahrungsfrist ist
# genau das, was hier belegt werden soll.
CLEAN_TEILE=("cleanup-besichtigung/index.ts" "_shared/cronAuth.ts")
CLEAN_OK=1
for teil in "${CLEAN_TEILE[@]}"; do
  repo="$(repo_hash "$FN_SRC/$teil")"
  gemessen="$(mess_hash "$FUNCTIONS_DIR/$teil" "$teil")"
  if [ "$gemessen" = "ABSENT" ]; then
    printf '  %-34s %b\n' "$teil" "${ROT}FEHLT${AUS}"; CLEAN_OK=0
  elif [ "$gemessen" != "HASH $repo" ]; then
    printf '  %-34s %b\n' "$teil" "${ROT}DRIFT${AUS} (Server weicht vom Repo ab)"; CLEAN_OK=0
  else
    printf '  %-34s %b\n' "$teil" "${GRUEN}AKTUELL${AUS}"
  fi
done
[ "$CLEAN_OK" -eq 1 ] || abbruch_befund "cleanup-besichtigung fehlt oder weicht ab — ohne sie gibt es keine Aufbewahrung."

# ═══════════════════════════════════════════════════════════════════════════
trenner "4. Aufbewahrung: Cron"
# ═══════════════════════════════════════════════════════════════════════════

CRON_SQL='SELECT j.jobname || $$|$$ || j.active::text || $$|$$ || j.schedule || $$|$$ || (j.command LIKE $$%cleanup-besichtigung%$$)::text || $$|$$ || coalesce(round(extract(epoch from (now() - max(r.end_time) FILTER (WHERE r.status = $$succeeded$$)))/3600.0, 2)::text, $$-$$) FROM cron.job j LEFT JOIN cron.job_run_details r ON r.jobid = j.jobid WHERE j.jobname = $$daily-besichtigung-cleanup$$ GROUP BY j.jobname, j.active, j.schedule, j.command'

CRON_ZEILE="$(mess_sql "$CRON_SQL" 'Cron-Eintrag')"
[ -n "$CRON_ZEILE" ] || abbruch_befund "Es gibt keinen Job 'daily-besichtigung-cleanup'."

IFS='|' read -r C_NAME C_AKTIV C_PLAN C_CMD C_ALTER <<< "$CRON_ZEILE"
echo "  Job:          ${C_NAME:-?}"
echo "  aktiv:        ${C_AKTIV:-?}"
echo "  Zeitplan:     ${C_PLAN:-?}"
echo "  ruft cleanup: ${C_CMD:-?}"
echo "  letzter Erfolg vor: ${C_ALTER:-?} h"

[ "$C_AKTIV" = "t" ] || abbruch_befund "Der Cron-Job ist nicht aktiv."
[ "$C_PLAN" = "0 3 * * *" ] || abbruch_befund "Zeitplan ist '$C_PLAN', erwartet '0 3 * * *'."
[ "$C_CMD" = "t" ] || abbruch_befund "Der Job ruft cleanup-besichtigung nicht auf."
[ "$C_ALTER" != "-" ] || abbruch_befund "Kein einziger erfolgreicher Lauf verzeichnet."
if ! printf '%s' "$C_ALTER" | grep -qE '^[0-9]+(\.[0-9]+)?$'; then
  abbruch_messung "Cron-Alter ist keine Zahl: '$C_ALTER'"
fi
if [ "${C_ALTER%%.*}" -gt 36 ]; then
  abbruch_befund "Letzter Erfolg liegt ${C_ALTER} h zurueck, erlaubt sind 36."
fi
echo -e "  ${GRUEN}Cron in Ordnung.${AUS}"

# ═══════════════════════════════════════════════════════════════════════════
trenner "5. Aufbewahrung: hat sie wirklich stattgefunden?"
# ═══════════════════════════════════════════════════════════════════════════

# `status='succeeded'` heisst bei pg_cron nur, dass der Job seinen Befehl
# abgesetzt hat. Der Befehl ist ein asynchroner HTTP-Aufruf — er kann
# erfolgreich abgesetzt und trotzdem nie beantwortet worden sein. Belegt ist
# die Aufbewahrung erst, wenn die Funktion selbst ihren Abschluss gemeldet hat.
#
# Die Rohprotokolle bleiben auf dem Server. Zurueck kommt nur eine Zeile mit
# Einstufung, Zahl und Zeitstempel: dort stehen sonst Kundendaten drin.
MARKER='[cleanup-besichtigung] Cleanup complete:'
LOG_BEFEHL='M="[cleanup-besichtigung] Cleanup complete:"; OUT=$(docker logs -t --since 36h '"$EDGE_CONTAINER"' 2>&1) || { echo LOGERR; exit 0; }; N=$(printf "%s\n" "$OUT" | grep -F "$M" | wc -l); LAST=$(printf "%s\n" "$OUT" | grep -F "$M" | tail -1); TS=$(printf "%s" "$LAST" | cut -d" " -f1); SE=$(printf "%s" "$LAST" | sed -n "s/.*storage_errors[^0-9-]*\([0-9][0-9]*\).*/\1/p"); echo "E2E $N ${SE:-NA} ${TS:--}"'

E2E_RC=0
E2E_ZEILE="$(fern "$LOG_BEFEHL")" || E2E_RC=$?
[ "$E2E_RC" -eq 0 ] || abbruch_messung "Edge-Protokoll: SSH-Aufruf endete mit rc=$E2E_RC"
[ "$E2E_ZEILE" != "LOGERR" ] || abbruch_messung "Edge-Protokoll nicht lesbar (docker logs $EDGE_CONTAINER)"

if ! printf '%s' "$E2E_ZEILE" | grep -qE '^E2E [0-9]+ ([0-9]+|NA) .+$'; then
  abbruch_messung "Edge-Protokoll: unerwartete Antwortform"
fi
read -r _ E2E_ANZ E2E_FEHLER E2E_ZEIT <<< "$E2E_ZEILE"

echo "  Abschlussmeldungen der letzten 36 h: $E2E_ANZ"
echo "  letzte davon:                       ${E2E_ZEIT}"
echo "  storage_errors darin:               ${E2E_FEHLER}"

if [ "$E2E_ANZ" -eq 0 ]; then
  abbruch_befund "END_TO_END_UNPROVEN — der Cron lief, aber cleanup-besichtigung hat in 36 h keinen Abschluss gemeldet. Die Aufbewahrung ist damit nicht belegt."
fi
if [ "$E2E_FEHLER" = "NA" ]; then
  # Marker da, Zahl nicht herauszulesen: das Protokollformat traegt die
  # Aussage nicht. Kein Gruen erfinden.
  abbruch_befund "END_TO_END_UNPROVEN — Abschluss gemeldet, aber storage_errors nicht auslesbar. Fuer die naechste Runde braucht es eine kontrollierte Testausfuehrung von cleanup-besichtigung; die verlangt eine eigene, ausdrueckliche Freigabe."
fi
if [ "$E2E_FEHLER" -gt 0 ]; then
  abbruch_befund "Der letzte Lauf meldet storage_errors=$E2E_FEHLER — Dateien blieben im Speicher liegen."
fi
echo -e "  ${GRUEN}Aufbewahrung belegt: Abschluss gemeldet, keine Speicherfehler.${AUS}"

# ═══════════════════════════════════════════════════════════════════════════
trenner "Urteil"
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${GRUEN}Alle Bedingungen erfuellt. Der Rollout darf beginnen.${AUS}"
if [ "$ANZ_OLD" -gt 0 ]; then
  echo
  echo "Offen (Arbeit, kein Hindernis) — Grabstein ausliefern fuer:"
  printf '  - %s\n' "${OFFEN[@]}"
fi
echo
echo "Reihenfolge: 20260802140000 → 20260802150000 → 20260803010000 → 20260803020000"
echo "             → geschuetzte Edge Functions → Foto-Funktionen → 20260803030000"
echo "             → Frontend → 20260803040000 → notify-appointment-reminder"
exit 0
