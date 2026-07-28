-- =============================================================================
-- Zahlungen erfassen, stornieren, auswerten — und ueberfaellige Rechnungen melden
-- =============================================================================
--
-- Eine Zahlung entsteht nie allein: sie wird gebucht UND angerechnet, und beides
-- muss zusammen gelingen oder gar nicht. Deshalb eine RPC und nicht zwei
-- INSERTs aus dem Browser — dazwischen koennte der Netzstecker liegen.
--
-- `finance_overview` ersetzt zwei getrennte Umsatzzahlen (Rechnungen.tsx und
-- Quittungen.tsx rechnen heute jede fuer sich) durch eine: die Summe der
-- Zahlungseingaenge. Damit zaehlt derselbe Franken genau einmal, egal ob er
-- gegen Rechnung oder gegen Quittung kam.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Erfassen
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_payment(
  p_company_id   UUID,
  p_amount       NUMERIC,
  p_payment_date DATE,
  p_method       TEXT DEFAULT 'bank',
  p_customer_id  UUID DEFAULT NULL,
  p_reference    TEXT DEFAULT NULL,
  p_note         TEXT DEFAULT NULL,
  -- [{"rechnung_id": "...", "amount": 1200.00}, ...]
  p_allocations  JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment  UUID;
  v_zeile    JSONB;
  v_summe    NUMERIC(12,2) := 0;
  v_rechnung UUID;
  v_betrag   NUMERIC(12,2);
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen Zahlungen erfassen.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Der Zahlbetrag muss groesser als null sein.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.payments (
    company_id, customer_id, payment_date, amount, method, reference, note,
    created_via, created_by
  ) VALUES (
    p_company_id, p_customer_id, COALESCE(p_payment_date, CURRENT_DATE),
    p_amount, p_method, p_reference, p_note, 'manual', auth.uid()
  ) RETURNING id INTO v_payment;

  FOR v_zeile IN SELECT * FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb))
  LOOP
    v_rechnung := (v_zeile ->> 'rechnung_id')::UUID;
    v_betrag   := (v_zeile ->> 'amount')::NUMERIC(12,2);

    IF v_betrag IS NULL OR v_betrag <= 0 THEN
      RAISE EXCEPTION 'Anrechnung ohne gueltigen Betrag.' USING ERRCODE = 'check_violation';
    END IF;

    -- Der mehrspaltige Fremdschluessel faengt eine fremde Rechnung ohnehin ab.
    -- Die Pruefung hier existiert, damit die Meldung verstaendlich ist statt
    -- einer Constraint-Verletzung.
    IF NOT EXISTS (
      SELECT 1 FROM public.rechnungen
      WHERE id = v_rechnung AND company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'Rechnung gehoert nicht zu dieser Firma.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.payment_allocations
      (company_id, payment_id, rechnung_id, amount, created_by)
    VALUES (p_company_id, v_payment, v_rechnung, v_betrag, auth.uid());

    v_summe := v_summe + v_betrag;
  END LOOP;

  RETURN jsonb_build_object(
    'payment_id',     v_payment,
    'amount',         p_amount,
    'allocated',      v_summe,
    -- Was ueberzaehlig hereinkam, bleibt sichtbar offen statt still zu
    -- verschwinden.
    'unallocated',    p_amount - v_summe
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_payment(UUID,NUMERIC,DATE,TEXT,UUID,TEXT,TEXT,JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_payment(UUID,NUMERIC,DATE,TEXT,UUID,TEXT,TEXT,JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Stornieren
--
-- Die Gegenbuchung spiegelt die Anrechnungen mit. Ohne das bliebe die Rechnung
-- auf 'bezahlt' stehen, obwohl das Geld zurueckging.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reverse_payment(
  p_payment_id UUID,
  p_reason     TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_p      RECORD;
  v_storno UUID;
BEGIN
  SELECT * INTO v_p FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zahlung nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_p.company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen stornieren.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_p.reverses_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Eine Stornobuchung wird nicht storniert.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments WHERE reverses_payment_id = p_payment_id) THEN
    RAISE EXCEPTION 'Diese Zahlung ist bereits storniert.'
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.payments (
    company_id, customer_id, payment_date, amount, method, reference,
    reconciliation_status, reverses_payment_id, note, created_via, created_by
  ) VALUES (
    v_p.company_id, v_p.customer_id, CURRENT_DATE, -v_p.amount, v_p.method,
    v_p.reference, 'reconciled', p_payment_id,
    COALESCE(p_reason, 'Storno'), v_p.created_via, auth.uid()
  ) RETURNING id INTO v_storno;

  INSERT INTO public.payment_allocations
    (company_id, payment_id, rechnung_id, amount, note)
  SELECT company_id, v_storno, rechnung_id, -amount, 'Storno'
  FROM public.payment_allocations
  WHERE payment_id = p_payment_id;

  -- Eine Quittung, deren Eingang storniert ist, ist wieder offen.
  UPDATE public.quittungen
  SET betrag_noch_offen = TRUE
  WHERE payment_id = p_payment_id;

  RETURN jsonb_build_object('storno_payment_id', v_storno, 'amount', -v_p.amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reverse_payment(UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reverse_payment(UUID,TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Auswertung
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finance_overview(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ergebnis JSONB;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
    -- Die einzige Umsatzzahl des Systems. Stornos sind negativ und rechnen
    -- sich von selbst heraus.
    'kassiert_total', COALESCE((SELECT SUM(amount) FROM public.payments
                                WHERE company_id = p_company_id), 0),
    'kassiert_30t',   COALESCE((SELECT SUM(amount) FROM public.payments
                                WHERE company_id = p_company_id
                                  AND payment_date >= CURRENT_DATE - 30), 0),
    'nicht_abgeglichen', COALESCE((SELECT COUNT(*) FROM public.payments
                                WHERE company_id = p_company_id
                                  AND reconciliation_status = 'unreconciled'), 0),
    'offen_total',    COALESCE((SELECT SUM(open_amount) FROM public.rechnungen
                                WHERE company_id = p_company_id
                                  AND status <> 'entwurf' AND open_amount > 0), 0),
    'offen_anzahl',   COALESCE((SELECT COUNT(*) FROM public.rechnungen
                                WHERE company_id = p_company_id
                                  AND status <> 'entwurf' AND open_amount > 0), 0),
    'ueberfaellig_total', COALESCE((SELECT SUM(open_amount) FROM public.rechnungen
                                WHERE company_id = p_company_id
                                  AND status <> 'entwurf' AND open_amount > 0
                                  AND faellig_am < CURRENT_DATE), 0),
    'ueberfaellig_anzahl', COALESCE((SELECT COUNT(*) FROM public.rechnungen
                                WHERE company_id = p_company_id
                                  AND status <> 'entwurf' AND open_amount > 0
                                  AND faellig_am < CURRENT_DATE), 0),
    'entwurf_total',  COALESCE((SELECT SUM(COALESCE(gesamttotal, total, 0))
                                FROM public.rechnungen
                                WHERE company_id = p_company_id AND status = 'entwurf'), 0),
    'gutschriften_total', COALESCE((SELECT SUM(amount) FROM public.credit_notes
                                WHERE company_id = p_company_id AND status = 'versendet'), 0)
  ) INTO v_ergebnis;

  RETURN v_ergebnis;
END;
$$;

COMMENT ON FUNCTION public.finance_overview(UUID) IS
  'Eine Umsatzzahl statt zweier: kassiert_total ist die Summe der '
  'Zahlungseingaenge — Rechnung und Quittung zaehlen darin je einmal.';

REVOKE EXECUTE ON FUNCTION public.finance_overview(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.finance_overview(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_receivables(
  p_company_id UUID,
  p_limit      INTEGER DEFAULT 50,
  p_offset     INTEGER DEFAULT 0
) RETURNS TABLE (
  rechnung_id   UUID,
  rechnung_nr   TEXT,
  customer_id   UUID,
  customer_name TEXT,
  datum         DATE,
  faellig_am    DATE,
  tage_ueberfaellig INTEGER,
  gesamt        NUMERIC(12,2),
  bezahlt       NUMERIC(12,2),
  offen         NUMERIC(12,2),
  mahnstufe     SMALLINT,
  total_count   BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH offen AS (
    SELECT r.id, r.rechnung_nr, r.customer_id, r.customer_name, r.datum, r.faellig_am,
           COALESCE(r.gesamttotal, r.total, 0)::NUMERIC(12,2) AS gesamt,
           r.paid_total, r.open_amount
    FROM public.rechnungen r
    WHERE r.company_id = p_company_id
      AND r.status <> 'entwurf'
      AND r.open_amount > 0
  )
  SELECT o.id, o.rechnung_nr, o.customer_id, o.customer_name, o.datum, o.faellig_am,
         GREATEST(0, CURRENT_DATE - o.faellig_am)::INTEGER,
         o.gesamt, o.paid_total, o.open_amount,
         COALESCE((SELECT MAX(m.level) FROM public.invoice_reminders m
                   WHERE m.rechnung_id = o.id), 0::SMALLINT),
         (SELECT COUNT(*) FROM offen)
  FROM offen o
  ORDER BY o.faellig_am NULLS LAST, o.rechnung_nr
  LIMIT GREATEST(1, LEAST(p_limit, 200)) OFFSET GREATEST(0, p_offset);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.open_receivables(UUID,INTEGER,INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.open_receivables(UUID,INTEGER,INTEGER) TO authenticated;

COMMIT;
