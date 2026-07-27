-- =============================================================================
-- Rechnungsnummern: von MAX(...)+1 auf einen atomaren Zähler
-- =============================================================================
--
-- BEFUND
-- `generate_rechnung_nr()` liest die höchste bestehende Nummer der Firma und
-- zählt eins hoch. Das hat zwei Fehler, die beide die Nummernfolge beschädigen:
--
--   1. WIEDERVERWENDUNG. Wird die höchste Rechnung gelöscht, sinkt das Maximum
--      und die nächste Rechnung bekommt dieselbe Nummer noch einmal. Zwei
--      verschiedene Belege mit derselben Nummer sind buchhalterisch schlimmer
--      als eine Lücke. Seit dem Lösch-Trigger betrifft das nur noch Entwürfe —
--      die bekommen ihre Nummer aber bereits beim Anlegen.
--
--   2. WETTLAUF. Zwei gleichzeitige INSERTs lesen dasselbe Maximum und bilden
--      dieselbe Nummer. `rechnung_nr` ist UNIQUE, also scheitert einer der
--      beiden mit einem Constraint-Fehler, den niemand einordnen kann.
--
-- ABHILFE
-- Ein Zähler je (Firma, Jahr), hochgezählt mit INSERT … ON CONFLICT DO UPDATE
-- … RETURNING. Das ist eine einzige Anweisung: Postgres sperrt die Zählerzeile,
-- erhöht sie und gibt den neuen Wert zurück — zwei gleichzeitige INSERTs laufen
-- hintereinander durch. Und weil der Zähler nur steigt, kann ein Löschen keine
-- Nummer zurückgeben.
--
-- Eine echte SEQUENCE wäre der naheliegende Griff, kann aber nicht je Firma und
-- Jahr zählen. Das Format RE-YYYY-NNNN bleibt unverändert.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Zählertabelle
--
-- Kein Firmen-Zugriff: RLS an, keine einzige Policy. Nur der Trigger schreibt
-- hier (SECURITY DEFINER), niemand sonst braucht die Tabelle je zu sehen.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rechnung_nr_counter (
  company_id UUID    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  jahr       INTEGER NOT NULL,
  letzte_nr  INTEGER NOT NULL DEFAULT 0 CHECK (letzte_nr >= 0),
  PRIMARY KEY (company_id, jahr)
);

ALTER TABLE public.rechnung_nr_counter ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rechnung_nr_counter IS
  'Laufende Rechnungsnummer je Firma und Jahr. Steigt nur; ein geloeschter '
  'Entwurf gibt seine Nummer nicht zurueck.';

-- -----------------------------------------------------------------------------
-- 2. Bestand übernehmen
--
-- Der Zähler startet auf der höchsten bereits vergebenen Nummer, damit die Folge
-- ohne Sprung und ohne Kollision weiterläuft.
-- -----------------------------------------------------------------------------

INSERT INTO public.rechnung_nr_counter (company_id, jahr, letzte_nr)
SELECT
  company_id,
  CAST(SPLIT_PART(rechnung_nr, '-', 2) AS INTEGER) AS jahr,
  MAX(CAST(SPLIT_PART(rechnung_nr, '-', 3) AS INTEGER))
FROM public.rechnungen
WHERE rechnung_nr ~ '^RE-[0-9]{4}-[0-9]+$'
GROUP BY company_id, CAST(SPLIT_PART(rechnung_nr, '-', 2) AS INTEGER)
ON CONFLICT (company_id, jahr) DO UPDATE
  SET letzte_nr = GREATEST(public.rechnung_nr_counter.letzte_nr, EXCLUDED.letzte_nr);

-- -----------------------------------------------------------------------------
-- 3. Nummernvergabe
--
-- SECURITY DEFINER, weil der Zähler für `authenticated` unsichtbar ist. Hier ist
-- das unbedenklich: die Funktion trifft keine Entscheidung anhand von
-- current_user, sie zählt nur hoch.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_rechnung_nr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_nr  INTEGER;
  jahr_int INTEGER;
BEGIN
  IF NEW.rechnung_nr IS NULL THEN
    jahr_int := EXTRACT(YEAR FROM COALESCE(NEW.datum, CURRENT_DATE))::INTEGER;

    INSERT INTO public.rechnung_nr_counter AS c (company_id, jahr, letzte_nr)
    VALUES (NEW.company_id, jahr_int, 1)
    ON CONFLICT (company_id, jahr)
      DO UPDATE SET letzte_nr = c.letzte_nr + 1
    RETURNING c.letzte_nr INTO next_nr;

    NEW.rechnung_nr := 'RE-' || jahr_int::TEXT || '-' || LPAD(next_nr::TEXT, 4, '0');
  END IF;

  IF NEW.faellig_am IS NULL THEN
    NEW.faellig_am := NEW.datum + 30;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
