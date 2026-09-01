# Notfall: das System wiederherstellen

Dieses Dokument liest man, wenn der Server weg ist. Es steht deshalb allein und
verweist nur dort auf anderes, wo es sein muss.

Die laufende Einrichtung ist in [DATENSICHERUNG.md](DATENSICHERUNG.md)
beschrieben. Hier geht es ausschliesslich um den Weg zurueck.

---

## Was man dafuer braucht

Zwei Dinge. Fehlt eines davon, geht es nicht weiter.

1. **Zugang zur Hetzner Storage Box** — `u660829@u660829.your-storagebox.de`,
   **Port 23**. Der Serverschluessel lag auf dem verlorenen Rechner; in diesem
   Fall im Hetzner-Konto einen neuen Zugang einrichten.
2. **Der private Schluessel** — `wiederherstellung.key.pem`. Er lag NIE auf dem
   Server, sondern beim Betreiber (Passwortmanager). Ohne ihn ist jede
   ausgelagerte Sicherung wertlos; daran ist nichts zu retten.

---

## Was in der Box liegt

Je Sicherungslauf vier verschluesselte Dateien:

| Datei | Inhalt |
|---|---|
| `crm-postgres-<datum>.dump.enc` | die Datenbank |
| `crm-postgres-<datum>.rollen.sql.enc` | die Cluster-Rollen |
| `crm-storage-<datum>.tar.gz.enc` | die hochgeladenen Dateien (MinIO) |
| `crm-konfig-<datum>.tar.gz.enc` | `.env`, `docker-compose.yml`, alle Edge Functions |

**Die vierte ist die, ohne die man Daten hat und kein System.** Sie enthaelt die
123 Umgebungsvariablen — darunter `JWT_SECRET` und `ANON_KEY` — und die 41
Functions. Drei davon (`main`, `hello`, `accept-lead`) liegen in KEINEM
git-Repository; `main` ist der Router der Edge-Laufzeit, ohne ihn antwortet
keine einzige Function.

Nimm immer einen **vollstaendigen Satz mit gleichem Zeitstempel**.

---

## Schritt 1 — Alles herunterladen

    rsync -a -e "ssh -i <schluessel> -p 23" \
      u660829@u660829.your-storagebox.de:crm-sicherungen/ ./

## Schritt 2 — Entschluesseln

Fuer jede der vier Dateien:

    openssl cms -decrypt -binary -inform DER \
      -in <datei>.enc \
      -inkey wiederherstellung.key.pem \
      -out <datei>
    echo $?

> ⚠️ **Auf diese Zahl achten, nicht auf die Datei.**
> Mit einem falschen Schluessel endet openssl mit **4** und meldet `bad decrypt`
> — schreibt aber trotzdem eine Ausgabedatei in **voller Groesse**, gefuellt mit
> Muell. Wer unter Druck nur sieht, dass eine 3-MB-Datei entstanden ist, haelt
> eine unbrauchbare Sicherung fuer eine gute. Nachgestellt: gleiche Groesse,
> voellig anderer Inhalt.

Gegenprobe nach dem Entschluesseln:

    head -c 5 crm-postgres-<datum>.dump          # muss PGDMP sein
    grep -c '^CREATE ROLE' crm-postgres-<datum>.rollen.sql   # 14
    tar -tzf crm-konfig-<datum>.tar.gz | grep -c 'functions/[^/]*/index.ts$'   # 41

## Schritt 3 — Den Stapel aufsetzen

Aus dem Konfigurationsarchiv:

    tar -xzf crm-konfig-<datum>.tar.gz -C /ziel/

Darin liegen `.env`, `docker-compose.yml`, `entrypoint.sh` und
`volumes/functions/`. Der Stapel laesst sich damit **ohne Coolify** starten:

    cd /ziel && docker compose up -d

`docker compose config --services` zeigt die 15 Dienste — geprueft, die Datei
ist lesbar und vollstaendig.

> **Die `.env` NICHT neu erzeugen.** Aendert sich `JWT_SECRET`, aendert sich der
> `ANON_KEY`; dann muss auch das Frontend mit dem neuen Schluessel neu gebaut
> werden, und bis dahin kommt niemand hinein. Die gesicherte `.env` uebernehmen.

## Schritt 4 — Warten, bis die Datenbank WIRKLICH bereit ist

    until docker exec <db-container> pg_isready -h 127.0.0.1 -U postgres; do sleep 4; done
    sleep 10

