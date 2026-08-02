-- B.2.1: Capability-Token fuer die oeffentlichen Termin-Links.
--
-- ── Warum ──────────────────────────────────────────────────────────────────
--
-- Die Seite /termin/<id>/absagen liest heute `appointments` und `companies`
-- direkt aus dem Browser und schreibt den Status ebenso. Das kann gar nicht
-- funktionieren: auf `appointments` liegt RLS, und die einzigen Policies sind
-- "Admin" und "is_company_member" — fuer `anon` gibt es keine. Der Link traegt
-- statt eines Geheimnisses die E-Mail-Adresse des Kunden im Query-String, also
-- eine personenbezogene Angabe in Verlauf, Referer und Logs.
--
-- Diese Migration legt die Grundlage fuer den Ersatz: ein Zufallstoken je
-- Termin und eine SECURITY-DEFINER-Funktion, die damit genau die Felder
-- herausgibt, die die oeffentliche Seite anzeigen muss. RLS und Tabellenrechte
-- bleiben unangetastet — der oeffentliche Weg fuehrt ausschliesslich ueber die
-- Funktion.
--
-- ── Was sich sofort aendert, und was nicht ─────────────────────────────────
--
-- Am Verhalten der Anwendung aendert sich nichts: die Absage-Seite ist
-- unveraendert, es gibt bis auf Weiteres keinen Leser fuer das Token, und
-- storniert wird hier gar nichts. `customer_action_token`,
-- `customer_action_token_expires_on`, der Index
-- `appointments_customer_action_token_uniq` und
-- `get_appointment_by_action_token()` sind insofern Vorbereitung.
--
-- In der Datenbank greift dagegen sofort, was in Abschnitt 1 steht:
-- `log_appointment_changes()` schreibt ab jetzt keine Capability-Felder mehr
-- nach `appointment_history`, und die Felder, die dort bereits abgelegt sind,
-- werden aus den vorhandenen `old_data`/`new_data` entfernt. Das ist eine
-- Verhaltensaenderung an einem bestehenden Trigger und ein Eingriff in
-- Bestandsdaten, kein Beiwerk.
--
-- Der Schutz gilt nicht nur den Feldern, die hier entstehen: `reschedule_token`
-- und `reschedule_token_expires_at` gibt es in einem Teil der Installationen
-- schon laenger, und der alte Logger hat sie genauso mitgeschrieben. Die
-- Haertung raeumt also auch einen Abfluss weg, der aelter ist als diese
-- Migration.
--
-- Sie steht trotzdem hier, weil sie hier nicht mehr aufschiebbar ist: die
-- Token-Spalte und der Trigger, der sie mitschreiben wuerde, duerfen nicht
-- getrennt voneinander in Betrieb gehen.
--
-- Der Rollback ist deshalb bewusst unsymmetrisch: er nimmt Spalten, Index und
-- Vorschau-Funktion zurueck, laesst die Haertung von
-- `log_appointment_changes()` aber stehen und stellt die bereinigten
-- Historienfelder nicht wieder her. Waere es anders, wuerde ein Rollback die
-- noch vorhandenen `reschedule_*`-Werte ab der naechsten Terminaenderung erneut
-- im Klartext in die Historie schreiben. Begruendung im Kopf der
-- Rollback-Datei.
--
-- ── Was hier NICHT passiert ────────────────────────────────────────────────
--
-- Kein Stornieren. Die schreibende Seite kommt in einem eigenen Schritt und
-- wird dann nur `service_role` gehoeren; der oeffentliche Aufruf laeuft dort
-- ueber eine Edge Function, die das Token prueft.

BEGIN;

