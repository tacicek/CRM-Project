#!/usr/bin/env bash
# Gemeinsamer, NUR LESENDER Zugang zur Produktion.
#
# ── WARUM ES DIESE DATEI GIBT ───────────────────────────────────────────────
#
# Bis hierher stand die Frage "rede ich mit der richtigen Instanz?" genau
# einmal im Repo: in refresh-test-baseline.sh. Mit capture-production-truth.sh
# kam ein zweiter Leser dazu. Haette der die Pruefung abgeschrieben, gaebe es
# zwei Fassungen derselben Zusicherung — und die zweite waere genau die Sorte
# stiller Abweichung, gegen die dieses Werkzeug ueberhaupt gebaut wurde: eine
# Kontrolle, die aussieht wie die andere, aber etwas anderes prueft.
#
# Hier steht deshalb NUR, was beide Leser teilen:
#   1. das Ziel (Host, Container) und die Bestaetigung, dass es gemeint ist,
#   2. die Identitaet der Instanz (Cluster-Kennung) und ihre Gestalt,
#   3. der Ferntransport, der jede Anweisung read-only absetzt.
#
# NICHT hier steht, was nur einer der beiden braucht: die Change-Freeze-Zusage
# und die ACL-Projektions-Vorbedingungen gehoeren zum Baseline-Erzeuger, die
# Edge-/Kong-Erhebung gehoert zur Befundaufnahme.
#
# ── LESEND, ABER KEINE SICHERHEITSGRENZE ────────────────────────────────────
#
# Jede Verbindung laeuft mit `PGOPTIONS=-c default_transaction_read_only=on`.
# Das ist ein UNFALLSCHUTZ, keine Grenze: der Wert ist ein GUC, und eine
# Sitzung mit ausreichenden Rechten koennte ihn per `SET` abschalten. Er
# schuetzt vor einem Tippfehler im aufrufenden Skript, nicht vor Absicht.
# Deshalb sind alle hier abgesetzten Anweisungen fest verdrahtet und lesend.
#
# ── AUFRUF ──────────────────────────────────────────────────────────────────
#
#   . scripts/prod-readonly.sh
#   prod_require_target          # Umgebung pruefen, PROD_ZIEL_FINGERPRINT setzen
#   prod_require_read_confirm    # Bestaetigung gegen das Ziel pruefen
#   prod_connect                 # Ferntransport bereitstellen
#   prod_check_identity          # erste Verbindung: Kennung + Gestalt
#
# Vor `prod_connect` wird KEINE Verbindung aufgebaut. Das ist Absicht und wird
# getestet: eine falsche Bestaetigung darf nicht erst am fremden Host auffallen.

# ── Ziel: ausdruecklich, nie voreingestellt ─────────────────────────────────
# Fruehere Fassungen trugen Host und Containernamen als Vorgabewert. Ein
# versehentlicher Aufruf traf damit sofort die echte Produktion.
prod_require_target() {
  : "${CRM_PROD_SSH:?ABBRUCH: CRM_PROD_SSH muss gesetzt sein (kein eingebautes Ziel).}"
  : "${CRM_PROD_DB_CONTAINER:?ABBRUCH: CRM_PROD_DB_CONTAINER muss gesetzt sein.}"
  : "${CRM_PROD_SYSTEM_IDENTIFIER:?ABBRUCH: CRM_PROD_SYSTEM_IDENTIFIER (pg_control_system().system_identifier der erwarteten Instanz) fehlt.}"

  case "$CRM_PROD_SYSTEM_IDENTIFIER" in
    ''|*[!0-9]*) echo "ABBRUCH: CRM_PROD_SYSTEM_IDENTIFIER muss die numerische Cluster-Kennung sein." >&2; return 1 ;;
  esac

  # Ein fuehrender Bindestrich macht aus dem Wert eine Option — `ssh -o ...`
  # bzw. `docker exec -...`. Die Zeichen-Positivliste allein faengt das nicht ab.
  prod_pruefe_name "$CRM_PROD_SSH" 'A-Za-z0-9._@-' "CRM_PROD_SSH" || return 1
  prod_pruefe_name "$CRM_PROD_DB_CONTAINER" 'A-Za-z0-9_.-' "CRM_PROD_DB_CONTAINER" || return 1

  # Die Bestaetigung haengt am GANZEN Ziel, nicht nur an der Kennung: Host,
  # Container und Cluster-Kennung zusammen. Eine kopierte Kommandozeile, bei der
  # irgendeines der drei ausgetauscht wurde, traegt damit die falsche
  # Bestaetigung.
  PROD_ZIEL_FINGERPRINT="$(printf '%s|%s|%s' \
    "$CRM_PROD_SSH" "$CRM_PROD_DB_CONTAINER" "$CRM_PROD_SYSTEM_IDENTIFIER" \
    | sha256sum | cut -d' ' -f1)"
}

