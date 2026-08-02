-- Rollback zu 20260803010000_anon_schreibrechte_schliessen.sql
--
-- ── WARNUNG ────────────────────────────────────────────────────────────────
--
-- Dieser Rollback OEFFNET anonyme Schreibzugriffe wieder. Danach kann jeder
-- ohne Anmeldung Zeilen in `leads` und `raeumung_anfragen` anlegen. Das war der
-- Zustand vor der Migration, und es war der Zustand, den sie beseitigt hat.
--
-- Ihn herzustellen ergibt genau einen Sinn: es gibt wieder ein oeffentliches
-- Anfrage-Formular, das ohne Anmeldung einen Lead anlegen soll. Dann gehoert
-- allerdings mehr dazu als diese Datei — mindestens eine Ratenbegrenzung und
-- eine Pruefung des Inhalts. `WITH CHECK (true)` heisst woertlich: alles ist
-- erlaubt.
--
-- Wer nur „den vorherigen Stand" will, sollte vorher lesen, was dieser Stand
-- war.
--
-- ── Was wiederhergestellt wird, und was nicht ──────────────────────────────
--
-- WIEDERHERGESTELLT werden die beiden INSERT-Policies und genau das eine Recht,
-- das sie zum Arbeiten brauchen: INSERT.
--
-- NICHT wiederhergestellt werden DELETE, UPDATE, TRUNCATE, REFERENCES, TRIGGER
-- und SELECT fuer `anon`. Diese Rechte hat nie jemand vergeben wollen; sie sind
-- der Rueckstand eines `--no-privileges`-Restores. Sie „zurueckzugeben" hiesse,
-- einen Unfall zu wiederholen — und bei TRUNCATE einen, den RLS nicht abfaengt.
-- Der Rollback stellt die ABSICHT von damals wieder her, nicht das Versehen.
--
-- Geloescht wird nichts. Keine Zeile in `leads`, keine in `raeumung_anfragen`.
--
-- Wiederholbar: ein zweiter Lauf ist ein No-op.

BEGIN;

-- ── 1. Die beiden INSERT-Policies ──────────────────────────────────────────

DROP POLICY IF EXISTS "leads_public_insert_v2" ON public.leads;
CREATE POLICY "leads_public_insert_v2" ON public.leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert raeumung requests" ON public.raeumung_anfragen;
CREATE POLICY "Anyone can insert raeumung requests" ON public.raeumung_anfragen
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ── 2. Nur INSERT ──────────────────────────────────────────────────────────

GRANT INSERT ON public.leads             TO anon;
GRANT INSERT ON public.raeumung_anfragen TO anon;

-- ── 3. Nachpruefung ────────────────────────────────────────────────────────
DO $$
DECLARE
  k_tabellen constant text[] := ARRAY['leads','raeumung_anfragen'];
  v_tabelle  text;
  v_recht    text;
BEGIN
  FOREACH v_tabelle IN ARRAY k_tabellen LOOP
    IF NOT pg_catalog.has_table_privilege('anon', format('public.%I', v_tabelle), 'INSERT') THEN
      RAISE EXCEPTION 'Rollback (%): anon hat kein INSERT', v_tabelle;
    END IF;

    -- Und ausdruecklich NUR INSERT: das Versehen von damals kommt nicht zurueck.
    FOREACH v_recht IN ARRAY ARRAY['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','SELECT'] LOOP
      IF pg_catalog.has_table_privilege('anon', format('public.%I', v_tabelle), v_recht) THEN
        RAISE EXCEPTION 'Rollback (%): anon haette wieder % — das war nie beabsichtigt', v_tabelle, v_recht;
      END IF;
    END LOOP;
  END LOOP;

  PERFORM 1 FROM pg_catalog.pg_policy
   WHERE polrelid = 'public.leads'::regclass AND polname = 'leads_public_insert_v2';
  IF NOT FOUND THEN RAISE EXCEPTION 'Rollback: leads_public_insert_v2 fehlt'; END IF;

  PERFORM 1 FROM pg_catalog.pg_policy
   WHERE polrelid = 'public.raeumung_anfragen'::regclass
     AND polname = 'Anyone can insert raeumung requests';
  IF NOT FOUND THEN RAISE EXCEPTION 'Rollback: die raeumung-INSERT-Policy fehlt'; END IF;

  RAISE NOTICE 'Rollback 20260803010000: anonymes INSERT ist wieder offen. Daten unveraendert.';
END
$$;

COMMIT;
