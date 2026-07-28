-- =============================================================================
-- Der offene Betrag einer Rechnung kommt aus dem Buch, nicht aus einem Knopf
-- =============================================================================
--
-- BEFUND
-- `rechnungen.status = 'bezahlt'` wird von Hand gesetzt und ist damit eine
-- Behauptung, keine Feststellung. Mit dem Zahlungsbuch (20260729100000) gibt es
-- erstmals etwas, wogegen sich diese Behauptung pruefen laesst.
--
-- ABHILFE
-- Drei Spalten auf der Rechnung, die den Stand tragen:
--
--   paid_total      Summe der angerechneten Zahlungen  (Trigger)
--   credited_total  Summe der Gutschriften             (Trigger, 20260729120000)
--   open_amount     was noch offen ist                 (GENERATED)
--
-- `open_amount` ist eine generierte Spalte und keine Sicht: die Rechnungsliste
-- soll danach filtern und sortieren koennen, und jede weitere Ableitungsstelle
-- waere eine weitere Stelle, an der die Formel abweichen kann.
--
-- `credited_total` steht schon hier, obwohl die Gutschriften erst in der
-- naechsten Migration entstehen. Grund: eine generierte Spalte laesst sich nicht
-- erweitern, sie muesste geloescht und neu angelegt werden — mitsamt allem, was
-- bis dahin darauf zeigt. Die Spalte bleibt bis dahin auf 0.
--
-- DER STATUS IST DAMIT KEIN FREIES FELD MEHR. Der Waechter fragt nicht, WER
-- 'bezahlt' setzt, sondern ob das Buch es hergibt. Damit braucht der
-- automatische Weg keine Ausnahme und der manuelle keine Sonderbehandlung:
-- es gilt fuer beide dieselbe Bedingung.
--
-- Geprueft wird der UEBERGANG nach 'bezahlt', nicht der Zustand. Sonst waeren
-- die vier Rechnungen, die heute ohne Zahlungsbeleg auf 'bezahlt' stehen, bis
-- zum Backfill nicht mehr bearbeitbar — eine Aenderung an der Bemerkung wuerde
-- am Waechter scheitern.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Spalten
-- -----------------------------------------------------------------------------

ALTER TABLE public.rechnungen
  ADD COLUMN IF NOT EXISTS invoice_type   TEXT          NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS paid_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credited_total NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.rechnungen
  DROP CONSTRAINT IF EXISTS rechnungen_invoice_type_check,
  ADD  CONSTRAINT rechnungen_invoice_type_check
       CHECK (invoice_type IN ('standard','deposit','interim','final'));

-- COALESCE, weil `gesamttotal` nullable ist. Heute ist keine Zeile davon
-- betroffen; ohne COALESCE waere open_amount dort aber NULL und die Rechnung
-- verschwaende aus jeder Auswertung, die nach offenen Betraegen fragt.
ALTER TABLE public.rechnungen
  ADD COLUMN IF NOT EXISTS open_amount NUMERIC(12,2)
  GENERATED ALWAYS AS (COALESCE(gesamttotal, total, 0) - paid_total - credited_total) STORED;

COMMENT ON COLUMN public.rechnungen.paid_total IS
  'Summe der angerechneten Zahlungen. Vom Trigger gepflegt — nicht von Hand setzen.';
COMMENT ON COLUMN public.rechnungen.open_amount IS
  'Was noch offen ist. Negativ heisst ueberzahlt.';
COMMENT ON COLUMN public.rechnungen.invoice_type IS
  'standard | deposit (Anzahlung) | interim (Teilrechnung) | final (Schlussrechnung).';

CREATE INDEX IF NOT EXISTS idx_rechnungen_offen
  ON public.rechnungen (company_id, faellig_am)
  WHERE open_amount > 0 AND status <> 'entwurf';

-- -----------------------------------------------------------------------------
-- 2. Fortschreibung aus dem Buch
--
-- Laeuft nach jeder Aenderung an den Anrechnungen und schreibt genau die
-- betroffene Rechnung fort. Der Status folgt mit:
--
--   nichts mehr offen              -> bezahlt
--   wieder offen (Storno geloest)  -> versendet, oder ueberfaellig wenn die
--                                     Frist schon abgelaufen ist
--
-- Ein Entwurf bleibt ein Entwurf. Auf eine Rechnung, die noch niemand
-- verschickt hat, kann zwar Geld eingehen (Vorauszahlung), aber sie deshalb
-- als versendet zu fuehren waere falsch.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rechnung_zahlungsstand_fortschreiben()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rechnung UUID := COALESCE(NEW.rechnung_id, OLD.rechnung_id);
  v_summe    NUMERIC(12,2);
  v_zeile    RECORD;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_summe
  FROM public.payment_allocations
  WHERE rechnung_id = v_rechnung;

  UPDATE public.rechnungen
  SET paid_total = v_summe
  WHERE id = v_rechnung
  RETURNING * INTO v_zeile;

  IF v_zeile.status = 'entwurf' THEN
    RETURN NULL;
  END IF;

  IF v_zeile.open_amount <= 0 AND v_zeile.status <> 'bezahlt' THEN
    UPDATE public.rechnungen SET status = 'bezahlt' WHERE id = v_rechnung;
  ELSIF v_zeile.open_amount > 0 AND v_zeile.status = 'bezahlt' THEN
    UPDATE public.rechnungen
    SET status = CASE
                   WHEN v_zeile.faellig_am IS NOT NULL
                    AND v_zeile.faellig_am < CURRENT_DATE THEN 'ueberfaellig'
                   ELSE 'versendet'
                 END
    WHERE id = v_rechnung;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.rechnung_zahlungsstand_fortschreiben() IS
  'Schreibt paid_total und den Status einer Rechnung aus den Anrechnungen fort.';

DROP TRIGGER IF EXISTS trigger_allocation_rechnung_fortschreiben ON public.payment_allocations;
CREATE TRIGGER trigger_allocation_rechnung_fortschreiben
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.rechnung_zahlungsstand_fortschreiben();

-- -----------------------------------------------------------------------------
-- 3. 'bezahlt' braucht Deckung
--
-- WICHTIG: open_amount ist GENERATED und auf NEW deshalb noch nicht berechnet.
-- Die Formel muss hier von Hand stehen — dieselbe Falle wie beim Waechter der
-- Offertenversionen (20260728190000).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_rechnung_bezahlt_braucht_deckung()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_offen NUMERIC(12,2);
BEGIN
  IF NEW.status <> 'bezahlt' OR OLD.status = 'bezahlt' THEN
    RETURN NEW;
  END IF;

  v_offen := COALESCE(NEW.gesamttotal, NEW.total, 0) - NEW.paid_total - NEW.credited_total;

  IF v_offen > 0 THEN
    RAISE EXCEPTION
      'Rechnung % kann nicht als bezahlt gefuehrt werden: % offen. Zahlung erfassen statt Status setzen.',
      NEW.rechnung_nr, v_offen
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_rechnungen_bezahlt_deckung ON public.rechnungen;
CREATE TRIGGER trigger_rechnungen_bezahlt_deckung
  BEFORE UPDATE ON public.rechnungen
  FOR EACH ROW EXECUTE FUNCTION public.guard_rechnung_bezahlt_braucht_deckung();

COMMIT;