# Container-/Hostnamen gegen eine Positivliste. Eigene Funktion, weil die
# Befundaufnahme zwei weitere Container (Edge, Kong) benennt und dieselbe
# Pruefung braucht — abgeschrieben waere sie beim naechsten Mal eine andere.
prod_pruefe_name() {  # $1 = Wert, $2 = erlaubte Zeichenklasse, $3 = Bezeichnung
  case "$1" in
    ''|-*|*[!$2]*) echo "ABBRUCH: ungueltiger $3-Wert." >&2; return 1 ;;
  esac
}

# Der erwartete Wert wird bei Nichtuebereinstimmung ABSICHTLICH NICHT
# ausgegeben. Sonst waere die Bestaetigung ein Formular: einmal laufen lassen,
# Wert abschreiben, fertig. Wie er zu berechnen ist, steht im README.
prod_require_read_confirm() {
  : "${CRM_PROD_READ_CONFIRM:?ABBRUCH: CRM_PROD_READ_CONFIRM fehlt (SHA-256 des Ziels, siehe README).}"
  if [ "$CRM_PROD_READ_CONFIRM" != "$PROD_ZIEL_FINGERPRINT" ]; then
    echo "ABBRUCH: CRM_PROD_READ_CONFIRM passt nicht zum Ziel (Host, Container, Kennung)." >&2
    echo "  Berechnung siehe supabase-test/README.md." >&2
    return 1
  fi
}

# ── Ferntransport ───────────────────────────────────────────────────────────
# SQL wird NICHT in die Fernkommandozeile eingebettet. Die Anweisung kommt ueber
# stdin an `psql -f -`; im Kommando selbst steht nur Festverdrahtetes plus der
# oben gegen eine Positivliste gepruefte Containername. Damit braucht die
# Gegenseite keine bash — einfache Anfuehrungszeichen genuegen jeder POSIX-Shell.
prod_connect() {
  PROD_SSH_HOST="$CRM_PROD_SSH"
  PROD_DB_CONTAINER="$CRM_PROD_DB_CONTAINER"
  # Vorgabe /dev/null: die eigene ssh-Konfiguration wird bewusst NICHT gelesen,
  # damit der Lauf reproduzierbar bleibt. CRM_PROD_SSH_CONFIG hebt das auf.
  PROD_SSH_CONFIG="${CRM_PROD_SSH_CONFIG:-/dev/null}"

  PROD_REMOTE_PREFIX="docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' $PROD_DB_CONTAINER"
  PROD_REMOTE_PSQL="$PROD_REMOTE_PREFIX psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -A -t"
}

ssh_prod() {
  ssh -F "$PROD_SSH_CONFIG" -o BatchMode=yes -o StrictHostKeyChecking=yes \
    -o ConnectTimeout=15 "$PROD_SSH_HOST" "$1"
}

# Fernbefehl OHNE Eingabe. `ssh` liest sonst die stdin des aufrufenden Skripts
# und schickt sie mit — laeuft das Skript aus einer Datei, frisst der erste
# solche Aufruf den Rest davon. Jeder Aufruf, der KEIN SQL ueber stdin schickt,
# geht deshalb hier durch.
ssh_prod_cmd()    { ssh_prod "$1" < /dev/null; }

PROD_SQL()        { ssh_prod "$PROD_REMOTE_PSQL -f -"; }          # SQL ueber stdin
PROD_SQL_FIELDS() { ssh_prod "$PROD_REMOTE_PSQL -F'|' -f -"; }    # dito, Feldtrenner
prod_scalar()     { printf '%s\n' "$1" | PROD_SQL; }

