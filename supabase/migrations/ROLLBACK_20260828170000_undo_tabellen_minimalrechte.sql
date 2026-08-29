-- Ruecknahme zu 20260828170000.
--
-- Gibt anon, authenticated und service_role die vollen Tabellenrechte auf allen
-- Belegtabellen zurueck — einschliesslich TRUNCATE, gegen das RLS nicht hilft.
-- Das ist der UNSICHERE Zustand; die Datei existiert fuer die Umkehrbarkeit,
-- nicht als Zielzustand.
--
-- RLS wird NICHT wieder ausgeschaltet: welche Tabelle vorher keine hatte, sagt
-- diese Datei nicht, und Raten waere hier schlechter als Stehenlassen.
-- `undo_20260828100000` bekommt sie ueber ROLLBACK_20260828150000 zurueck.

BEGIN;

DO $rueckgabe$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'undo\_%'
     ORDER BY c.relname
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO anon', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END
$rueckgabe$;

COMMIT;
