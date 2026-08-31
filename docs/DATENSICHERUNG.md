# Datensicherung und Wiederherstellung

Stand 2026-08-31. Jede Zahl hier ist gemessen, nicht geschaetzt.

## Wie der Zustand vorher war

Es gab keine Sicherung. Nicht "eine veraltete" — gar keine:

    scheduled_database_backups            0 Zeilen
    scheduled_database_backup_executions  nie ausgefuehrt
    /data/coolify/backups/                leer
    ./pg_dump im Repo                     0 Byte

Live waren zu dem Zeitpunkt 119 Kunden, 96 Offerten, 26 Auftraege, 31 Rechnungen.

Die letzte Zeile ist die gefaehrlichste: eine Datei namens `pg_dump`, die
aussieht wie eine Sicherung und keine ist. Deshalb prueft das Skript unten jede
Sicherung nach dem Schreiben und **loescht** sie, wenn sie die Pruefung nicht
besteht. Lieber eine Luecke, die man sieht.

## Was jetzt laeuft

`/usr/local/bin/crm-backup.sh` auf `213.199.45.205`, taeglich um 03:17 per cron.

Je Lauf entstehen zwei Dateien in `/data/crm-backups/` (Modus 700, Dateien 600):

| Datei | Inhalt | Groesse |
|---|---|---|
| `crm-postgres-<datum>.dump` | die Datenbank, Format `custom` | ~2.9 MB |
| `crm-postgres-<datum>.rollen.sql` | die Cluster-Rollen | ~5 KB |
| `crm-storage-<datum>.tar.gz` | die hochgeladenen Dateien aus MinIO | ~27 KB |
| `*.enc` | dieselben drei, verschluesselt fuer die Auslagerung | ~2.9 MB |

Aufbewahrung 30 Tage. Protokoll: `/data/crm-backups/backup.log`,
letzter Lauf zusaetzlich in `/data/crm-backups/.letzter-lauf`.

**Warum zwei Dateien.** Rollen liegen im Cluster, nicht in der Datenbank — ein
`pg_dump` enthaelt sie nicht. Die Probewiederherstellung hat das gezeigt: 15
Meldungen `role does not exist`, weil `anon`, `authenticated`, `service_role`
und die uebrigen im Zielcluster fehlten. Mit der Rollendatei zuerst
eingespielt verschwinden diese Meldungen vollstaendig.

**`--no-privileges` ist verboten.** Ein so erzeugter Abzug spielt sich sauber
zurueck und oeffnet dabei 22 Funktionen wieder fuer `anon` — die Luecke, die
2026 geschlossen wurde. Das Skript weist einen Abzug mit weniger als 100
ACL-Eintraegen zurueck; nachgestellt, es haelt.

**Warum drei Dateien.** Der Dump enthaelt `storage.objects` — die Buchhaltung
darueber, welche Datei es gibt und wem sie gehoert — aber kein einziges Byte des
Inhalts. Wer nur den Dump hat, bekommt eine Storage-Tabelle voller Verweise ins
Leere. Das Archiv nimmt auch `.minio.sys` mit: darin stehen `format.json`, die
Bucket-Anlage und die Zugangsregeln. Ohne dieses Verzeichnis erkennt ein
frisches MinIO die zurueckgespielten Dateien nicht als seine eigenen.

Stand 2026-09-01 sind das **2 Objekte, 22 kB** — zwei Firmenlogos. `document-pdfs`
und `besichtigung-uploads` sind leer: Offerten-PDFs werden bei jedem Abruf neu
erzeugt und nirgends abgelegt. Die Mechanik entstand also, solange sie nichts
kostete, nicht an dem Tag, an dem jemand anfaengt, Besichtigungsfotos
hochzuladen.

Ein Storage-Problem darf die Datensicherung nicht mitreissen: fehlt das
Verzeichnis oder ist das Archiv unbrauchbar, wird das protokolliert und
verworfen — der Datenbankteil laeuft trotzdem durch und das Skript endet mit 0.
Nachgestellt, es haelt.

## Was das Skript prueft, bevor es eine Sicherung behaelt

