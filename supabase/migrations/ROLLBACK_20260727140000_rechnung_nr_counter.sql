-- =============================================================================
-- ROLLBACK für 20260727140000_rechnung_nr_counter.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Der Rückbau holt beide Fehler zurück: eine gelöschte höchste Rechnung gibt
--    ihre Nummer wieder frei, und zwei gleichzeitige INSERTs bilden dieselbe
--    Nummer (einer scheitert dann am UNIQUE-Constraint).
--
-- Die Zählertabelle wird bewusst NICHT gelöscht: sie ist der einzige Ort, an dem
-- steht, welche Nummern bereits vergeben waren. Nach einem Rückbau bliebe sonst
-- unklar, ob eine Nummer schon einmal existiert hat.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_rechnung_nr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_nr  INTEGER;
  year_str TEXT;
BEGIN
  IF NEW.rechnung_nr IS NULL THEN
    year_str := to_char(NOW(), 'YYYY');

    SELECT COALESCE(
      MAX(
        CASE
          WHEN rechnung_nr ~ ('^RE-' || year_str || '-[0-9]+$')
          THEN CAST(SPLIT_PART(rechnung_nr, '-', 3) AS INTEGER)
          ELSE 0
        END
      ), 0
    ) + 1
    INTO next_nr
    FROM rechnungen
    WHERE company_id = NEW.company_id;

    NEW.rechnung_nr := 'RE-' || year_str || '-' || LPAD(next_nr::text, 4, '0');
  END IF;

  IF NEW.faellig_am IS NULL THEN
    NEW.faellig_am := NEW.datum + 30;
  END IF;

  RETURN NEW;
END;
$$;

-- DROP TABLE public.rechnung_nr_counter;   -- absichtlich auskommentiert, siehe Kopf

COMMIT;
