#!/usr/bin/env bash
#
# Das Postgres-Passwort des CRM-Stacks wechseln.
#
# BEFUND (2026-07-30, auf dem laufenden System nachgesehen)
#   Alle sieben Rollen mit Passwort teilen sich EINEN Wert:
#     authenticator, pgbouncer, postgres, supabase_admin,
#     supabase_auth_admin, supabase_functions_admin, supabase_storage_admin
#   Alle Dienste lesen ihn aus EINER Variablen: SERVICE_PASSWORD_POSTGRES.
#   Die Compose setzt daraus PGRST_DB_URI, GOTRUE_DB_DATABASE_URL,
#   DATABASE_URL (Storage), DB_PASSWORD (Realtime/Analytics),
#   PG_META_DB_PASSWORD und SUPABASE_DB_URL (Edge Functions).
#
#   Derselbe Wert steht im versionierten docs/SUPABASE_MCP_BAGLANTI.md und
#   damit in der Git-Historie. Das ist der Grund fuer diesen Wechsel.
#
# WARUM ES EINE LUECKE GIBT
#   Postgres kennt pro Rolle genau ein Passwort. Zwischen `ALTER ROLE` und dem
#   Neustart der Dienste mit dem neuen Wert schlagen NEUE Verbindungen fehl.
#   Bestehende Verbindungen laufen weiter, bis sie erneuert werden. Die Luecke
#   ist so lang wie der Neustart — rechne mit zwei bis fuenf Minuten und lege
#   sie ausserhalb der Arbeitszeit.
#
# WAS DIESES SKRIPT NICHT TUT
#   Es fasst Coolifys Oberflaeche nicht an. Coolify haelt seinen eigenen Wert
#   in der Datenbank; wird dort spaeter etwas geaendert, ueberschreibt Coolify
#   die .env wieder. Deshalb MUSS der neue Wert auch in der Oberflaeche
#   hinterlegt werden — das Skript sagt an der Stelle Bescheid und wartet.
#
# BENUTZUNG
#   Probelauf (aendert nichts, zeigt jeden Schritt):
#       ./scripts/rotate-db-password.sh
#   Ernstfall:
#       ROTATE_DB_CONFIRM=ja-wirklich ./scripts/rotate-db-password.sh
#
set -euo pipefail

SERVER=root@213.199.45.205
STACK=aw0c0w440o8k0cccokow0csw
ENV_DATEI=/data/coolify/services/$STACK/.env

ROLLEN=(authenticator pgbouncer postgres supabase_admin
        supabase_auth_admin supabase_functions_admin supabase_storage_admin)

ERNSTFALL=${ROTATE_DB_CONFIRM:-}
if [ "$ERNSTFALL" = "ja-wirklich" ]; then
  MODUS="ERNSTFALL"
else
  MODUS="PROBELAUF"
fi

sag() { printf '\n\033[1m%s\033[0m\n' "$*"; }
tun() {
  # Im Probelauf nur zeigen, im Ernstfall ausfuehren.
  if [ "$MODUS" = "PROBELAUF" ]; then
    printf '   [wuerde laufen] %s\n' "$*"
  else
    ssh -o ConnectTimeout=15 -o BatchMode=yes "$SERVER" "$@"
  fi
}
lies() { ssh -o ConnectTimeout=15 -o BatchMode=yes "$SERVER" "$@"; }   # immer echt, nur lesend

sag "Modus: $MODUS"
[ "$MODUS" = "PROBELAUF" ] && echo "   Nichts wird geaendert. Fuer den Ernstfall: ROTATE_DB_CONFIRM=ja-wirklich"

# --- 0. Vorbedingungen ------------------------------------------------------
sag "0/6  Vorbedingungen pruefen"
lies "docker ps --filter name=$STACK --format '{{.Names}} {{.Status}}'" \
  | grep -c "Up" | xargs -I{} echo "   {} Container laufen"
offen=$(lies "ss -tlnp 2>/dev/null | grep -c '0\.0\.0\.0:5432'" || true)
if [ "${offen:-0}" != "0" ]; then
  echo "   ABBRUCH: 5432 ist wieder auf 0.0.0.0 offen. Erst den Port schliessen"
  echo "            (siehe docs/SUPABASE_MCP_BAGLANTI.md), dann rotieren."
  exit 1
fi
echo "   5432 ist nicht oeffentlich — gut."