-- ── 1. Der Aenderungs-Logger darf keine Capabilities mitschreiben ──────────
--
-- `log_appointment_changes()` haengt als AFTER INSERT OR UPDATE an
-- `appointments` und legt `to_jsonb(OLD)` bzw. `to_jsonb(NEW)` in
-- `appointment_history` ab — also die GANZE Zeile. Sobald unten die
-- Token-Spalte existiert, waere jede Terminaenderung eine Kopie des Tokens in
-- eine Tabelle, die einen ganz anderen Leserkreis hat als der Link selbst.
-- Ein Capability-Token ist kein Feld, dessen Aenderung man nachvollziehen will;
-- es ist das Geheimnis. Es gehoert nicht in die Historie.
--
-- Deshalb steht diese Ersetzung VOR der neuen Spalte: so gibt es keinen
-- Zeitpunkt, zu dem die Spalte existiert und der alte Logger noch laeuft.
--
-- Verhalten sonst unveraendert: dieselbe Trigger-Signatur, dieselben beiden
-- Zweige, dasselbe `changed_by = auth.uid()`, weiterhin SECURITY DEFINER.
-- Zusaetzlich sind die Bezuege jetzt schema-qualifiziert und der `search_path`
-- ist festgenagelt — bei SECURITY DEFINER ist ein loser Suchpfad ein
-- eigenstaendiges Risiko.
--
-- `jsonb - text[]` entfernt die genannten Schluessel und stoert sich nicht
-- daran, wenn es sie gar nicht gibt. Die beiden `reschedule_*`-Namen stehen
-- deshalb vorsorglich mit in der Liste: die zugehoerige Migration ist nicht
-- ueberall angewandt, und ein Schluessel, den es hier nicht gibt, kostet nichts.
CREATE OR REPLACE FUNCTION public.log_appointment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  -- Werte, die fuer sich genommen einen Zugang oeffnen. Nie in die Historie.
  k_capability constant text[] := ARRAY[
    'customer_action_token',
    'customer_action_token_expires_on',
    'reschedule_token',
    'reschedule_token_expires_at'
  ];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_history (appointment_id, change_type, new_data, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW) - k_capability, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.appointment_history (appointment_id, change_type, old_data, new_data, changed_by)
    VALUES (NEW.id, 'updated', to_jsonb(OLD) - k_capability, to_jsonb(NEW) - k_capability, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.log_appointment_changes() IS
  'Schreibt Termin-Aenderungen nach appointment_history. Capability-Felder '
  '(customer_action_token, customer_action_token_expires_on, reschedule_token, '
  'reschedule_token_expires_at) werden dabei aus old_data/new_data entfernt: '
  'die Historie soll nachvollziehbar machen, was sich geaendert hat, nicht '
  'Zugangsgeheimnisse aufbewahren.';

-- Was der alte Logger bereits weggeschrieben hat, bleibt sonst fuer immer
-- liegen — ein Schluessel verschwindet nicht dadurch, dass die Spalte spaeter
-- geloescht wird. Das hier ist die Bereinigung dieses schon eingetretenen
-- Abflusses, nicht die Behebung der Ursache; die steht oben.
--
-- Bewusst nicht umkehrbar: der Rollback stellt die alte Funktionsdefinition
-- wieder her, aber keine entfernten Geheimnisse. Das ist die richtige Richtung.
DO $$
DECLARE
  k_capability constant text[] := ARRAY[
    'customer_action_token',
    'customer_action_token_expires_on',
    'reschedule_token',
    'reschedule_token_expires_at'
  ];
  v_anzahl integer;
BEGIN
  UPDATE public.appointment_history
     SET old_data = old_data - k_capability,
         new_data = new_data - k_capability
   WHERE old_data ?| k_capability
      OR new_data ?| k_capability;
  GET DIAGNOSTICS v_anzahl = ROW_COUNT;
  IF v_anzahl > 0 THEN
    RAISE NOTICE 'B.2.1: % Historienzeile(n) von Capability-Feldern bereinigt.', v_anzahl;
  END IF;
END
$$;

-- ── 2. Token-Spalte ────────────────────────────────────────────────────────
--
-- Der Backfill haengt daran, ob die Spalte in DIESEM Lauf entsteht — nicht
-- daran, ob einzelne Werte NULL sind.
--
-- Ein `UPDATE ... WHERE customer_action_token IS NULL` waere die naheliegende
-- Formulierung und genau die falsche: NULL ist hier kein "noch nicht gesetzt",
-- sondern die Art, ein Token ZURUECKZUZIEHEN. Beim zweiten Lauf haette eine
-- solche Anweisung jedes widerrufene Token neu vergeben und damit einen
-- gesperrten Link stillschweigend wieder geoeffnet.
--
-- Es gibt hier ueberhaupt KEINEN Backfill per UPDATE mehr, und das ist der
-- Kern dieser Fassung. Auf `appointments` liegen zwei Zeilentrigger:
-- `calculate_appointment_duration` schreibt `duration_minutes` und
-- `updated_at` neu, `log_appointment_changes` legt fuer JEDE Zeile einen
-- Historieneintrag an. Ein `UPDATE ... SET customer_action_token = ...` haette
-- also die Zeitstempel aller Bestandstermine verfaelscht und obendrein jedes
-- frisch gezogene Token in `appointment_history` kopiert — genau dorthin, wo es
-- nichts zu suchen hat.
--
-- Stattdessen entstehen Spalte und Default in EINER DDL-Anweisung. Weil
-- `gen_random_uuid()` volatil ist, schreibt PostgreSQL die Tabelle neu und
-- wertet den Default je Zeile aus: jede Bestandszeile bekommt ihr eigenes
-- Token. DDL feuert keine Zeilentrigger, also bleiben `updated_at`,
-- `duration_minutes` und die Historie unberuehrt. Auf PostgreSQL 15.8
-- nachgemessen (8 Zeilen → 8 verschiedene Token, 0 neue Historienzeilen).
DO $$
DECLARE
  v_neu boolean;
BEGIN
  v_neu := NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_attribute a
     WHERE a.attrelid = 'public.appointments'::regclass
       AND a.attname  = 'customer_action_token'
       AND a.attnum > 0
       AND NOT a.attisdropped
  );

  IF v_neu THEN
    -- Spalte UND Default in einem Zug: der volatile Default wird beim
    -- Tabellen-Rewrite je Zeile ausgewertet, ohne Trigger und ohne UPDATE.
    -- Ab jetzt bekommt auch jede neue Zeile ihr Token von selbst, ohne dass
    -- einer der Erzeugungswege in der Anwendung davon wissen muss.
    ALTER TABLE public.appointments
      ADD COLUMN customer_action_token uuid DEFAULT gen_random_uuid();
  ELSE
    -- Spalte war schon da: Daten bleiben unberuehrt, nur der Default wird
    -- wiederhergestellt, falls er fehlt.
    ALTER TABLE public.appointments
      ALTER COLUMN customer_action_token SET DEFAULT gen_random_uuid();
  END IF;