> ⚠️ `pg_isready` **ueber den Unix-Socket** meldet schon waehrend der
> Initialisierung Bereitschaft. Wer dann losschreibt, verliert alles beim
> anschliessenden Neustart des Initialisierungsservers. Deshalb `-h 127.0.0.1`.

## Schritt 5 — Rollen zuerst, dann die Daten

    docker cp crm-postgres-<datum>.rollen.sql <db>:/tmp/rollen.sql
    docker exec <db> psql -U supabase_admin -h 127.0.0.1 -d postgres -f /tmp/rollen.sql

    # Vorgeseedete Schemata raeumen — public NICHT anfassen
    docker exec <db> psql -U supabase_admin -h 127.0.0.1 -d postgres \
      -c 'DROP SCHEMA IF EXISTS auth CASCADE;
          DROP SCHEMA IF EXISTS storage CASCADE;
          DROP SCHEMA IF EXISTS realtime CASCADE;'

    docker cp crm-postgres-<datum>.dump <db>:/tmp/w.dump
    docker exec <db> pg_restore -U supabase_admin -h 127.0.0.1 -d postgres /tmp/w.dump

Drei Fallen, alle nachgestellt:

- **`supabase_admin`, nicht `postgres`.** `postgres` ist in diesem Abbild kein
  Superuser und kann nicht in `auth`, `storage` und `realtime` schreiben.
- **`public` NICHT loeschen.** `pg_dump` legt es nicht neu an; loescht man es,
  scheitern 2429 Anweisungen.
- **`auth` schon.** Das Abbild bringt ein altes `auth.users` mit **21** Spalten
  mit, die Produktion hat **35**. Bleibt es stehen, kommen die Anmeldedaten
  stillschweigend nicht an — man merkt es erst, wenn sich niemand anmelden kann.

Danach bleiben rund 19 Meldungen `already exists`. Die sind erwartet.

## Schritt 6 — Die hochgeladenen Dateien

    tar -xzf crm-storage-<datum>.tar.gz -C /ziel/volumes/

`.minio.sys` ist im Archiv und muss mit: darin stehen `format.json`, die
Bucket-Anlage und die Zugangsregeln. Ohne das Verzeichnis erkennt ein frisches
MinIO die Dateien nicht als seine eigenen. Die Wurzelzugangsdaten kommen aus der
Umgebung, nicht aus dem Archiv — neue sind in Ordnung.

## Schritt 7 — Frontend

Aus `main` bauen und ausrollen. Die Bauvariablen (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) muessen zum wiederhergestellten Stapel passen; der
`ANON_KEY` steht in der gesicherten `.env`.

## Schritt 8 — Zaehlen, nicht hoffen

    select count(*) from public.offers;      -- gegen den letzten bekannten Stand
    select count(*) from auth.users;
    select count(*) from pg_policies where schemaname='public';   -- 231
    select count(*) from storage.objects;

---

## Was erprobt ist — und was nicht

**Erprobt, mit Zahlen:**

| Teil | Nachweis |
|---|---|
| Datenbank | 20 von 20 Kennzahlen identisch zur Produktion, inkl. `auth.users` |
| Rollen | 14 `CREATE ROLE`, danach keine `role does not exist`-Meldung mehr |
| Storage | frisches MinIO erkennt Bucket und Objekte; beide byte-genau (12114/9914) |
| Entschluesselung | alle vier Dateien aus der Storage Box, Rueckgabewert 0, byte-genau |
| Konfiguration | `.env` byte-genau (123 Variablen), `docker-compose.yml` auswertbar (15 Dienste), 42 `index.ts` identisch |

**NICHT erprobt:**

> **Das vollstaendige Hochfahren des Stapels aus der Sicherung.** Dafuer muessten
> auf einem Rechner rund zwoelf Container gleichzeitig starten. Der
> Produktionshost lief bei der Probe (2026-09-01) mit einer Last von 9.3 auf 8
> Kernen; eine Vollprobe dort haette das laufende CRM gefaehrdet. Die Teile sind
> einzeln belegt, das Zusammenspiel nicht.
>
> Das gehoert auf einen separaten Rechner und in einen ruhigen Moment. Bis dahin
> ist dieser Ablauf **plausibel und in seinen Einzelteilen geprueft, aber nicht
> als Ganzes durchgespielt.**

Ebenfalls offen: ein fehlgeschlagener Sicherungslauf meldet sich bei niemandem.
Kontrolle bis dahin sind `/data/crm-backups/.letzter-lauf` und die Zeilen `ok`
bzw. `ausgelagert:` in `/data/crm-backups/backup.log`.