# --- 1. Neues Geheimnis -----------------------------------------------------
sag "1/6  Altes Passwort merken, neues erzeugen"
# Das alte wird gebraucht: fuer die Gegenprobe (wird es danach abgelehnt?) und
# fuer den Rueckweg, falls zwischen ALTER und Neustart etwas schiefgeht.
ALT=$(lies "docker inspect supabase-db-$STACK --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^POSTGRES_PASSWORD=' | head -1 | cut -d= -f2-")
echo "   altes Passwort gelesen (Abdruck: $(printf '%s' "$ALT" | sha256sum | cut -c1-10))"
echo "   32 Zeichen, nur [A-Za-z0-9] — Sonderzeichen brechen sich an"
echo "   Verbindungszeichenketten und .env-Zitierung."
if [ "$MODUS" = "ERNSTFALL" ]; then
  NEU=$(lies "tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32")
  echo "   erzeugt (Abdruck: $(printf '%s' "$NEU" | sha256sum | cut -c1-10))"
else
  NEU="<wird im Ernstfall erzeugt>"
fi

# --- 2. Sicherung -----------------------------------------------------------
sag "2/6  .env sichern"
tun "cp -n $ENV_DATEI $ENV_DATEI.vor-rotation-\$(date +%Y%m%d%H%M%S)"
echo "   Rueckweg: Sicherung zurueckkopieren, ALTER ROLE mit dem alten Wert"
echo "   wiederholen, Stack neu hochfahren."

# --- 3. .env schreiben ------------------------------------------------------
sag "3/6  Neuen Wert in die .env schreiben"
echo "   SERVICE_PASSWORD_POSTGRES ist der Wert, den die Compose einsetzt."
echo "   POSTGRES_PASSWORD / DB_PASSWORD / PGPASSWORD / PG_META_DB_PASSWORD"
echo "   sind Altlasten mit einem anderen, ungenutzten Wert — sie werden"
echo "   mitgezogen, damit niemand ihnen spaeter glaubt."
# Ueber stdin, nicht ueber die Kommandozeile: was als Argument uebergeben wird,
# steht auf beiden Seiten kurz in der Prozessliste. Fuer ein Skript, dessen
# ganzer Zweck ein Geheimnis ist, waere das die falsche Stelle zum Sparen.
if [ "$MODUS" = "PROBELAUF" ]; then
  echo "   [wuerde laufen] sed -i fuer 5 Schluessel in $ENV_DATEI (Wert ueber stdin)"
else
  ssh -o ConnectTimeout=15 -o BatchMode=yes "$SERVER" "bash -s" <<STDIN
set -e
neu='$NEU'
for k in SERVICE_PASSWORD_POSTGRES POSTGRES_PASSWORD DB_PASSWORD PGPASSWORD PG_META_DB_PASSWORD; do
  sed -i "s|^\${k}=.*|\${k}=\${neu}|" $ENV_DATEI
done
STDIN
  echo "   5 Schluessel geschrieben"
fi

# Ab hier ist ein Abbruch teuer: die Rollen haben das neue Passwort, die
# Container noch das alte. Die Falle sagt, wie man da wieder herauskommt.
if [ "$MODUS" = "ERNSTFALL" ]; then
  trap 'st=$?; [ $st -ne 0 ] && cat <<NOTFALL

  ABBRUCH mit Status $st.
  Falls die Rollen schon umgestellt sind, hilft eines von beiden:
    A) vorwaerts:  cd /data/coolify/services/'"$STACK"' && docker compose up -d --force-recreate
    B) zurueck:    ALTER ROLE ... mit dem alten Passwort (Abdruck '"$(printf '%s' "${ALT:-}" | sha256sum | cut -c1-10)"')
                   und die gesicherte .env zurueckkopieren.
NOTFALL
' EXIT
fi

# --- 4. Rollen umstellen — ab hier laeuft die Luecke ------------------------
sag "4/6  ALTER ROLE fuer alle sieben Rollen  << AB HIER LUECKE >>"
# Ebenfalls ueber stdin. Die Anweisungen landen in einer Datei mit umask 077
# im Container, werden ausgefuehrt und sofort geloescht — so steht das
# Passwort weder in der Prozessliste noch in der Shell-Historie.
if [ "$MODUS" = "PROBELAUF" ]; then
  echo "   [wuerde laufen] BEGIN; ALTER ROLE <7 Rollen> WITH PASSWORD ...; COMMIT;"
  printf '                   Rollen: %s\n' "${ROLLEN[*]}"