| Pruefung | Schwelle | nachgestellt |
|---|---|---|
| Datenbankcontainer laeuft | — | ja, bricht ab |
| Dateigroesse | > 500 kB | ja, 7-Byte-Datei verworfen |
| Archiv lesbar (`pg_restore --list`) | — | ja |
| Tabellendatenabschnitte | >= 50 | — |
| ACL-Eintraege | >= 100 | ja, `--no-privileges`-Abzug verworfen |
| RLS-Policies | >= 100 | — |
| Rollen im Rollenabzug | >= 10 | — |
| Storage-Archiv lesbar | — | ja |
| `.minio.sys/format.json` im Archiv | — | ja, sonst verworfen |
| Objektzahl gegen `storage.objects` | Hinweis, kein Abbruch | ja |

Die letzte Zeile ist bewusst nur ein Hinweis: eine Abweichung entsteht auch,
wenn waehrend der Sicherung jemand hochlaedt. Ein Archiv deswegen wegzuwerfen
waere schlimmer als eines mit einer Notiz. (Die erste Fassung zaehlte die
`xl.meta`-Dateien unter `.minio.sys` mit und meldete deshalb bei **jedem** Lauf
eine Abweichung — eine Warnung, die immer feuert, liest bald niemand mehr.)

Faellt eine Pruefung, wird die Datei geloescht, `FEHLGESCHLAGEN` ins Protokoll
geschrieben und mit Rueckgabewert 1 beendet. **Alte Sicherungen werden erst
aufgeraeumt, nachdem eine neue bestanden hat.**

## Wiederherstellung — erprobt, nicht vermutet

Am 2026-08-31 vollstaendig auf einem Wegwerf-Container durchgespielt. Ergebnis:
**20 von 20 Kennzahlen identisch zur Produktion**, einschliesslich `auth.users`
und `auth.identities`, 231 RLS-Policies, 221 Funktionen, 110 Trigger.

    # 1. Ziel bereitstellen und WIRKLICH warten.
    #    pg_isready ueber den Unix-Socket meldet schon waehrend der
    #    Initialisierung Bereitschaft; wer dann losschreibt, verliert alles beim
    #    anschliessenden Neustart. Auf TCP pruefen:
    docker run -d --name ziel -e POSTGRES_PASSWORD=... supabase/postgres:15.8.1.085
    until docker exec ziel pg_isready -h 127.0.0.1 -U postgres; do sleep 4; done
    sleep 10

    # 2. Rollen zuerst.
    docker cp crm-postgres-<datum>.rollen.sql ziel:/tmp/rollen.sql
    docker exec ziel psql -U supabase_admin -h 127.0.0.1 -d postgres -f /tmp/rollen.sql

    # 3. Vorgeseedete Schemata raeumen. public bleibt stehen!
    #    Das Abbild bringt ein altes auth.users mit 21 Spalten mit; die
    #    Produktion hat 35. Bleibt es stehen, scheitert das Einspielen der
    #    Anmeldedaten stillschweigend und man merkt es erst beim Anmelden.
    #    public NICHT loeschen: pg_dump legt es nicht neu an.
    docker exec ziel psql -U supabase_admin -h 127.0.0.1 -d postgres \
      -c 'DROP SCHEMA IF EXISTS auth CASCADE;
          DROP SCHEMA IF EXISTS storage CASCADE;
          DROP SCHEMA IF EXISTS realtime CASCADE;'

    # 4. Daten. Als supabase_admin — postgres ist in diesem Abbild KEIN
    #    Superuser und kann nicht in auth/storage/realtime schreiben.
    docker cp crm-postgres-<datum>.dump ziel:/tmp/w.dump
    docker exec ziel pg_restore -U supabase_admin -h 127.0.0.1 -d postgres /tmp/w.dump

Danach bleiben rund 19 Meldungen der Art `already exists` — das sind Objekte,
die das Abbild selbst mitbringt. Sie sind erwartet.

**Danach zaehlen, nicht hoffen.** Zeilenzahlen der Geschaeftstabellen,
`auth.users`, Anzahl Policies und Funktionen gegen die Quelle vergleichen.

### Storage zurueckspielen — ebenfalls erprobt

    tar -xzf crm-storage-<datum>.tar.gz -C /zielverzeichnis
    docker run -d --name minio -e MINIO_ROOT_USER=... -e MINIO_ROOT_PASSWORD=... \
      -v /zielverzeichnis/storage:/data ghcr.io/coollabsio/minio:<fassung> server /data

Die Wurzelzugangsdaten kommen aus der Umgebung, nicht aus dem Archiv — ein
frisches MinIO nimmt neue an und findet die alten Objekte trotzdem.

