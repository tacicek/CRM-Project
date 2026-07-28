-- =============================================================================
-- Die Quittung haengt am Zahlungsbuch, nicht daneben
-- =============================================================================
--
-- BEFUND
-- Eine Quittung bescheinigt, dass Geld eingegangen ist. Im System ist sie
-- trotzdem eine zweite, voellig eigenstaendige Einnahmequelle: `Quittungen.tsx`
-- summiert ihre eigene Umsatzzahl (`stats.revenue`), `Rechnungen.tsx` eine
-- zweite. Wer beide addiert, zaehlt jede Barzahlung doppelt, fuer die auch eine
-- Rechnung existiert.
--
-- Die Kundenkarte weiss das bereits und schreibt es in einen Kommentar
-- ([useKunde.ts:23]): "`quittungen` steht bewusst NEBEN `bezahlt` und wird
-- nicht addiert". Das war die richtige Vorsicht — aber eine Vorsicht, die man
-- an jeder neuen Auswertungsstelle wiederholen muss.
--
-- Dazu kommt: `betrag_noch_offen = false` ist wieder nur ein Haken. Auf der
-- Produktion steht er bei 3 ausgestellten Quittungen ueber 13'674.65 — und bei
-- 3 Entwuerfen, die noch gar nicht heraus sind. Der Haken allein sagt also
-- nicht einmal, ob ueberhaupt etwas kassiert wurde.
--
-- ABHILFE
-- `quittungen.payment_id`. Eine Quittung, die als bezahlt gilt, zeigt auf den
-- Zahlungseingang, den sie bescheinigt. Damit gibt es genau eine Stelle, an der
-- Umsatz steht: `payments`. Ob das Geld ueber eine Rechnung oder direkt gegen
-- Quittung kam, ist eine Frage der Zuordnung, nicht der Summe.
--
-- Der Eingang wird NICHT automatisch gebucht. Ein Trigger muesste Weg und Datum
-- erfinden ('cash'? heute?), und beides waere geraten. `record_quittung_payment`
-- fragt danach — im Zweifel gibt der Bediener 'other' an, aber er gibt es an.
-- =============================================================================

BEGIN;

ALTER TABLE public.quittungen
  ADD COLUMN IF NOT EXISTS payment_id UUID;

ALTER TABLE public.quittungen
  DROP CONSTRAINT IF EXISTS quittungen_payment_fk,
  ADD  CONSTRAINT quittungen_payment_fk
       FOREIGN KEY (payment_id, company_id)
       REFERENCES public.payments (id, company_id)
       ON DELETE SET NULL (payment_id);

COMMENT ON COLUMN public.quittungen.payment_id IS
  'Der Zahlungseingang, den diese Quittung bescheinigt. Umsatz wird ueber '
  'payments gezaehlt, damit Quittung und Rechnung nicht doppelt zaehlen.';

CREATE INDEX IF NOT EXISTS idx_quittungen_payment
  ON public.quittungen (payment_id) WHERE payment_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Der Haken braucht eine Buchung
--
-- Geprueft wird wieder der UEBERGANG, nicht der Zustand: die drei Quittungen,
-- die heute ohne Buchung auf "nicht mehr offen" stehen, bleiben bearbeitbar,
-- bis der Backfill sie eingesammelt hat.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_quittung_bezahlt_braucht_buchung()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.betrag_noch_offen, TRUE) = TRUE
     OR COALESCE(OLD.betrag_noch_offen, TRUE) = FALSE THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_id IS NULL THEN
    RAISE EXCEPTION
      'Quittung % kann nicht als bezahlt gefuehrt werden: kein Zahlungseingang erfasst.',
      NEW.quittung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_quittungen_bezahlt_buchung ON public.quittungen;
CREATE TRIGGER trigger_quittungen_bezahlt_buchung
  BEFORE UPDATE ON public.quittungen
  FOR EACH ROW EXECUTE FUNCTION public.guard_quittung_bezahlt_braucht_buchung();

-- -----------------------------------------------------------------------------
-- Zahlungseingang zu einer Quittung erfassen
--
-- Gibt zurueck, was gebucht wurde — und warnt, wenn zu demselben Vorgang schon
-- eine bezahlte Rechnung existiert. Verhindern laesst sich das nicht (es kann
-- eine Anzahlung und eine Schlusszahlung sein), verschweigen sollte man es
-- nicht.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_quittung_payment(
  p_quittung_id  UUID,
  p_method       TEXT DEFAULT 'cash',
  p_payment_date DATE DEFAULT NULL,
  p_reference    TEXT DEFAULT NULL,
  p_note         TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_q       RECORD;
  v_payment UUID;
  v_warnung TEXT := NULL;
BEGIN
  SELECT * INTO v_q FROM public.quittungen WHERE id = p_quittung_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quittung nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_q.company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen Zahlungen erfassen.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_q.payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Quittung % ist bereits gebucht.', v_q.quittung_nr
      USING ERRCODE = 'unique_violation';
  END IF;

  IF v_q.status = 'draft' THEN
    RAISE EXCEPTION 'Ein Entwurf kann nichts bescheinigen — Quittung zuerst ausstellen.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_q.offer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rechnungen r
    WHERE r.offer_id = v_q.offer_id AND r.paid_total > 0
  ) THEN
    v_warnung := 'Zu dieser Offerte ist bereits eine Zahlung auf eine Rechnung gebucht.';
  END IF;

  INSERT INTO public.payments (
    company_id, customer_id, payment_date, amount, method, reference,
    note, created_via, created_by
  ) VALUES (
    v_q.company_id, v_q.customer_id,
    COALESCE(p_payment_date, v_q.datum, CURRENT_DATE),
    COALESCE(v_q.gesamttotal, v_q.total),
    p_method, p_reference,
    COALESCE(p_note, 'Quittung ' || COALESCE(v_q.quittung_nr, '')),
    'quittung', auth.uid()
  ) RETURNING id INTO v_payment;

  UPDATE public.quittungen
  SET payment_id = v_payment, betrag_noch_offen = FALSE
  WHERE id = p_quittung_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment,
    'amount',     COALESCE(v_q.gesamttotal, v_q.total),
    'warnung',    v_warnung
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_quittung_payment(UUID,TEXT,DATE,TEXT,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_quittung_payment(UUID,TEXT,DATE,TEXT,TEXT) TO authenticated;

COMMIT;