# Eine Ja/Nein-Sonde, die NUR 'true' oder 'false' gelten laesst.
#
# Warum das eine eigene Funktion ist: `(x IS NOT NULL)::text` liefert in
# PostgreSQL 'true'/'false' — NICHT das 't'/'f', das psql fuer eine
# boolean-SPALTE anzeigt. Ein Vergleich gegen 't' ist deshalb immer falsch, und
# zwar still: die Sonde meldet dann "nein" fuer alles. Genau so hat die erste
# Fassung der Befundaufnahme gemeldet, es gebe weder cron-Jobs noch
# Portal-Tabellen, waehrend beides vorhanden war.
#
# Jeder andere Wert ist deshalb ein ABBRUCH und nicht "nein". Eine Sonde, deren
# Fehlschlag wie ein beruhigender Befund aussieht, ist schlimmer als keine.
prod_bool() {  # $1 = SQL, das genau 'true' oder 'false' liefern muss
  local wert
  wert="$(prod_scalar "$1")"
  case "$wert" in
    true|false) printf '%s' "$wert" ;;
    *) echo "ABBRUCH: Ja/Nein-Sonde lieferte '$wert' statt true/false." >&2; return 1 ;;
  esac
}

# ── Identitaet ──────────────────────────────────────────────────────────────
#
# `current_database()`, Serverversion und Tabellennamen sind KEINE Kennung —
# jede Kopie dieses CRM fuer eine andere Firma besteht dieselbe Pruefung. Was
# eine Instanz eindeutig macht, ist die Cluster-Kennung aus pg_control_system();
# sie entsteht bei initdb und wandert bei einem Basis-Backup mit.
#
# Sie wird VORGEGEBEN, nie gelernt: kein Aufrufer liest die Kennung, um sie
# anschliessend als "erwartet" zu speichern. Sonst waere die erste Verbindung
# zur falschen Instanz gleichzeitig deren Legitimation.
PROD_SQL_IDENTITY="SELECT system_identifier::text FROM pg_control_system()"

# Zusaetzlich, und ausdruecklich NICHT als Kennung gemeint: sieht die Datenbank
# ueberhaupt nach dieser Anwendung aus? Das faengt eine richtige Instanz mit
# falscher Datenbank ab, nicht eine falsche Instanz.
PROD_SQL_SHAPE="
SELECT current_database()
  || '|' || current_setting('server_version')
  || '|' || (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relkind='r'
               AND c.relname IN ('companies','company_members','leads','offers','auftraege','customers','payments'))"

# Setzt PROD_SYSTEM_ID, PROD_SHAPE, PROD_QUELL_DB, PROD_SERVER_VERSION.
# Erste Verbindung ueberhaupt — und bei falscher Kennung die einzige.
prod_check_identity() {
  PROD_SYSTEM_ID="$(prod_scalar "$PROD_SQL_IDENTITY")"
  if [ "$PROD_SYSTEM_ID" != "$CRM_PROD_SYSTEM_IDENTIFIER" ]; then
    # WEDER die gesehene NOCH die erwartete Kennung ausgeben. Beides gedruckt
    # macht aus dieser Pruefung ihr Gegenteil: wer die Kennung nicht kennt,
    # bekaeme sie hier geschenkt und koennte den naechsten Lauf damit
    # legitimieren. Die Kennung muss aus einer unabhaengigen Quelle kommen.
    echo "ABBRUCH: source identity mismatch — die Instanz ist nicht die erwartete." >&2
    return 1
  fi

  PROD_SHAPE="$(prod_scalar "$PROD_SQL_SHAPE")"
  PROD_QUELL_DB="${PROD_SHAPE%%|*}"
  local rest="${PROD_SHAPE#*|}"
  PROD_SERVER_VERSION="${rest%%|*}"
  local kernobjekte="${rest##*|}"
  if [ "$kernobjekte" != "7" ]; then
    echo "ABBRUCH: nur $kernobjekte von 7 CRM-Kerntabellen gefunden (db=$PROD_QUELL_DB) — das ist nicht diese Anwendung." >&2
    return 1
  fi
}

# Reden wir am Ende noch mit DERSELBEN Quelle? Eine Aufnahme besteht aus einem
# Dutzend Verbindungen; zwischen zwei davon koennte der Container getauscht, ein
# Failover gelaufen oder die Datenbank gewechselt worden sein. Verglichen wird
# gegen die Werte vom Anfang — ohne sie auszugeben.
prod_recheck_identity() {
  local nach_id nach_shape
  nach_id="$(prod_scalar "$PROD_SQL_IDENTITY")"
  nach_shape="$(prod_scalar "$PROD_SQL_SHAPE")"
  if [ "$nach_id" != "$PROD_SYSTEM_ID" ] || [ "$nach_shape" != "$PROD_SHAPE" ]; then
    echo "ABBRUCH: source identity mismatch am Ende der Aufnahme —" >&2
    echo "  Cluster-Kennung, Datenbank, Serverversion oder Kerntabellen weichen" >&2
    echo "  vom Anfang ab. Es wurde nichts veroeffentlicht." >&2
    return 1
  fi
}
