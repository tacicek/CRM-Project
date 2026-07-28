-- =============================================================================
-- Was der Kunde im Portal sieht
-- =============================================================================
--
-- Eine Funktion, ein Sitzungstoken, eine Antwort. Der Kunde wird NIE als
-- Argument uebergeben — er ergibt sich aus dem Token. Ein Parameter waere die
-- Einladung, ihn zu veraendern.
--
-- SPALTEN EINZELN AUFGEZAEHLT, NICHT `to_jsonb(zeile)`.
-- `auftraege` und `appointments` tragen beide eine Spalte `internal_notes`,
-- `auftraege` zusaetzlich `completion_notes` und die Kalkulationsfelder
-- (`hourly_rate`, `pricing_type`, `subtotal`). Nichts davon geht den Kunden
-- etwas an. Bei `to_jsonb` waere die naechste hinzugefuegte Spalte automatisch
-- mit drin — hier muss sie jemand bewusst aufnehmen.
--
-- DIE BESTEHENDEN TOKEN-SEITEN BLEIBEN. Das Portal ersetzt sie nicht, es
-- verlinkt sie: `access_token` der Offerte und des Nachtrags wandern mit in die
-- Antwort, damit „Offerte ansehen" auf die Seite fuehrt, die es schon gibt.
-- Der Kunde hat diese Token ohnehin — sie standen in seiner E-Mail.
--
-- SPRACHE: die Antwort enthaelt `sprache` aus `customers.language`. Das Portal
-- loest damit `documentI18nFor(...)` auf und ruft NIE `useT()` — sonst spraeche
-- die Kundenseite die Sprache des Bedieners.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.portal_overview(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_kunde_id UUID;
  v_kunde    RECORD;
BEGIN
  v_kunde_id := public.portal_session_customer(p_session);
  IF v_kunde_id IS NULL THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  PERFORM public.portal_touch_session(p_session);

  SELECT * INTO v_kunde FROM public.customers WHERE id = v_kunde_id;

  RETURN jsonb_build_object(
    'kunde', jsonb_build_object(
      'anzeigename', v_kunde.display_name,
      'vorname',     v_kunde.first_name,
      'nachname',    v_kunde.last_name,
      'firma',       v_kunde.company_name,
      'email',       v_kunde.primary_email,
      'telefon',     v_kunde.primary_phone,
      'sprache',     v_kunde.language
    ),
    'firma', (SELECT jsonb_build_object(
                'name',  c.company_name,
                'email', c.email,
                'telefon', c.phone)
              FROM public.companies c WHERE c.id = v_kunde.company_id),

    'offerten', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',          o.id,
               'nummer',      o.offer_number,
               'titel',       o.title,
               'status',      o.status,
               'total',       o.total,
               'gueltig_bis', o.valid_until,
               'leistungsdatum', o.service_date,
               'ueberholt',   (o.superseded_at IS NOT NULL),
               'fassung',     o.version_number,
               'token',       o.access_token)
             ORDER BY o.created_at DESC)
      FROM public.offers o WHERE o.customer_id = v_kunde_id), '[]'::jsonb),

    'nachtraege', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',     a.id,
               'nummer', a.amendment_number,
               'titel',  a.title,
               'status', a.status,
               'total',  a.total,
               'token',  a.access_token)
             ORDER BY a.created_at DESC)
      FROM public.offer_amendments a
      WHERE a.customer_id = v_kunde_id AND a.status <> 'entwurf'), '[]'::jsonb),

    'termine', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',     t.id,
               'datum',  t.appointment_date,
               'start',  t.start_time,
               'ende',   t.end_time,
               'art',    t.appointment_type,
               'status', t.status,
               'titel',  t.title,
               'ort',    NULLIF(TRIM(CONCAT_WS(' ', t.location_address, t.location_plz, t.location_city)), ''))
             ORDER BY t.appointment_date DESC, t.start_time DESC)
      FROM public.appointments t
      WHERE t.customer_id = v_kunde_id AND t.status <> 'cancelled'), '[]'::jsonb),

    'auftraege', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',     g.id,
               'nummer', g.auftrag_nummer,
               'titel',  g.title,
               'status', g.status,
               'datum',  g.scheduled_date,
               'total',  g.total)
             ORDER BY g.scheduled_date DESC NULLS LAST)
      FROM public.auftraege g
      WHERE g.customer_id = v_kunde_id AND g.deleted_at IS NULL), '[]'::jsonb),

    'rechnungen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',        r.id,
               'nummer',    r.rechnung_nr,
               'datum',     r.datum,
               'faellig',   r.faellig_am,
               'total',     COALESCE(r.gesamttotal, r.total, 0),
               'bezahlt',   r.paid_total,
               'offen',     r.open_amount,
               'status',    r.status)
             ORDER BY r.datum DESC)
      FROM public.rechnungen r
      WHERE r.customer_id = v_kunde_id AND r.status <> 'entwurf'), '[]'::jsonb),

    -- Nur lesen. Eine Zahlung ausloesen kann das Portal nicht: dafuer braeuchte
    -- es einen Zahlungsanbieter, und Zahlungslogik gehoert laut CLAUDE.md
    -- ausdruecklich nicht in dieses Projekt.
    'zahlungen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'datum',  z.payment_date,
               'betrag', z.amount,
               'weg',    z.method)
             ORDER BY z.payment_date DESC)
      FROM public.payments z WHERE z.customer_id = v_kunde_id), '[]'::jsonb),

    'offener_betrag', COALESCE((
      SELECT SUM(r.open_amount) FROM public.rechnungen r
      WHERE r.customer_id = v_kunde_id AND r.status <> 'entwurf' AND r.open_amount > 0), 0)
  );
END;
$$;

COMMENT ON FUNCTION public.portal_overview(TEXT) IS
  'Portalansicht eines Kunden. Der Kunde ergibt sich aus dem Sitzungstoken, '
  'nie aus einem Argument. Spalten sind einzeln aufgezaehlt — internal_notes '
  'und die Kalkulationsfelder duerfen nicht mitwandern.';

GRANT EXECUTE ON FUNCTION public.portal_overview(TEXT) TO anon, authenticated;

COMMIT;