Am 2026-09-01 durchgespielt: das frische MinIO meldete den Bucket `stub` und
beide Objekte mit den richtigen Groessen. Beide herausgeholt und gegen die
Datenbank geprueft — 12114 und 9914 Byte, exakt wie in `storage.objects`,
Kopfkennung `RIFF…WEBP`.

## Verschluesselung und Auslagerung

Der Klartext **bleibt** auf dem Server. Wer dort wiederherstellt, hat ohnehin
Zugriff auf die laufende Datenbank; eine Wiederherstellung soll nicht am
Schluessel scheitern. Was den Server **verlaesst**, ist verschluesselt.

Verschluesselt wird gegen `/etc/crm-sicherung.cert.pem`. Der passende private
Schluessel liegt **nicht** auf dem Server, sondern beim Betreiber. Der Server
kann seine eigenen Auslagerungen also nicht wieder oeffnen — nachgestellt, er
scheitert mit `Could not read signing key`. Wer den Server uebernimmt, bekommt
die ausgelagerten Sicherungen nicht dazu.

### Der private Schluessel

    ~/.crm-backup/wiederherstellung.key.pem     (Modus 600)

**Geht dieser Schluessel verloren, ist jede ausgelagerte Sicherung wertlos.**
Die oertlichen Sicherungen auf dem Server bleiben davon unberuehrt — sie liegen
im Klartext. Der Schluessel gehoert in einen Passwortmanager, nicht nur auf eine
Festplatte.

### Entschluesseln

    openssl cms -decrypt -binary -inform DER \
      -in crm-postgres-<datum>.dump.enc \
      -inkey ~/.crm-backup/wiederherstellung.key.pem \
      -out crm-postgres-<datum>.dump
    echo $?      # <-- DIESE Zahl entscheidet

**Auf den Rueckgabewert achten, nicht auf die Datei.** Mit einem falschen
Schluessel endet openssl mit 4 und meldet `bad decrypt` — schreibt aber trotzdem
eine Ausgabedatei in voller Groesse, gefuellt mit Muell. Wer unter Druck nur
sieht, dass eine 3-MB-Datei entstanden ist, haelt eine unbrauchbare Sicherung
fuer eine gute. Nachgestellt: gleiche Groesse, voellig anderer Inhalt, kein
einziges gemeinsames Byte am Anfang.

### Was der Server NICHT pruefen kann

Ob das Verschluesselte auch entschluesselbar ist. Dafuer braeuchte er den
privaten Schluessel, und genau den soll er nicht haben. Das Skript prueft nur
die CMS-Struktur.

Der vollstaendige Hin- und Rueckweg wurde am 2026-09-01 von Hand durchgespielt:
alle drei Dateien heruntergeladen, entschluesselt, byte-genau gegen die
Serverpruefsummen verglichen — `PGDMP` im Dump, 14 `CREATE ROLE`, 2 Objekte im
Storage-Archiv. **Diese Probe gehoert in regelmaessigen Abstaenden wiederholt.**
Sie ist die einzige, die den ganzen Weg abdeckt.

### Auslagerung scharfschalten

Ohne `/etc/crm-sicherung.conf` wird nichts ausgelagert; das Skript ist
vollstaendig und wird durch Ablegen dieser Datei aktiv:

    FERN_ZIEL="uXXXXXX@uXXXXXX.your-storagebox.de:crm-sicherungen/"
    FERN_SSH_KEY="/root/.ssh/storagebox_ed25519"

Uebertragen werden **ausschliesslich** die `.enc`-Dateien. Nach der Uebertragung
prueft das Skript drueben nach, ob die heutige Datei angekommen und gleich gross
ist; erst dann meldet es `ausgelagert`.

Faellt die Auslagerung aus, bleiben die oertlichen Sicherungen stehen und das
Skript endet mit 0. Ein Problem beim Auslagern darf die Sicherung nicht
mitreissen — nachgestellt.

## Was NICHT abgedeckt ist

- **Ueberwachung.** Ein fehlgeschlagener Lauf schreibt ins Protokoll und setzt
  `.letzter-lauf` auf `fehlgeschlagen`, meldet sich aber bei niemandem.

Dieser Punkt ist bekannt und offen, nicht uebersehen. Solange die Auslagerung
nicht scharfgeschaltet ist, gilt zusaetzlich der alte Vorbehalt: alle
Sicherungen liegen auf demselben Host wie die Datenbank.
