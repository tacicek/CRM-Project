-- =============================================================================
-- Backfill: die vorhandenen Haken ins Buch ueberfuehren
-- =============================================================================
--
-- Diese Migration DEFINIERT nur. Sie ruft nichts auf.
--
-- WAS UEBERFUEHRT WIRD (Produktion, 2026-07-28)
--   4 Rechnungen auf 'bezahlt'              5'988.07
--   3 ausgestellte Quittungen, nicht offen 13'674.65
--
-- Die 3 Quittungen im Entwurf bleiben aussen vor. Ihr `betrag_noch_offen = false`
-- ist der Vorgabewert der Spalte, keine Aussage — ein Entwurf, der nie heraus
-- war, hat nichts kassiert.
--
-- WAS DAS BUCH DABEI NICHT ERFAEHRT
-- Das echte Zahlungsdatum. Alle vier Rechnungen tragen `updated_at` vom
-- 2026-07-27 — das ist der Tag des Kunden-Backfills, nicht der Tag der Zahlung.
-- Der Beleg selbst ist die einzige verbliebene Datumsquelle, also wird sein
-- Datum genommen und die Zeile als NICHT abgeglichen gefuehrt. Das ist eine
-- sichtbare Luecke, kein erfundener Wert.
--
-- Dasselbe fuer den Weg: 'other', nicht 'bank' oder 'cash'. Wir wissen es nicht.
--
-- IDEMPOTENT. Uebernommen wird nur, was noch keine Buchung hat. Ein zweiter Lauf
-- aendert nichts. Rueckgaengig zu machen ueber `created_via = 'backfill'`.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Vorschau — schreibt nichts
--
-- STABLE ist hier kein Kommentar, sondern eine Zusicherung der Sprache: ein
-- INSERT wuerde zur Laufzeit abgelehnt. Dieselbe Bauart wie
-- preview_customer_backfill (20260728140000).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preview_finance_backfill(p_company_id UUID)
RETURNS TABLE (
  quelle       TEXT,
  beleg_nr     TEXT,
  beleg_datum  DATE,
  betrag       NUMERIC(12,2),
  hinweis      TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT 'rechnung'::TEXT,
         r.rechnung_nr,
         r.datum,
         COALESCE(r.gesamttotal, r.total, 0)::NUMERIC(12,2),
         'Status bezahlt, keine Buchung — Datum aus dem Beleg, Weg unbekannt'::TEXT
  FROM public.rechnungen r
  WHERE r.company_id = p_company_id
    AND r.status = 'bezahlt'
    AND r.paid_total = 0
    AND COALESCE(r.gesamttotal, r.total, 0) > 0

  UNION ALL

  SELECT 'quittung'::TEXT,
         q.quittung_nr,
         q.datum,
         COALESCE(q.gesamttotal, q.total, 0)::NUMERIC(12,2),
         'ausgestellt und nicht mehr offen, keine Buchung'::TEXT
  FROM public.quittungen q
  WHERE q.company_id = p_company_id
    AND q.payment_id IS NULL
    AND q.status <> 'draft'
    AND COALESCE(q.betrag_noch_offen, TRUE) = FALSE
    AND COALESCE(q.gesamttotal, q.total, 0) > 0

  ORDER BY 1, 3;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_finance_backfill(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.preview_finance_backfill(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Ausfuehrung
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_finance_backfill(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_r          RECORD;
  v_payment    UUID;
  v_rechnungen INTEGER := 0;
  v_quittungen INTEGER := 0;
  v_summe      NUMERIC(12,2) := 0;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Nur der Eigentuemer kann den Finanz-Backfill ausfuehren.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_r IN
    SELECT id, company_id, customer_id, rechnung_nr, datum,
           COALESCE(gesamttotal, total, 0)::NUMERIC(12,2) AS betrag
    FROM public.rechnungen
    WHERE company_id = p_company_id
      AND status = 'bezahlt'
      AND paid_total = 0
      AND COALESCE(gesamttotal, total, 0) > 0
    ORDER BY datum
  LOOP
    INSERT INTO public.payments (
      company_id, customer_id, payment_date, amount, method,
      reconciliation_status, note, created_via
    ) VALUES (
      v_r.company_id, v_r.customer_id, v_r.datum, v_r.betrag, 'other',
      'unreconciled',
      'Backfill aus Status "bezahlt" — echtes Zahlungsdatum und Zahlungsweg unbekannt.',
      'backfill'
    ) RETURNING id INTO v_payment;

    INSERT INTO public.payment_allocations (company_id, payment_id, rechnung_id, amount)
    VALUES (v_r.company_id, v_payment, v_r.id, v_r.betrag);

    v_rechnungen := v_rechnungen + 1;
    v_summe := v_summe + v_r.betrag;
  END LOOP;

  FOR v_r IN
    SELECT id, company_id, customer_id, quittung_nr, datum,
           COALESCE(gesamttotal, total, 0)::NUMERIC(12,2) AS betrag
    FROM public.quittungen
    WHERE company_id = p_company_id
      AND payment_id IS NULL
      AND status <> 'draft'
      AND COALESCE(betrag_noch_offen, TRUE) = FALSE
      AND COALESCE(gesamttotal, total, 0) > 0
    ORDER BY datum
  LOOP
    INSERT INTO public.payments (
      company_id, customer_id, payment_date, amount, method,
      reconciliation_status, note, created_via
    ) VALUES (
      v_r.company_id, v_r.customer_id, v_r.datum, v_r.betrag, 'other',
      'unreconciled',
      'Backfill aus Quittung ' || COALESCE(v_r.quittung_nr, '') ||
      ' — Zahlungsweg unbekannt.',
      'backfill'
    ) RETURNING id INTO v_payment;

    -- Keine Anrechnung: eine Quittung steht fuer sich, es gibt keine Rechnung,
    -- auf die gebucht werden koennte.
    UPDATE public.quittungen SET payment_id = v_payment WHERE id = v_r.id;

    v_quittungen := v_quittungen + 1;
    v_summe := v_summe + v_r.betrag;
  END LOOP;

  RETURN jsonb_build_object(
    'rechnungen', v_rechnungen,
    'quittungen', v_quittungen,
    'summe',      v_summe
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_finance_backfill(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.run_finance_backfill(UUID) TO authenticated;

COMMIT;
