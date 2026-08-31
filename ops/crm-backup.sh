#!/bin/bash
#
# Taegliche Sicherung der CRM-Datenbank.
#
# WARUM DIESES SKRIPT SO MISSTRAUISCH IST
#
# Vor dem 2026-08-31 gab es keine einzige Sicherung: keine geplante, keine je
# ausgefuehrte, ein leeres Backup-Verzeichnis — und im Repository eine Datei
# namens `pg_dump` mit null Byte. Genau das ist die gefaehrlichste Form: etwas,
# das wie eine Sicherung aussieht und keine ist.
#
# Deshalb wird jede Sicherung nach dem Schreiben geprueft, und eine, die die
# Pruefung nicht besteht, wird geloescht statt aufbewahrt. Lieber eine Luecke,
# die man sieht, als eine Datei, auf die man sich verlaesst.
#
# NIEMALS --no-privileges. Ein solcher Dump wuerde beim Zurueckspielen 22
# Funktionen wieder fuer anon oeffnen — die Luecke, die 2026 geschlossen wurde.

set -uo pipefail

CONTAINER=supabase-db-aw0c0w440o8k0cccokow0csw
ZIEL=/data/crm-backups
LOG=$ZIEL/backup.log
BEHALTEN=30           # Tage; bei ~3 MB je Sicherung sind das unter 100 MB
STATUS=$ZIEL/.letzter-lauf

melde() { echo "$(date '+%Y-%m-%d %H:%M:%S')  $*" >> "$LOG"; }

abbruch() {
  melde "FEHLGESCHLAGEN: $*"
  echo "fehlgeschlagen $(date -Iseconds): $*" > "$STATUS"
  exit 1
}

install -d -m 700 "$ZIEL" || abbruch "Zielverzeichnis nicht anlegbar"

docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true \
  || abbruch "Datenbankcontainer laeuft nicht"

DATEI="$ZIEL/crm-postgres-$(date +%Y%m%d-%H%M).dump"

if ! docker exec -i "$CONTAINER" pg_dump -U postgres -d postgres -Fc --no-password > "$DATEI" 2>>"$LOG"; then
  rm -f "$DATEI"
  abbruch "pg_dump brach ab"
fi
chmod 600 "$DATEI"

# Groesse: eine echte Sicherung dieser Datenbank liegt bei rund 3 MB. Alles
# unter 500 kB ist keine, egal was der Rueckgabewert sagt.
GROESSE=$(stat -c%s "$DATEI")
if [ "$GROESSE" -lt 500000 ]; then
  rm -f "$DATEI"
  abbruch "Sicherung nur $GROESSE Byte gross — verworfen"
fi

# Inhaltsverzeichnis lesen. pg_restore muss im Archiv springen koennen, deshalb
# liegt die Datei dafuer kurz im Container statt auf der Standardeingabe.
docker cp "$DATEI" "$CONTAINER:/tmp/pruef.dump" >/dev/null 2>&1 \
  || { rm -f "$DATEI"; abbruch "Sicherung nicht in den Container kopierbar"; }

TOC=$(docker exec "$CONTAINER" pg_restore --list /tmp/pruef.dump 2>&1)
AUSGANG=$?
docker exec "$CONTAINER" rm -f /tmp/pruef.dump >/dev/null 2>&1

if [ $AUSGANG -ne 0 ]; then
  rm -f "$DATEI"
  abbruch "Sicherung nicht lesbar: $(echo "$TOC" | head -1)"
fi

DATEN=$(echo "$TOC" | grep -c 'TABLE DATA')
ACL=$(echo "$TOC" | grep -c ' ACL ')
POLICY=$(echo "$TOC" | grep -c ' POLICY ')

# Ohne Tabellendaten ist es ein Schemaabzug, keine Sicherung.
[ "$DATEN" -lt 50 ] && { rm -f "$DATEI"; abbruch "nur $DATEN Datenabschnitte — kein vollstaendiger Abzug"; }
# Ohne ACL-Eintraege waere es der --no-privileges-Fall, der Rechte oeffnet.
[ "$ACL"   -lt 100 ] && { rm -f "$DATEI"; abbruch "nur $ACL ACL-Eintraege — Rechte fehlen im Abzug"; }
[ "$POLICY" -lt 100 ] && { rm -f "$DATEI"; abbruch "nur $POLICY Policies — RLS fehlt im Abzug"; }

# Rollen liegen im Cluster, nicht in der Datenbank — ein pg_dump enthaelt sie
# NICHT. Die Probewiederherstellung am 2026-08-31 hat das gezeigt: 15 Meldungen
# "role does not exist", weil anon, authenticated, service_role und die uebrigen
# im Zielcluster fehlten. Ohne diese Datei laesst sich ein verlorener Cluster
# nicht vollstaendig wiederherstellen.
ROLLEN="${DATEI%.dump}.rollen.sql"
if ! docker exec -i "$CONTAINER" pg_dumpall -U postgres --roles-only --no-password > "$ROLLEN" 2>>"$LOG"; then
  rm -f "$ROLLEN"
  melde "WARNUNG: Rollenabzug fehlgeschlagen — die Datensicherung selbst steht"
else
  chmod 600 "$ROLLEN"
  ROLLENZAHL=$(grep -c '^CREATE ROLE' "$ROLLEN")
  if [ "$ROLLENZAHL" -lt 10 ]; then
    rm -f "$ROLLEN"
    melde "WARNUNG: nur $ROLLENZAHL Rollen im Abzug — verworfen"
  fi
fi

melde "ok  $(basename "$DATEI")  $(numfmt --to=iec "$GROESSE")  Daten=$DATEN ACL=$ACL Policies=$POLICY Rollen=${ROLLENZAHL:-0}"
echo "ok $(date -Iseconds) $(basename "$DATEI") $GROESSE" > "$STATUS"

# Aufraeumen erst NACH einer geglueckten Sicherung — nie die alten wegwerfen,
# solange keine neue steht.
ENTFERNT=$(find "$ZIEL" -maxdepth 1 \( -name 'crm-postgres-*.dump' -o -name 'crm-postgres-*.rollen.sql' \) -mtime +$BEHALTEN -print -delete | wc -l)
[ "$ENTFERNT" -gt 0 ] && melde "aufgeraeumt: $ENTFERNT Sicherung(en) aelter als $BEHALTEN Tage"

exit 0