END
$$;

-- Bewusst NULLABLE. NULL ist der Widerruf: wer einen Link sperren will, setzt
-- das Token auf NULL, und der partielle Index unten laesst beliebig viele
-- solcher Zeilen zu.
COMMENT ON COLUMN public.appointments.customer_action_token IS
  'Capability fuer die oeffentlichen Kunden-Links (absagen/verschieben). '
  'gen_random_uuid() liefert eine UUIDv4 mit 122 Zufallsbits. '
  'NULL bedeutet WIDERRUFEN, nicht "fehlt" — Migrationen duerfen NULL deshalb '
  'nie als "nachzutragen" behandeln.';

-- ── 3. Ablaufdatum, aus dem Termin abgeleitet ──────────────────────────────
--
-- Generiert und gespeichert, damit es nicht gepflegt werden muss: verschiebt
-- jemand den Termin, wandert die Frist automatisch mit. Eine per Trigger oder
-- per Hand gefuehrte Spalte waere eine zweite Wahrheit ueber denselben Sachverhalt.
DO $$
DECLARE
  v_neu boolean;
BEGIN
  v_neu := NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_attribute a
     WHERE a.attrelid = 'public.appointments'::regclass
       AND a.attname  = 'customer_action_token_expires_on'
       AND a.attnum > 0
       AND NOT a.attisdropped
  );

  IF v_neu THEN
    ALTER TABLE public.appointments
      ADD COLUMN customer_action_token_expires_on date
      GENERATED ALWAYS AS (appointment_date + 7) STORED;
  END IF;
