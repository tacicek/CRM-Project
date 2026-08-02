-- B.2.2: Die schreibende Seite der oeffentlichen Termin-Absage.
--
-- ── Wo das hier sitzt ──────────────────────────────────────────────────────
--
-- B.2.1 hat das Capability-Token und eine lesende Vorschau angelegt. Das hier
-- ist der Zustandsuebergang dazu — und ausdruecklich NICHT der oeffentliche
-- Einstiegspunkt. Der Weg ist:
--
--   Browser → oeffentliche Edge Function → service_role → diese Funktion → DB
--
-- Der Browser bekommt diese Funktion nie zu sehen: `anon` und `authenticated`
-- haben kein EXECUTE, und die Nachpruefung unten besteht darauf. Der Grund ist
-- nicht Misstrauen gegen das Token, sondern Arbeitsteilung — Ratenbegrenzung,
-- Bot-Abwehr und Protokollierung gehoeren in die Edge Function, und eine
-- Funktion, die `anon` direkt aufrufen kann, laesst sich daran vorbei bedienen.
--
-- Diese Migration aendert kein Verhalten der Anwendung: es gibt noch keinen
-- Aufrufer. Frontend, Edge Functions, Erinnerungs-Links und die
-- Benachrichtigungs-Mails bleiben unangetastet.
--
-- ── Warum die ganze Entscheidung in EINER Funktion steckt ──────────────────
--
-- Naheliegend waere: erst per Vorschau-RPC lesen, dann in der Edge Function
-- entscheiden, dann schreiben. Das waere ein Wettlauf. Zwischen Lesen und
-- Schreiben kann jemand denselben Link ein zweites Mal oeffnen, und dann
-- verschickt man zwei Absage-Mails fuer eine Absage — oder man storniert einen
-- Auftrag, der zwischenzeitlich abgeschlossen wurde.
--
-- Deshalb passiert alles in einem Aufruf und unter einer Zeilensperre:
-- pruefen, entscheiden, schreiben. `result_code` sagt dem Aufrufer, was
-- WIRKLICH passiert ist. Nur `cancelled_now` wird spaeter eine Mail
-- rechtfertigen; `already_cancelled` ist die ehrliche Antwort auf einen zweiten
-- Klick und loest nichts aus.
--
-- ── Zwei Fristen, die nicht dasselbe sind ──────────────────────────────────
--
-- Die Token-Frist aus B.2.1 (Termindatum + 7) ist die Lebensdauer des LINKS:
-- wie lange er ueberhaupt noch etwas anzeigt und wie lange eine Wiederholung
-- noch `already_cancelled` bekommt. Sie ist KEINE Erlaubnis, noch einen
-- Zustandsuebergang auszuloesen.
--
-- Fuer eine NEUE Absage gilt der geplante Beginn des Termins als letzte Grenze.
-- Danach ist es keine Absage mehr, sondern ein Nichterscheinen — mit ganz
-- anderen Folgen fuer Planung und Abrechnung. Details an der Pruefung selbst.

BEGIN;

