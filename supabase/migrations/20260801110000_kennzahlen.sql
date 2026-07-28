-- =============================================================================
-- Kennzahlen aus der Datenbank, nicht aus dem Browser
-- =============================================================================
--
-- BEFUND
-- Was das Dashboard heute zeigt, zaehlt es selbst: `Dashboard.tsx` laedt Zeilen
-- und ruft `.length` darauf. Das hat drei Folgen, die alle schon eingetreten
-- sind:
--
--   * Die Zahl haengt daran, wie viele Zeilen geladen wurden. `Offerten.tsx`
--     hat ein stilles `.limit(200)`.
--   * Zwei Bildschirme koennen dasselbe verschieden zaehlen, weil jeder seine
--     eigene Definition mitbringt.
--   * Es gibt keine Kohorte. „Wie viele Offerten wurden angenommen" ohne
--     Zeitraum und ohne Nenner ist keine Kennzahl, sondern eine Zahl.
--
-- ABHILFE
-- `lifecycle_kpis(firma, von, bis)` — eine Funktion, ein Zeitraum, alle Zahlen
-- mit ausgeschriebenem Nenner.
--
-- GEZAEHLT WIRD DIE SERIE, NICHT DIE ZEILE.
-- Seit der Offertenversionierung (20260728190000) ist eine ueberarbeitete
-- Offerte eine NEUE Zeile mit derselben `offer_series_id`. Wer Zeilen zaehlt,
-- bestraft jede Ueberarbeitung: drei Fassungen und eine Annahme ergaeben eine
-- Quote von 33 % statt 100 %. Die Roadmap verlangt das ausdruecklich, und es
-- ist der einzige Punkt, an dem diese Funktion leicht falsch waere.
--
-- BEWUSST NICHT DABEI, mit Grund:
--   * Attach Rate (Kiste/Lager/Reinigung im Umzug) — dafuer muesste der
--     Leistungskatalog seine Positionen einer Kategorie zuordnen; er tut es
--     nicht. Eine Quote auf geratener Zuordnung waere schlechter als keine.
--   * Bewertung/Weiterempfehlung — es gibt keinen Vorgang, der eine Anfrage
--     dafuer verschickt. Ohne Nenner keine Quote.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.lifecycle_kpis(
  p_company_id UUID,
  p_von        DATE DEFAULT NULL,
  p_bis        DATE DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_von DATE := COALESCE(p_von, CURRENT_DATE - 365);
  v_bis DATE := COALESCE(p_bis, CURRENT_DATE);
  v_erg JSONB;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH
  -- Kohorte 1: Anfragen, die IM ZEITRAUM entstanden sind.
  anfragen AS (
    SELECT l.* FROM public.leads l
    WHERE l.company_id = p_company_id
      AND l.created_at::DATE BETWEEN v_von AND v_bis
  ),
  -- Serien statt Zeilen. Eine Serie gilt als versendet, sobald irgendeine
  -- ihrer Fassungen versendet wurde.
  serien AS (
    SELECT o.offer_series_id,
           MIN(o.lead_id::TEXT)::UUID          AS lead_id,
           MIN(o.customer_id::TEXT)::UUID      AS customer_id,
           MIN(o.sent_at)                      AS erst_versand,
           BOOL_OR(o.status <> 'draft')        AS je_heraus,
           BOOL_OR(o.status = 'accepted')      AS angenommen,
           MIN(o.viewed_at)  FILTER (WHERE o.status = 'accepted')   AS angesehen_am,
           MIN(o.accepted_at) FILTER (WHERE o.status = 'accepted')  AS angenommen_am
    FROM public.offers o
    WHERE o.company_id = p_company_id AND o.offer_series_id IS NOT NULL
    GROUP BY o.offer_series_id
  ),
  -- Kohorte 2: Serien, die IM ZEITRAUM zum ersten Mal hinausgingen.
  serien_im_zeitraum AS (
    SELECT * FROM serien WHERE erst_versand::DATE BETWEEN v_von AND v_bis
  ),
  erstkontakt AS (
    SELECT a.id,
           a.created_at,
           LEAST(
             (SELECT MIN(m.occurred_at) FROM public.communication_messages m
              JOIN public.communication_threads t ON t.id = m.thread_id
              WHERE m.direction = 'outbound'
                AND (t.lead_id = a.id OR (a.customer_id IS NOT NULL AND t.customer_id = a.customer_id))
                AND m.occurred_at >= a.created_at),
             (SELECT MIN(s.erst_versand) FROM serien s WHERE s.lead_id = a.id)
           ) AS erste_reaktion
    FROM anfragen a
  ),
  zahlung_je_kunde AS (
    SELECT p.customer_id, SUM(p.amount) AS summe
    FROM public.payments p
    WHERE p.company_id = p_company_id AND p.customer_id IS NOT NULL
    GROUP BY p.customer_id
  ),
  -- Vollstaendig bezahlte Rechnungen: Datum der letzten Anrechnung.
  tilgung AS (
    SELECT r.id, r.datum,
           (SELECT MAX(z.payment_date) FROM public.payment_allocations al
            JOIN public.payments z ON z.id = al.payment_id
            WHERE al.rechnung_id = r.id) AS getilgt_am
    FROM public.rechnungen r
    WHERE r.company_id = p_company_id
      AND r.status <> 'entwurf'
      AND r.open_amount <= 0
      AND r.datum BETWEEN v_von AND v_bis
  ),
  abgeschlossene_auftraege AS (
    SELECT g.* FROM public.auftraege g
    WHERE g.company_id = p_company_id AND g.deleted_at IS NULL
      AND g.status = 'abgeschlossen'
      AND COALESCE(g.completed_at::DATE, g.scheduled_date) BETWEEN v_von AND v_bis
  )
  SELECT jsonb_build_object(
    'zeitraum', jsonb_build_object('von', v_von, 'bis', v_bis),

    'trichter', jsonb_build_object(
      -- Nenner ausgeschrieben, damit die Zahl lesbar bleibt.
      'anfragen',            (SELECT COUNT(*) FROM anfragen),
      'anfragen_mit_offerte', (SELECT COUNT(*) FROM anfragen a
                               WHERE EXISTS (SELECT 1 FROM serien s
                                             WHERE s.lead_id = a.id AND s.je_heraus)),
      'serien_versendet',    (SELECT COUNT(*) FROM serien_im_zeitraum),
      'serien_angenommen',   (SELECT COUNT(*) FROM serien_im_zeitraum WHERE angenommen)
    ),

    'dauer_tage', jsonb_build_object(
      'erste_reaktion', (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (erste_reaktion - created_at)) / 86400)::NUMERIC, 2)
                         FROM erstkontakt WHERE erste_reaktion IS NOT NULL),
      'bis_offerte',    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s.erst_versand - l.created_at)) / 86400)::NUMERIC, 2)
                         FROM serien s JOIN public.leads l ON l.id = s.lead_id
                         WHERE l.company_id = p_company_id
                           AND s.erst_versand::DATE BETWEEN v_von AND v_bis),
      'ansicht_bis_annahme', (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (angenommen_am - angesehen_am)) / 86400)::NUMERIC, 2)
                         FROM serien_im_zeitraum
                         WHERE angesehen_am IS NOT NULL AND angenommen_am IS NOT NULL),
      'bis_tilgung',    (SELECT ROUND(AVG(getilgt_am - datum)::NUMERIC, 2)
                         FROM tilgung WHERE getilgt_am IS NOT NULL)
    ),

    'verlustgruende', COALESCE((
      SELECT jsonb_object_agg(grund, n) FROM (
        SELECT COALESCE(lost_reason_code, 'ohne_angabe') AS grund, COUNT(*) AS n
        FROM anfragen WHERE sales_stage = 'lost' GROUP BY 1
      ) x), '{}'::jsonb),

    'kunden', jsonb_build_object(
      'gesamt',        (SELECT COUNT(*) FROM public.customers
                        WHERE company_id = p_company_id AND merged_into_customer_id IS NULL),
      -- Ueber ALLE Zeitraeume: ein Lebenswert, der nur den Zeitraum kennt,
      -- ist kein Lebenswert.
      'ltv_schnitt',   (SELECT ROUND(AVG(summe), 2) FROM zahlung_je_kunde),
      'ltv_summe',     (SELECT COALESCE(SUM(summe), 0) FROM zahlung_je_kunde),
      'wiederkehrend', (SELECT COUNT(*) FROM (
                          SELECT customer_id FROM public.leads
                          WHERE company_id = p_company_id AND customer_id IS NOT NULL
                            AND sales_stage = 'won'
                          GROUP BY customer_id HAVING COUNT(*) > 1) x),
      'cross_sell',    (SELECT COUNT(*) FROM (
                          SELECT customer_id FROM public.leads
                          WHERE company_id = p_company_id AND customer_id IS NOT NULL
                          GROUP BY customer_id HAVING COUNT(DISTINCT service_type) > 1) x)
    ),

    'geld', jsonb_build_object(
      'kassiert',      (SELECT COALESCE(SUM(amount), 0) FROM public.payments
                        WHERE company_id = p_company_id AND payment_date BETWEEN v_von AND v_bis),
      'offen',         (SELECT COALESCE(SUM(open_amount), 0) FROM public.rechnungen
                        WHERE company_id = p_company_id AND status <> 'entwurf' AND open_amount > 0),
      'gutschriften',  (SELECT COALESCE(SUM(amount), 0) FROM public.credit_notes
                        WHERE company_id = p_company_id AND status = 'versendet'
                          AND datum BETWEEN v_von AND v_bis)
    ),

    'qualitaet', jsonb_build_object(
      'auftraege_abgeschlossen', (SELECT COUNT(*) FROM abgeschlossene_auftraege),
      'faelle',        (SELECT COUNT(*) FROM public.customer_cases c
                        WHERE c.company_id = p_company_id
                          AND c.reported_at::DATE BETWEEN v_von AND v_bis),
      'schaeden',      (SELECT COUNT(*) FROM public.customer_cases c
                        WHERE c.company_id = p_company_id AND c.case_type = 'damage'
                          AND c.reported_at::DATE BETWEEN v_von AND v_bis),
      'reklamationen', (SELECT COUNT(*) FROM public.customer_cases c
                        WHERE c.company_id = p_company_id AND c.case_type = 'complaint'
                          AND c.reported_at::DATE BETWEEN v_von AND v_bis),
      'nachreinigungen', (SELECT COUNT(*) FROM public.customer_cases c
                        WHERE c.company_id = p_company_id AND c.case_type = 'recleaning'
                          AND c.reported_at::DATE BETWEEN v_von AND v_bis)
    ),

    'posteingang', jsonb_build_object(
      'faeden_offen',  (SELECT COUNT(*) FROM public.communication_threads
                        WHERE company_id = p_company_id AND status <> 'erledigt'),
      'unbeantwortet', (SELECT COUNT(*) FROM public.communication_threads
                        WHERE company_id = p_company_id AND first_unanswered_at IS NOT NULL),
      'aeltester_unbeantwortet_tage', (SELECT ROUND(EXTRACT(EPOCH FROM (NOW() - MIN(first_unanswered_at))) / 86400)
                        FROM public.communication_threads
                        WHERE company_id = p_company_id AND first_unanswered_at IS NOT NULL)
    )
  ) INTO v_erg;

  RETURN v_erg;
END;
$$;

COMMENT ON FUNCTION public.lifecycle_kpis(UUID, DATE, DATE) IS
  'Kennzahlen des Kundenlebenszyklus. Gezaehlt wird die offer_series_id, nicht '
  'die Offertenzeile — sonst senkt jede Ueberarbeitung die Annahmequote. Jeder '
  'Quotient traegt Zaehler UND Nenner, damit die Zahl lesbar bleibt.';

REVOKE EXECUTE ON FUNCTION public.lifecycle_kpis(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.lifecycle_kpis(UUID, DATE, DATE) TO authenticated;

COMMIT;