else
  ssh -o ConnectTimeout=15 -o BatchMode=yes "$SERVER" "bash -s" <<STDIN
set -e
umask 077
d=\$(mktemp)
trap 'rm -f "\$d"' EXIT
{
  echo 'BEGIN;'
  for r in ${ROLLEN[*]}; do echo "ALTER ROLE \$r WITH PASSWORD '$NEU';"; done
  echo 'COMMIT;'
} > "\$d"
docker cp "\$d" supabase-db-$STACK:/tmp/rot.sql
docker exec supabase-db-$STACK psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/rot.sql
docker exec supabase-db-$STACK rm -f /tmp/rot.sql
STDIN
  echo "   alle 7 Rollen umgestellt"
fi

# --- 5. Dienste mit dem neuen Wert hochfahren -------------------------------
sag "5/6  Stack neu erstellen, damit die Container den neuen Wert bekommen"
tun "cd /data/coolify/services/$STACK && docker compose up -d --force-recreate"

# --- 6. Nachweis ------------------------------------------------------------
sag "6/6  Nachweis"
if [ "$MODUS" = "PROBELAUF" ]; then
  echo "   (im Ernstfall werden hier a-c wirklich geprueft)"
else
  echo "   a) Container:"
  lies "docker ps --filter name=$STACK --format '{{.Names}} {{.Status}}'" \
    | grep -v healthy | grep -v "Up " || echo "      alle gesund"

  # Auch die Pruefung schickt die Passwoerter ueber stdin — sonst stuenden sie
  # ausgerechnet beim Nachweis wieder in der Prozessliste.
  ergebnis=$(ssh -o ConnectTimeout=20 -o BatchMode=yes "$SERVER" "bash -s" <<STDIN
neu='$NEU'
alt='$ALT'
for r in ${ROLLEN[*]}; do
  if docker exec -e PGPASSWORD="\$neu" supabase-db-$STACK \
       psql -h 127.0.0.1 -U "\$r" -d postgres -tAc 'select 1' 2>/dev/null | grep -q '^1\$'; then
    echo "NEU_OK \$r"
  else
    echo "NEU_FEHLER \$r"
  fi
done
if docker exec -e PGPASSWORD="\$alt" supabase-db-$STACK \
     psql -h 127.0.0.1 -U postgres -d postgres -tAc 'select 1' 2>/dev/null | grep -q '^1\$'; then
  echo "ALT_GILT_NOCH"
else
  echo "ALT_ABGELEHNT"
fi
STDIN
)
  fehler=0
  echo "   b) nimmt jede Rolle das NEUE Passwort?"
  while read -r marke rolle; do
    case "$marke" in
      NEU_OK)     printf '      %-26s OK\n' "$rolle" ;;
      NEU_FEHLER) printf '      %-26s FEHLGESCHLAGEN\n' "$rolle"; fehler=1 ;;
    esac
  done <<< "$(printf '%s\n' "$ergebnis" | grep '^NEU_')"

  echo "   c) wird das ALTE Passwort abgelehnt?"
  if printf '%s' "$ergebnis" | grep -q 'ALT_GILT_NOCH'; then
    echo "      NEIN — das alte Passwort gilt noch. Die Rotation ist NICHT wirksam."; fehler=1
  else
    echo "      ja, abgelehnt"
  fi

  if [ "$fehler" -ne 0 ]; then
    echo
    echo "   NACHWEIS FEHLGESCHLAGEN — nicht als erledigt verbuchen."
    exit 1
  fi
  trap - EXIT
  echo
  echo "   Nachweis vollstaendig. Noch von Hand: Anmeldung in der Oberflaeche"
  echo "   probieren (GoTrue) und eine Seite laden, die Daten zieht."
fi

sag "DANACH — zwei Dinge, die dieses Skript NICHT erledigt"
cat <<'NACHARBEIT'
   1. Coolify-Oberflaeche: SERVICE_PASSWORD_POSTGRES auf den neuen Wert setzen.
      Sonst schreibt Coolify beim naechsten Deploy den alten Wert zurueck und
      der Stack faellt aus.
   2. docs/SUPABASE_MCP_BAGLANTI.md: das Passwort dort loeschen und auf
      Coolify als einzige Quelle verweisen.

   Die Git-Historie muss NICHT umgeschrieben werden. Mit dem Wechsel ist der
   alte Wert wertlos; ein Rewrite einer bereits gepushten Historie zerstoert
   alle Klone und bringt hier nichts.
NACHARBEIT