END
$$;

COMMENT ON COLUMN public.appointments.customer_action_token_expires_on IS
  'Termindatum + 7 Tage. Generiert und gespeichert: wird der Termin verschoben, '
  'verschiebt sich die Frist mit.';

-- ── 4. Eindeutigkeit, aber nur fuer vergebene Token ────────────────────────
--
-- Partiell, weil NULL der Widerruf ist: beliebig viele widerrufene Zeilen
-- muessen nebeneinander existieren duerfen.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_customer_action_token_uniq
  ON public.appointments (customer_action_token)
  WHERE customer_action_token IS NOT NULL;

-- ── 5. Lesende Funktion fuer die oeffentliche Seite ────────────────────────
--
-- Gibt genau die Felder heraus, die die Absage-Seite anzeigt. Alles Weitere
-- fehlt mit Absicht: Kunden-E-Mail und -Telefon, interne Notizen, Beschreibung,
-- zugewiesene Personen, lead_id/offer_id/customer_id, die Firmen-E-Mail und
-- jede Konfiguration. Wer den Link hat, soll seinen Termin sehen — nicht den
-- Datensatz.
--
-- Keine Ausgabe des Tokens: die Seite hat es bereits, und ein Token in einer
-- Antwort landet in Caches und Logs.
--
-- `sql` + `STABLE`: kein dynamisches SQL, nichts zu injizieren. Alle Bezuege
-- sind schema-qualifiziert, der `search_path` ist festgenagelt.
CREATE OR REPLACE FUNCTION public.get_appointment_by_action_token(
  p_appointment_id uuid,
  p_token uuid
)
RETURNS TABLE (
  id                uuid,
  appointment_date  date,
  start_time        time without time zone,
  end_time          time without time zone,
  all_day           boolean,
  title             text,
  appointment_type  public.appointment_type,
  status            public.appointment_status,
  location_city     text,
  language          text,
  company_name      character varying,
  company_phone     character varying
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    a.id,
    a.appointment_date,
    a.start_time,
    a.end_time,
    a.all_day,
    a.title,
    a.appointment_type,
    a.status,
    a.location_city,
    a.language,
    c.company_name,
    c.phone
  FROM public.appointments a
  JOIN public.companies    c ON c.id = a.company_id
  -- Ein NULL-Token ist ein Widerruf und darf niemals treffen. Ohne diese Zeile
  -- wuerde `a.customer_action_token = p_token` bei NULL zwar auch nicht wahr,
  -- aber die Absicht stuende nirgends.
  WHERE p_token IS NOT NULL
    AND a.id = p_appointment_id
    AND a.customer_action_token = p_token
    AND CURRENT_DATE <= a.customer_action_token_expires_on;
$$;

COMMENT ON FUNCTION public.get_appointment_by_action_token(uuid, uuid) IS
  'Liest einen Termin fuer die oeffentliche Absage-/Verschiebe-Seite anhand des '
  'Capability-Tokens. Gibt bei falscher ID, falschem, abgelaufenem oder '
  'widerrufenem Token gleichermassen NULL Zeilen zurueck — die Faelle sind von '
  'aussen nicht unterscheidbar.';

-- ── 6. Ausfuehrungsrechte ──────────────────────────────────────────────────
--
-- PostgreSQL vergibt EXECUTE beim Anlegen automatisch an PUBLIC. Das ist ein
-- Recht, das niemand angeordnet hat, und es steht in keinem Grant-Schnappschuss
-- als bewusste Entscheidung. Erst wegnehmen, dann benannt vergeben.
--
-- `authenticated` ist dabei kein Versehen: der Link soll auch dann
-- funktionieren, wenn im selben Browser gerade jemand am Dashboard angemeldet ist.
REVOKE ALL ON FUNCTION public.get_appointment_by_action_token(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_appointment_by_action_token(uuid, uuid)
  TO anon, authenticated, service_role;

-- ── 7. Nachpruefung, fail-closed und EXAKT ─────────────────────────────────
--
-- Alles oben ist eine Absicht; hier wird gemessen, was wirklich im Katalog
-- steht. Faellt eine Pruefung durch, nimmt die Ausnahme die ganze Transaktion
-- mit — eine halb angelegte Capability waere schlimmer als keine.
--
-- Jede Pruefung vergleicht den GANZEN Vertrag auf einmal, nicht "ist etwas da".
-- Ein Index mit dem richtigen Namen auf der falschen Spalte, eine Token-Spalte,
-- die jemand auf NOT NULL gezogen hat, eine Ablaufspalte mit `+ 30` statt `+ 7`:
-- das sind genau die Zustaende, die ein Vorgaenger-Lauf oder eine fremde Hand
-- hinterlassen kann, und die eine blosse Existenzpruefung durchwinkt.
--
-- Die Vergleichszeichenketten sind die NORMALISIERTEN Formen, die PostgreSQL
-- selbst speichert (an einer echten Instanz gemessen), nicht die Schreibweise
-- aus dem Quelltext oben. `pg_get_expr` gibt `(appointment_date + 7)` zurueck,
-- nicht `appointment_date + 7`.
DO $$
DECLARE
  v_oid       oid;
  v_anzahl    integer;
  v_namen     text[];
  v_typen     oid[];
  v_erw_namen text[] := ARRAY[
    'id','appointment_date','start_time','end_time','all_day','title',
    'appointment_type','status','location_city','language',
    'company_name','company_phone'
  ];
  v_erw_typen oid[] := ARRAY[
    'uuid','date','time without time zone','time without time zone','boolean','text',
    'public.appointment_type','public.appointment_status','text','text',
    'character varying','character varying'
  ]::regtype[]::oid[];
BEGIN
  -- (1) Token-Spalte: Typ, nicht-dropped, NULLABLE, nicht generiert, exakter Default.
  --     NULLABLE ist hier eine Zusicherung, kein Zufall: NULL ist der Widerruf.
  PERFORM 1
    FROM pg_catalog.pg_attribute a
    LEFT JOIN pg_catalog.pg_attrdef d
           ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.appointments'::regclass
     AND a.attname  = 'customer_action_token'
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.atttypid = 'uuid'::regtype
     AND a.attnotnull = false
     AND a.attgenerated = ''
     AND d.adbin IS NOT NULL
     AND pg_catalog.pg_get_expr(d.adbin, d.adrelid) = 'gen_random_uuid()';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 1: customer_action_token entspricht nicht dem Vertrag '
                    '(uuid, nullable, nicht generiert, DEFAULT gen_random_uuid())';
  END IF;

  -- (2) Ablaufspalte: Typ, STORED GENERATED und exakt die vereinbarte Formel.
  --     `attgenerated = ''s''` allein wuerde `+ 30` genauso durchlassen.
  PERFORM 1
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_attrdef d
      ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.appointments'::regclass
     AND a.attname  = 'customer_action_token_expires_on'
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.atttypid = 'date'::regtype
     AND a.attgenerated = 's'
     AND pg_catalog.pg_get_expr(d.adbin, d.adrelid) = '(appointment_date + 7)';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 2: customer_action_token_expires_on ist nicht '
                    'date STORED GENERATED AS (appointment_date + 7)';
  END IF;

  -- (3) Der Index — vollstaendig. Name allein sagt nichts: entscheidend sind
  --     Schema, Tabelle, genau EINE Schluesselspalte, dass diese Spalte die
  --     Token-Spalte ist, kein INCLUDE, kein Ausdruck, unique, gueltig/bereit/
  --     lebendig, und exakt dieses Praedikat.
  PERFORM 1
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class     ic  ON ic.oid  = i.indexrelid
    JOIN pg_catalog.pg_namespace ins ON ins.oid = ic.relnamespace
   WHERE ic.relname  = 'appointments_customer_action_token_uniq'
     AND ins.nspname = 'public'
     AND i.indrelid  = 'public.appointments'::regclass
     AND i.indisunique
     AND i.indisvalid AND i.indisready AND i.indislive
     AND i.indnatts    = 1     -- keine INCLUDE-Spalte
     AND i.indnkeyatts = 1     -- kein zweiter Schluessel
     AND i.indexprs IS NULL    -- kein Ausdrucksindex
     AND i.indkey[0] = (
           SELECT a.attnum FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = 'public.appointments'::regclass
              AND a.attname  = 'customer_action_token'
              AND NOT a.attisdropped)
     AND pg_catalog.pg_get_expr(i.indpred, i.indrelid)
         = '(customer_action_token IS NOT NULL)';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 3: appointments_customer_action_token_uniq ist nicht der '
                    'partielle UNIQUE-Index auf customer_action_token';
  END IF;

  -- (4) Genau eine Signatur.
  SELECT count(*), min(p.oid) INTO v_anzahl, v_oid
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'get_appointment_by_action_token';
  IF v_anzahl <> 1 THEN
    RAISE EXCEPTION 'Pruefung 4: erwartet genau 1 Signatur, gefunden %', v_anzahl;
  END IF;

  -- (5) Die Funktion selbst, ganzer Vertrag in einer Abfrage.
  PERFORM 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_language l ON l.oid = p.prolang
   WHERE p.oid = v_oid
     -- Namen gehoeren zur Signatur: PostgREST ruft benannt auf (p_appointment_id/p_token).
     AND pg_catalog.pg_get_function_identity_arguments(p.oid)
         = 'p_appointment_id uuid, p_token uuid'
     AND l.lanname     = 'sql'
     AND p.provolatile = 's'          -- STABLE
     AND p.prosecdef                   -- SECURITY DEFINER
     AND p.proretset                   -- mengenwertig
     AND p.proconfig = ARRAY['search_path=pg_catalog, public']
     AND p.proacl IS NOT NULL;         -- Rechte ausdruecklich gesetzt, nicht geerbt
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 5: get_appointment_by_action_token entspricht nicht dem '
                    'Vertrag (sql/STABLE/SECURITY DEFINER/set-returning/'
                    'search_path=pg_catalog, public/eigene ACL)';
  END IF;

  -- (6) Kein direkter PUBLIC-Eintrag in der ACL. `grantee = 0` ist PUBLIC.
  PERFORM 1
    FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) x
   WHERE p.oid = v_oid AND x.grantee = 0;
  IF FOUND THEN
    RAISE EXCEPTION 'Pruefung 6: die Funktion traegt einen direkten PUBLIC-Grant';
  END IF;

  -- (7) Die drei benannten Rollen duerfen ausfuehren.
  IF NOT (pg_catalog.has_function_privilege('anon',          v_oid, 'EXECUTE')
      AND pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE')
      AND pg_catalog.has_function_privilege('service_role',  v_oid, 'EXECUTE')) THEN
    RAISE EXCEPTION 'Pruefung 7: anon/authenticated/service_role fehlt EXECUTE';
  END IF;

  -- (8) Ergebnisspalten: Namen UND Typen, in dieser Reihenfolge. Ein Vergleich
  --     nur der Namen liesse zu, dass jemand `title` von text auf etwas anderes
  --     zieht und die Zusicherung trotzdem besteht.
  SELECT array_agg(nm ORDER BY ord), array_agg(ty ORDER BY ord)
    INTO v_namen, v_typen
    FROM (
      SELECT unnest(p.proargnames)     AS nm,
             unnest(p.proargmodes)     AS md,
             unnest(p.proallargtypes)  AS ty,
             generate_subscripts(p.proargnames, 1) AS ord
        FROM pg_catalog.pg_proc p
       WHERE p.oid = v_oid
    ) s
   WHERE s.md = 't';
  IF v_namen IS DISTINCT FROM v_erw_namen THEN
    RAISE EXCEPTION 'Pruefung 8a: Ergebnisspalten % weichen von der Erlaubnisliste % ab',
      v_namen, v_erw_namen;
  END IF;
  IF v_typen IS DISTINCT FROM v_erw_typen THEN
    RAISE EXCEPTION 'Pruefung 8b: Ergebnistypen weichen vom Vertrag ab (%)',
      (SELECT string_agg(pg_catalog.format_type(t, NULL), ', ') FROM unnest(v_typen) t);
  END IF;

  -- (9) Der Logger: Katalogvertrag. Ein AFTER-Trigger, der als SECURITY DEFINER
  --     laeuft, ist selbst ein Angriffsziel — Suchpfad und Rechte gehoeren
  --     genauso festgenagelt wie bei der Lesefunktion.
  SELECT p.oid INTO v_oid
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'log_appointment_changes';
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Pruefung 9: log_appointment_changes fehlt';
  END IF;

  PERFORM 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_language l ON l.oid = p.prolang
   WHERE p.oid = v_oid
     AND p.prorettype = 'pg_catalog.trigger'::regtype
     AND l.lanname    = 'plpgsql'
     AND p.prosecdef
     AND p.proconfig  = ARRAY['search_path=pg_catalog, public'];
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 9: log_appointment_changes entspricht nicht dem '
                    'Vertrag (trigger/plpgsql/SECURITY DEFINER/search_path=pg_catalog, public)';
  END IF;

  -- (10) Und die Redaktion selbst: alle vier Capability-Namen muessen im
  --      installierten Quelltext stehen, und kein Zweig darf `to_jsonb` ohne
  --      den Abzug verwenden. Geprueft wird die Definition, die WIRKLICH in der
  --      Datenbank liegt — nicht die Datei, aus der sie kam.
  SELECT count(*) INTO v_anzahl
    FROM unnest(ARRAY['customer_action_token','customer_action_token_expires_on',
                      'reschedule_token','reschedule_token_expires_at']) AS k
   WHERE (SELECT p.prosrc FROM pg_catalog.pg_proc p WHERE p.oid = v_oid) LIKE '%' || k || '%';
  IF v_anzahl <> 4 THEN
    RAISE EXCEPTION 'Pruefung 10: die Redaktionsliste im Logger nennt nur % von 4 Capability-Feldern', v_anzahl;
  END IF;

  SELECT count(*) INTO v_anzahl
    FROM regexp_matches(
           (SELECT p.prosrc FROM pg_catalog.pg_proc p WHERE p.oid = v_oid),
           'to_jsonb\s*\(\s*(NEW|OLD)\s*\)\s*(?!\s*-)', 'g') m;
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Pruefung 10: % Stelle(n) im Logger schreiben die Zeile ungekuerzt weg', v_anzahl;
  END IF;

  -- (11) Datenstand: keine Historienzeile darf ein Capability-Feld tragen.
  SELECT count(*) INTO v_anzahl
    FROM public.appointment_history h
   WHERE h.old_data ?| ARRAY['customer_action_token','customer_action_token_expires_on',
                             'reschedule_token','reschedule_token_expires_at']
      OR h.new_data ?| ARRAY['customer_action_token','customer_action_token_expires_on',
                             'reschedule_token','reschedule_token_expires_at'];
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Pruefung 11: % Historienzeile(n) tragen weiterhin ein Capability-Feld', v_anzahl;
  END IF;

  RAISE NOTICE 'B.2.1: alle 11 Nachpruefungen bestanden (exakt, nicht nur vorhanden).';
END
$$;

COMMIT;