-- ── 1. Die Funktion ────────────────────────────────────────────────────────
--
-- `p_reason` ist der einzige Text, den ein Kunde hier hineinschreiben kann.
-- Er wird beschnitten (nur Leerraum zaehlt als "nichts gesagt") und in der
-- Laenge begrenzt. Die Begrenzung ist ein harter Fehler und keine stille
-- Kuerzung: eine halbierte Begruendung sieht aus wie eine vollstaendige.
--
-- Das Token taucht in keiner Ausgabe und in keiner Fehlermeldung auf. Eine
-- Fehlermeldung landet im Server-Log, und ein Token im Log ist ein Token in
-- fremder Hand.
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_action_token(
  p_appointment_id uuid,
  p_token uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  result_code         text,
  appointment_id      uuid,
  company_id          uuid,
  status              public.appointment_status,
  cancelled_at        timestamptz,
  cancellation_reason text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  -- Bewusst alle mit v_/k_ benannt: die OUT-Parameter oben heissen wie Spalten
  -- von `appointments`. Jede Spalte wird zusaetzlich mit `a.` qualifiziert, damit
  -- kein Bezeichner versehentlich auf einen OUT-Parameter zeigt.
  k_max_reason  constant integer := 2000;
  k_startbar    constant public.appointment_status[] :=
                  ARRAY['pending','confirmed','rescheduled']::public.appointment_status[];
  -- Fest verdrahtet und NICHT aus der Sitzung uebernommen: die Zeitzone
  -- entscheidet hier ueber ein Recht. Eine Verbindung mit `SET timezone =
  -- 'UTC'` wuerde einen Schweizer Termin im Sommer zwei Stunden zu spaet fuer
  -- abgesagt halten.
  k_zone        constant text := 'Europe/Zurich';
  v_reason      text;
  v_status      public.appointment_status;
  v_company     uuid;
  v_cancelled   timestamptz;
  v_ist_grund   text;
  v_beginn      timestamptz;
  v_jetzt       timestamptz;
BEGIN
  -- Ohne beides gibt es nichts zu pruefen. Kein Fehler, sondern schlicht kein
  -- Treffer — genau wie bei einem falschen Token.
  IF p_appointment_id IS NULL OR p_token IS NULL THEN
    RETURN;
  END IF;

  IF p_reason IS NOT NULL AND length(p_reason) > k_max_reason THEN
    RAISE EXCEPTION 'cancellation_reason is longer than % characters', k_max_reason
      USING ERRCODE = '22001';
  END IF;

  -- Nur-Leerraum ist keine Begruendung. NULL ist die ehrlichere Ablage dafuer
  -- als eine Zeichenkette aus Leerzeichen.
  v_reason := nullif(btrim(p_reason, E' \t\r\n'), '');

  -- Der eine Zugriff, der ueber alles entscheidet. Die vier Bedingungen sind
  -- dieselben wie in der Vorschau-Funktion: passende Zeile, Token gesetzt,
  -- Token gleich, Frist nicht abgelaufen. FOR UPDATE haelt die Zeile bis zum
  -- Ende der Transaktion — ein zweiter Aufruf wartet hier, statt parallel
  -- dieselbe Entscheidung zu treffen.
  SELECT a.status, a.company_id, a.cancelled_at, a.cancellation_reason,
         (a.appointment_date + a.start_time) AT TIME ZONE k_zone
    INTO v_status, v_company, v_cancelled, v_ist_grund, v_beginn
    FROM public.appointments a
   WHERE a.id = p_appointment_id
     AND a.customer_action_token IS NOT NULL
     AND a.customer_action_token = p_token
     AND CURRENT_DATE <= a.customer_action_token_expires_on
   FOR UPDATE;

  -- Falsches Token, falsche id, fremdes Token, abgelaufen, widerrufen: alles
  -- dasselbe leere Ergebnis. Wer von aussen probiert, soll nicht unterscheiden
  -- koennen, WARUM es nicht geht.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Der Entscheidungszeitpunkt, genau einmal genommen, und zwar ERST JETZT.
  --
  -- `now()` waere hier falsch, und der Fehler ist nicht theoretisch: `now()`
  -- ist `transaction_timestamp()` und steht schon fest, bevor diese Funktion
  -- ueberhaupt angelaufen ist. Zwischen dem Beginn der Transaktion und der
  -- Zeile darueber kann beliebig viel Zeit vergehen — genau dafuer ist
  -- `FOR UPDATE` ja da. Ein zweiter Aufrufer, der eine Minute in der Sperre
  -- haengt, wuerde mit `now()` die Welt so beurteilen, wie sie beim Warten
  -- ANFING: ein Termin, der inzwischen begonnen hat, gaelte ihm noch als
  -- kuenftig. `statement_timestamp()` verschiebt das Problem nur an den
  -- Anfang der Anweisung; auch der liegt vor dem Warten.
  --
  -- `clock_timestamp()` liest die Uhr in dem Moment, in dem die Entscheidung
  -- faellt — nach der Sperre. Derselbe Wert traegt beides, die Pruefung gegen
  -- den geplanten Beginn und den Zeitstempel der Absage, damit beide dieselbe
  -- Sekunde meinen.
  v_jetzt := clock_timestamp();

  -- Ab hier ist das Token gueltig. Der zweite Klick auf denselben Link ist der
  -- Normalfall, nicht der Fehlerfall: keine Aenderung, keine Historie, kein
  -- erneutes Ausloesen des Auftrags-Triggers — nur die Auskunft, dass es
  -- bereits erledigt ist.
  IF v_status = 'cancelled' THEN
    RETURN QUERY SELECT 'already_cancelled'::text, p_appointment_id, v_company,
                        v_status, v_cancelled, v_ist_grund;
    RETURN;
  END IF;

  -- Erledigt oder nicht erschienen: der Termin hat stattgefunden bzw. ist
  -- abgerechnet worden. Den Ausgang nachtraeglich per Kundenlink umzuschreiben,
  -- waere Datenverlust. Auch jeder kuenftige Status, der nicht ausdruecklich in
  -- k_startbar steht, faellt hier hinein — die Liste ist eine Erlaubnisliste.
  IF NOT (v_status = ANY (k_startbar)) THEN
    RETURN QUERY SELECT 'not_cancellable'::text, p_appointment_id, v_company,
                        v_status, v_cancelled, v_ist_grund;
    RETURN;
  END IF;

  -- Zwei Fristen, die nichts miteinander zu tun haben — sie hier zu verwechseln
  -- waere der eigentliche Fehler:
  --
  --   * Die Token-Frist (`customer_action_token_expires_on`, Termindatum + 7)
  --     sagt, wie lange der LINK ueberhaupt noch etwas beantwortet. Sie ist
  --     absichtlich laenger als der Termin, damit ein Kunde nach der Absage
  --     noch nachsehen kann, dass sie angekommen ist, und damit ein zweiter
  --     Klick `already_cancelled` bekommt statt einer Fehlerseite. Es ist eine
  --     Lese- und Wiederholungsfrist.
  --
  --   * Der geplante Beginn ist die Grenze fuer eine NEUE Absage. Wer nicht
  --     erscheint, waehrend der Termin laeuft oder nachdem er vorbei ist, sagt
  --     nicht mehr ab — er ist nicht erschienen. Das ist eine fachliche
  --     Feststellung des Betriebs (`no_show`, Ausfallhonorar, bereits
  --     angefahrene Monteure) und keine Entscheidung des Links.
  --
  -- Deshalb steht diese Pruefung NACH `already_cancelled`: eine bereits
  -- eingegangene Absage bleibt auch dann eine Absage, wenn der Termin
  -- inzwischen begonnen haette. Die Wiederholung ist Idempotenz, kein neuer
  -- Uebergang.
  --
  -- Ganztaegige Termine bekommen hier bewusst KEINE Sonderregel: `start_time`
  -- ist NOT NULL, also gilt fuer sie dieselbe Rechnung wie fuer jeden anderen
  -- Termin. Eine stille zweite Regel waere schwerer zu pruefen als eine, die
  -- man sieht.
  IF v_jetzt >= v_beginn THEN
    RETURN QUERY SELECT 'not_cancellable'::text, p_appointment_id, v_company,
                        v_status, v_cancelled, v_ist_grund;
    RETURN;
  END IF;

  -- Der Uebergang. Abgelegt wird derselbe Entscheidungszeitpunkt, gegen den
  -- eben geprueft wurde — Serverzeit; eine vom Aufrufer mitgegebene Zeit waere
  -- manipulierbar.
  --
  -- Das Token bleibt ausdruecklich stehen. Es auf NULL zu setzen waere
  -- verlockend ("verbraucht"), wuerde aber den zweiten Klick von
  -- `already_cancelled` in ein leeres Ergebnis verwandeln — der Kunde saehe
  -- statt "ist abgesagt" eine Fehlerseite. Die Frist begrenzt das Token
  -- ohnehin.
  UPDATE public.appointments a
     SET status              = 'cancelled'::public.appointment_status,
         cancelled_at        = v_jetzt,
         cancelled_by        = 'customer',
         cancellation_reason = v_reason
   WHERE a.id = p_appointment_id
  RETURNING a.status, a.company_id, a.cancelled_at, a.cancellation_reason
       INTO v_status, v_company, v_cancelled, v_ist_grund;

  RETURN QUERY SELECT 'cancelled_now'::text, p_appointment_id, v_company,
                      v_status, v_cancelled, v_ist_grund;
END
$function$;

COMMENT ON FUNCTION public.cancel_appointment_by_action_token(uuid, uuid, text) IS
  'Sagt einen Termin anhand des Capability-Tokens ab. Pruefen, Entscheiden und '
  'Schreiben passieren unter einer Zeilensperre in einem Aufruf, damit '
  'gleichzeitige Klicks nicht zwei Absagen erzeugen. result_code: cancelled_now '
  '(dieser Aufruf hat abgesagt — nur hier darf spaeter eine Mail folgen), '
  'already_cancelled (war es schon), not_cancellable (completed oder no_show, '
  'oder der geplante Beginn ist erreicht — danach ist es ein Nichterscheinen, '
  'keine Absage). '
  'Ungueltiges, fremdes, abgelaufenes oder widerrufenes Token: kein Ergebnis. '
  'Nur fuer service_role; der oeffentliche Weg fuehrt ueber eine Edge Function.';

-- ── 2. Ausfuehrungsrechte ──────────────────────────────────────────────────
--
-- Erst alles wegnehmen, dann genau einer Rolle geben. `service_role` steht im
-- REVOKE mit drin, damit die Vergabe unten die einzige Quelle des Rechts ist
-- und ein frueherer Lauf nichts anderes hinterlassen kann.
REVOKE ALL ON FUNCTION public.cancel_appointment_by_action_token(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_action_token(uuid, uuid, text)
  TO service_role;

-- ── 3. Nachpruefung, fail-closed und EXAKT ─────────────────────────────────
--
-- Gemessen wird der Katalog, nicht die Absicht. Faellt eine Pruefung durch,
-- nimmt die Ausnahme die ganze Transaktion mit: eine schreibende Funktion, die
-- versehentlich fuer `anon` offensteht, waere schlimmer als gar keine.
DO $$
DECLARE
  v_oid       oid;
  v_anzahl    integer;
  v_owner     oid;
  v_service   oid;
  v_fremd     text;
  v_namen     text[];
  v_typen     oid[];
  v_erw_namen text[] := ARRAY['result_code','appointment_id','company_id',
                              'status','cancelled_at','cancellation_reason'];
  v_erw_typen oid[]  := ARRAY['text','uuid','uuid','public.appointment_status',
                              'timestamptz','text']::regtype[]::oid[];
BEGIN
  -- (1) Genau eine Signatur.
  SELECT count(*), min(p.oid) INTO v_anzahl, v_oid
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'cancel_appointment_by_action_token';
  IF v_anzahl <> 1 THEN
    RAISE EXCEPTION 'Pruefung 1: erwartet genau 1 Signatur, gefunden %', v_anzahl;
  END IF;

  -- (2) Argumente, Sprache, Volatilitaet, Rechtekontext und Suchpfad — der
  --     ganze Vertrag in einer Abfrage. Die Argumentnamen gehoeren dazu:
  --     PostgREST und die kuenftige Edge Function rufen benannt auf.
  PERFORM 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_language l ON l.oid = p.prolang
   WHERE p.oid = v_oid
     AND pg_catalog.pg_get_function_identity_arguments(p.oid)
         = 'p_appointment_id uuid, p_token uuid, p_reason text'
     AND l.lanname     = 'plpgsql'
     AND p.provolatile = 'v'            -- VOLATILE
     AND p.prosecdef                     -- SECURITY DEFINER
     AND p.proretset                     -- mengenwertig
     AND p.proconfig   = ARRAY['search_path=pg_catalog, public']
     AND p.proacl IS NOT NULL;           -- Rechte ausdruecklich gesetzt
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 2: cancel_appointment_by_action_token entspricht nicht dem '
                    'Vertrag (plpgsql/VOLATILE/SECURITY DEFINER/set-returning/'
                    'search_path=pg_catalog, public/eigene ACL)';
  END IF;

  -- (3) Die ACL EXAKT, nicht nur "kein PUBLIC". Erlaubt sind genau zwei
  --     Eintragsarten: das Recht, das PostgreSQL dem Eigentuemer beim Anlegen
  --     selbst gibt, und der EXECUTE-Grant fuer `service_role`. Alles andere —
  --     eine vergessene Rolle aus einem frueheren Stand, ein Grant an `anon`,
  --     irgendein anderes Privileg — laesst diese Migration scheitern.
  --
  --     Absichtlich wird hier NICHT aufgeraeumt. Ein `REVOKE` auf eine Rolle,
  --     die niemand erwartet hat, wuerde die Ueberraschung stillschweigend
  --     beseitigen und damit die Frage begraben, wie sie hierher kam. Wer den
  --     Fehler sieht, soll ihn entscheiden.
  SELECT p.proowner INTO v_owner FROM pg_catalog.pg_proc p WHERE p.oid = v_oid;
  v_service := pg_catalog.to_regrole('service_role');
  IF v_service IS NULL THEN
    RAISE EXCEPTION 'Pruefung 3: die Rolle service_role gibt es nicht';
  END IF;

  SELECT count(*), string_agg(DISTINCT
           coalesce(acl.grantee::regrole::text, 'PUBLIC') || ':' || acl.privilege_type, ', ')
    INTO v_anzahl, v_fremd
    FROM pg_catalog.pg_proc p,
         LATERAL aclexplode(p.proacl) acl
   WHERE p.oid = v_oid
     AND ( acl.grantee = 0                     -- PUBLIC
        OR acl.privilege_type <> 'EXECUTE'     -- irgendein anderes Privileg
        OR ( acl.grantee <> v_owner AND acl.grantee <> v_service ) );
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Pruefung 3: % unerwartete(r) ACL-Eintrag/-Eintraege: %', v_anzahl, v_fremd;
  END IF;

  -- Und die Gegenrichtung: service_role muss den Grant WIRKLICH direkt haben.
  -- Ein leeres, aber "nichts Verbotenes enthaltendes" ACL waere sonst in
  -- Ordnung, und die Edge Function stuende ohne Recht da.
  PERFORM 1
    FROM pg_catalog.pg_proc p,
         LATERAL aclexplode(p.proacl) acl
   WHERE p.oid = v_oid
     AND acl.grantee = v_service
     AND acl.privilege_type = 'EXECUTE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 3: service_role hat keinen direkten EXECUTE-Grant';
  END IF;

  -- (4) Wirksame Rechte, nicht nur die ACL-Struktur: `has_function_privilege`
  --     beruecksichtigt PUBLIC und Rollenmitgliedschaften. Genau eine Rolle
  --     darf ausfuehren.
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_proc p,
         LATERAL aclexplode(p.proacl) acl
   WHERE p.oid = v_oid
     AND acl.grantee IN (pg_catalog.to_regrole('anon'), pg_catalog.to_regrole('authenticated'));
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Pruefung 4: anon/authenticated haben % direkte(n) Grant(s)', v_anzahl;
  END IF;

  IF pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Pruefung 4: anon kann die Funktion ausfuehren';
  END IF;
  IF pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Pruefung 4: authenticated kann die Funktion ausfuehren';
  END IF;
  IF NOT pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Pruefung 4: service_role kann die Funktion NICHT ausfuehren';
  END IF;

  -- (5) Ergebnisspalten: Namen UND Typen, in dieser Reihenfolge. Nur die Namen
  --     zu vergleichen liesse zu, dass jemand `status` auf text zieht und die
  --     Zusicherung trotzdem besteht.
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
    RAISE EXCEPTION 'Pruefung 5a: Ergebnisspalten % weichen vom Vertrag % ab',
      v_namen, v_erw_namen;
  END IF;
  IF v_typen IS DISTINCT FROM v_erw_typen THEN
    RAISE EXCEPTION 'Pruefung 5b: Ergebnistypen weichen vom Vertrag ab (%)',
      (SELECT string_agg(pg_catalog.format_type(t, NULL), ', ') FROM unnest(v_typen) t);
  END IF;

  RAISE NOTICE 'B.2.2: alle 5 Nachpruefungen bestanden (exakt, nicht nur vorhanden).';
END
$$;

COMMIT;
