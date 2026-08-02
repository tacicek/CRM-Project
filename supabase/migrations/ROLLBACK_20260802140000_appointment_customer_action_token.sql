-- Rollback zu 20260802140000_appointment_customer_action_token.sql
--
-- ── Ein absichtlich unsymmetrischer Rollback ───────────────────────────────
--
-- ZURUECKGENOMMEN wird alles, was zum Kunden-Link gehoert:
--   * die Funktion `get_appointment_by_action_token(uuid, uuid)`
--   * der Index `appointments_customer_action_token_uniq`
--   * die Spalte `appointments.customer_action_token_expires_on`
--   * die Spalte `appointments.customer_action_token`
--
-- STEHEN BLEIBT die gehaertete Fassung von `log_appointment_changes()`, und
-- NICHT WIEDERHERGESTELLT werden die Capability-Felder, die die Vorwaerts-
-- Migration aus vorhandenen `appointment_history`-Zeilen entfernt hat.
--
-- Das ist kein unvollstaendiger Rollback, sondern die einzige Fassung, die
-- sicher ist. Der Grund steht in einer Spalte, die dieser Rollback gar nicht
-- anfasst: `appointments.reschedule_token` (mit
-- `reschedule_token_expires_at`) gibt es in einem Teil der Installationen, und
-- sie gehoert nicht zu dieser Migration — sie wird hier weder angelegt noch
-- geloescht. Der alte Logger schrieb `to_jsonb(NEW)` ungekuerzt in die
-- Historie. Ihn zurueckzuholen hiesse also nicht "Zustand von vorher", sondern:
-- ab der naechsten Terminaenderung landet ein noch existierendes
-- Capability-Token wieder im Klartext in `appointment_history` — und diesmal
-- ohne jede Migration, die es spaeter wieder herausraeumt.
--
-- Dasselbe gilt fuer die uebrigen Haertungen der Funktion: schema-qualifizierte
-- Bezuege und ein festgenagelter `search_path`. Bei SECURITY DEFINER ist ein
-- loser Suchpfad ein eigenstaendiges Risiko; ein Rollback der Kunden-Link-
-- Funktion ist kein Anlass, es wieder einzugehen.
--
-- Merksatz fuer beide Richtungen: Struktur ist umkehrbar, ein einmal
-- ausgeraeumtes Geheimnis nicht. Wer den Logger wirklich auf seinen alten Stand
-- bringen will, braucht dafuer eine eigene Migration, die diese Folgen benennt.
--
-- ── Was an Daten verloren geht, und was nicht ──────────────────────────────
--
-- NICHT geloescht werden Termine oder irgendein Stueck Geschaeftsdaten. Keine
-- Zeile in `appointments` und keine in `appointment_history` geht verloren, und
-- alle uebrigen Felder dieser Zeilen bleiben, wie sie sind.
--
-- GELOESCHT werden allerdings die vergebenen Capability-Tokens, und zwar
-- endgueltig. Sie sind Zufallswerte; nach einem `DROP COLUMN` gibt es keine
-- Quelle, aus der sich dieselben Werte wiederherstellen liessen. Ein spaeteres
-- erneutes Ausfuehren der Vorwaerts-Migration vergibt NEUE Tokens.
--
-- Praktische Folge: jeder bereits verschickte Link, der ein Token traegt, ist
-- nach diesem Rollback tot. Solange noch keine solchen Links verschickt wurden
-- — und beim Stand dieser Migration ist das so, weil es noch keinen Leser gibt —
-- kostet der Rollback nichts.
--
-- Reihenfolge: erst die Funktion (sie liest beide Spalten), dann der Index,
-- dann die abgeleitete Spalte, zuletzt die Token-Spalte.
--
-- Wiederholbar: jede Anweisung ist mit IF EXISTS formuliert, ein zweiter Lauf
-- ist ein No-op.

BEGIN;

DROP FUNCTION IF EXISTS public.get_appointment_by_action_token(uuid, uuid);

DROP INDEX IF EXISTS public.appointments_customer_action_token_uniq;

ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS customer_action_token_expires_on;

ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS customer_action_token;

-- Nachpruefung, fail-closed und in beide Richtungen: was zum Kunden-Link
-- gehoert, muss weg sein — und was die Historie schuetzt, muss stehen.
DO $$
DECLARE
  v_anzahl integer;
  v_quelle text;
  k_capability constant text[] := ARRAY[
    'customer_action_token',
    'customer_action_token_expires_on',
    'reschedule_token',
    'reschedule_token_expires_at'
  ];
BEGIN
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_attribute a
   WHERE a.attrelid = 'public.appointments'::regclass
     AND a.attname IN ('customer_action_token','customer_action_token_expires_on')
     AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Rollback: % Spalte(n) sind noch da', v_anzahl;
  END IF;

  PERFORM 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'appointments_customer_action_token_uniq';
  IF FOUND THEN
    RAISE EXCEPTION 'Rollback: der Index ist noch da';
  END IF;

  PERFORM 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_appointment_by_action_token';
  IF FOUND THEN
    RAISE EXCEPTION 'Rollback: die Vorschau-Funktion ist noch da';
  END IF;

  -- Und jetzt die Gegenrichtung: der Logger muss die GEHAERTETE Fassung sein.
  -- Diese Pruefung schlaegt genau dann zu, wenn jemand den Rollback um einen
  -- "der Vollstaendigkeit halber" wiederhergestellten alten Logger ergaenzt.
  SELECT p.prosrc INTO v_quelle
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'log_appointment_changes';
  IF v_quelle IS NULL THEN
    RAISE EXCEPTION 'Rollback: log_appointment_changes fehlt';
  END IF;

  PERFORM 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_language l ON l.oid = p.prolang
   WHERE n.nspname = 'public' AND p.proname = 'log_appointment_changes'
     AND p.prorettype = 'pg_catalog.trigger'::regtype
     AND l.lanname    = 'plpgsql'
     AND p.prosecdef
     AND p.proconfig  = ARRAY['search_path=pg_catalog, public'];
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rollback: log_appointment_changes ist nicht mehr die '
                    'gehaertete Fassung (trigger/plpgsql/SECURITY DEFINER/'
                    'search_path=pg_catalog, public)';
  END IF;

  SELECT count(*) INTO v_anzahl
    FROM unnest(k_capability) AS k
   WHERE v_quelle LIKE '%' || k || '%';
  IF v_anzahl <> 4 THEN
    RAISE EXCEPTION 'Rollback: die Redaktionsliste im Logger nennt nur % von 4 Capability-Feldern', v_anzahl;
  END IF;

  SELECT count(*) INTO v_anzahl
    FROM regexp_matches(v_quelle, 'to_jsonb\s*\(\s*(NEW|OLD)\s*\)\s*(?!\s*-)', 'g') m;
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Rollback: % Stelle(n) im Logger schreiben die Zeile ungekuerzt weg', v_anzahl;
  END IF;

  SELECT count(*) INTO v_anzahl
    FROM public.appointment_history h
   WHERE h.old_data ?| k_capability
      OR h.new_data ?| k_capability;
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Rollback: % Historienzeile(n) tragen ein Capability-Feld', v_anzahl;
  END IF;

  RAISE NOTICE 'Rollback 20260802140000: Kunden-Link entfernt, Logger-Haertung '
               'und bereinigte Historie bleiben bestehen.';
END
$$;

COMMIT;
