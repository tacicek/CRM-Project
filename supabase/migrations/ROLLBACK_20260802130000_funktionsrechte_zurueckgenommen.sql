-- =============================================================================
-- ROLLBACK für 20260802130000_funktionsrechte_zurueckgenommen.sql
-- NICHT als Migration ausführen.
-- =============================================================================
--
-- ⚠️ Dieser Rückbau öffnet 22 schreibende SECURITY-DEFINER-Funktionen wieder für
--    `anon` — also für jeden, der die URL kennt, ohne Anmeldung. Darunter
--    Funktionen, die Termine in fremden Firmen anlegen, fremde Offerten
--    überschreiben und Daten löschen.
--
--    Das ist fast sicher nicht das, was gewollt ist. Bricht nach dem Entzug
--    etwas, ist die richtige Antwort in aller Regel ein gezieltes
--    `GRANT EXECUTE … TO authenticated` für die EINE betroffene Funktion,
--    nicht dieser pauschale Rückbau.
--
--    Vorher ansehen, was zurückgegeben würde:
--      SELECT func_name, had_public, had_anon, had_authenticated
--      FROM public.undo_20260802130000 ORDER BY func_name;
--
-- Zurückgegeben wird genau der vermerkte Vorzustand, Funktion für Funktion —
-- nicht pauschal an alle Rollen. Hatte eine Funktion `anon` vorher nicht, bekommt
-- sie es auch jetzt nicht.
--
-- Fehlt die Tabelle (Rückbau bereits gelaufen), übergeht der Block alles. Ohne
-- diese Prüfung bräche ein zweiter Lauf mit "relation does not exist" ab.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  r RECORD;
BEGIN
  IF to_regclass('public.undo_20260802130000') IS NULL THEN
    RAISE NOTICE 'undo_20260802130000 fehlt — es gibt nichts zurueckzugeben.';
    RETURN;
  END IF;

  FOR r IN SELECT * FROM public.undo_20260802130000 LOOP
    IF to_regprocedure(r.func_signature) IS NULL THEN
      RAISE WARNING 'Funktion % existiert nicht mehr — uebersprungen.', r.func_signature;
      CONTINUE;
    END IF;

    IF r.had_public THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', r.func_signature);
    END IF;

    IF r.had_anon THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.func_signature);
    END IF;

    IF r.had_authenticated THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.func_signature);
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.undo_20260802130000;

COMMIT;
