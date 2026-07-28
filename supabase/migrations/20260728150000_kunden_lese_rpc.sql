-- =============================================================================
-- Lesezugriffe der Kundenkarte: Liste, Zusammenfassung, Verlauf
-- =============================================================================
--
-- BEFUND
-- Die Kundenliste soll je Zeile "letzte Aktivitaet", "offene Offerten" und
-- "offener Betrag" zeigen. Diese Werte leiten sich aus sechs Tabellen ab. Sie
-- als Spalten auf `customers` zu fuehren hiesse sechs AFTER-Trigger oder stilles
-- Veralten — genau das Muster, das dieser Umbau vermeiden soll.
--
-- ABHILFE
-- Drei Funktionen. Die Liste laeuft ueber search_customers() statt ueber
-- `from('customers')`, damit Suche, Sortierung, Seitenzahl UND die abgeleiteten
-- Werte in einer Abfrage entstehen.
--
-- Alle drei pruefen die Mitgliedschaft in der ERSTEN Zeile. Bewusst keine View:
-- eine View ohne `security_invoker = on` laeuft mit den Rechten ihres
-- Eigentuemers und umgeht RLS. Dass das keine graue Theorie ist, zeigen
-- 20260119150000 (vier Views nachtraeglich repariert) und 20260728080000 (zwei
-- weitere, eine davon nachweislich fuer anon offen).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Zusammenfassung fuer die Kundenkarte
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_summary(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kunde public.customers;
BEGIN
  SELECT * INTO v_kunde FROM public.customers WHERE id = p_customer_id;
  IF v_kunde.id IS NULL OR NOT public.is_company_member(v_kunde.company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Kunden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'kunde', to_jsonb(v_kunde),
    'anzahl', jsonb_build_object(
      'anfragen',   (SELECT count(*) FROM public.leads          WHERE customer_id = p_customer_id),
      'offerten',   (SELECT count(*) FROM public.offers         WHERE customer_id = p_customer_id),
      'auftraege',  (SELECT count(*) FROM public.auftraege      WHERE customer_id = p_customer_id AND deleted_at IS NULL),
      'termine',    (SELECT count(*) FROM public.appointments   WHERE customer_id = p_customer_id),
      'rechnungen', (SELECT count(*) FROM public.rechnungen     WHERE customer_id = p_customer_id),
      'quittungen', (SELECT count(*) FROM public.quittungen     WHERE customer_id = p_customer_id),
      'emails',     (SELECT count(*) FROM public.inbound_emails WHERE customer_id = p_customer_id)
    ),
    'pipeline', jsonb_build_object(
      'offerten_offen',     (SELECT count(*) FROM public.offers
                             WHERE customer_id = p_customer_id AND status IN ('draft','sent','viewed')),
      'offerten_akzeptiert',(SELECT count(*) FROM public.offers
                             WHERE customer_id = p_customer_id AND status = 'accepted'),
      'auftraege_offen',    (SELECT count(*) FROM public.auftraege
                             WHERE customer_id = p_customer_id AND deleted_at IS NULL
                               AND status NOT IN ('abgeschlossen','storniert'))
    ),
    'finanzen', jsonb_build_object(
      'fakturiert',  (SELECT COALESCE(SUM(gesamttotal), 0) FROM public.rechnungen
                      WHERE customer_id = p_customer_id AND status <> 'entwurf'),
      'bezahlt',     (SELECT COALESCE(SUM(gesamttotal), 0) FROM public.rechnungen
                      WHERE customer_id = p_customer_id AND status = 'bezahlt'),
      -- Naeherung bis zum Zahlungsbuch: "versendet" gilt als offen. Sobald es
      -- payments/payment_allocations gibt, kommt der Wert von dort.
      'offen',       (SELECT COALESCE(SUM(gesamttotal), 0) FROM public.rechnungen
                      WHERE customer_id = p_customer_id AND status = 'versendet'),
      -- BEWUSST getrennt und NICHT zu 'bezahlt' addiert: eine Quittung belegt
      -- oft dieselbe Leistung wie eine Rechnung. Zusammenzuzaehlen hiesse den
      -- Umsatz doppelt zu zaehlen.
      'quittungen',  (SELECT COALESCE(SUM(gesamttotal), 0) FROM public.quittungen
                      WHERE customer_id = p_customer_id)
    ),
    'aktivitaet', jsonb_build_object(
      'erster_kontakt',  v_kunde.first_seen_at,
      'letzte_aktion',   (SELECT max(t) FROM (
          SELECT max(created_at) t FROM public.leads        WHERE customer_id = p_customer_id
          UNION ALL SELECT max(created_at) FROM public.offers       WHERE customer_id = p_customer_id
          UNION ALL SELECT max(created_at) FROM public.auftraege    WHERE customer_id = p_customer_id
          UNION ALL SELECT max(created_at) FROM public.rechnungen   WHERE customer_id = p_customer_id
          UNION ALL SELECT max(created_at) FROM public.quittungen   WHERE customer_id = p_customer_id
          UNION ALL SELECT max(received_at) FROM public.inbound_emails WHERE customer_id = p_customer_id
          UNION ALL SELECT max(appointment_date::timestamptz) FROM public.appointments WHERE customer_id = p_customer_id
        ) x),
      'naechster_termin', (SELECT jsonb_build_object('id', a.id, 'datum', a.appointment_date,
                                                     'start', a.start_time, 'titel', a.title)
                           FROM public.appointments a
                           WHERE a.customer_id = p_customer_id
                             AND a.appointment_date >= CURRENT_DATE
                             AND a.status NOT IN ('cancelled')
                           ORDER BY a.appointment_date, a.start_time LIMIT 1)
    ),
    'zusammengefuehrt_aus', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', s.id, 'anzeigename', s.display_name, 'am', s.merged_at)), '[]'::jsonb)
      FROM public.customers s WHERE s.merged_into_customer_id = p_customer_id)
  );
END;
$$;

COMMENT ON FUNCTION public.customer_summary(UUID) IS
  'Kennzahlen der Kundenkarte. finanzen.quittungen steht ABSICHTLICH neben '
  'finanzen.bezahlt und wird nicht addiert — sonst zaehlt derselbe Umsatz zweimal. '
  'finanzen.offen ist eine Naeherung, bis es ein Zahlungsbuch gibt.';

-- -----------------------------------------------------------------------------
-- 2. Verlauf
--
-- event_at kommt je Zweig aus einer anderen Spalte: ein Termin kann in der
-- Zukunft liegen, ein Beleg traegt sein eigenes Datum. Nach created_at zu
-- sortieren wuerde den Umzug von morgen ans Ende der Liste setzen.
--
-- p_before steht von Anfang an in der Signatur, obwohl heute OFFSET genuegt:
-- der Wechsel auf Keyset-Blaettern soll spaeter keine Signatur- und keine
-- Oberflaechenaenderung kosten.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_timeline(
  p_customer_id UUID,
  p_limit       INTEGER     DEFAULT 50,
  p_offset      INTEGER     DEFAULT 0,
  p_before      TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  ereignis_am   TIMESTAMPTZ,
  ereignis_art  TEXT,
  entitaet      TEXT,
  entitaet_id   UUID,
  titel         TEXT,
  untertitel    TEXT,
  status        TEXT,
  betrag        NUMERIC(12,2),
  sprache       TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company UUID;
  v_limit   INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
BEGIN
  SELECT c.company_id INTO v_company FROM public.customers c WHERE c.id = p_customer_id;
  IF v_company IS NULL OR NOT public.is_company_member(v_company) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Kunden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH alle(ts, art, tab, eid, tit, sub, st, betr, spr) AS (
    -- Jede Spalte ausdruecklich gecastet: die Basistabellen fuehren varchar und
    -- eigene Aufzaehlungstypen, RETURNS TABLE verlangt text.
    SELECT l.created_at, 'anfrage'::TEXT, 'leads'::TEXT, l.id,
           COALESCE(NULLIF(l.service_type::TEXT, ''), 'Anfrage')::TEXT,
           NULLIF(TRIM(CONCAT_WS(' ', l.from_plz, l.from_city)), '')::TEXT,
           l.status::TEXT, NULL::NUMERIC(12,2), l.language::TEXT
    FROM public.leads l WHERE l.customer_id = p_customer_id
    UNION ALL
    SELECT o.created_at, 'offerte', 'offers', o.id,
           COALESCE(NULLIF(o.title, ''), 'Offerte')::TEXT, NULL::TEXT,
           o.status::TEXT, o.total::NUMERIC(12,2), o.language::TEXT
    FROM public.offers o WHERE o.customer_id = p_customer_id
    UNION ALL
    SELECT a.created_at, 'auftrag', 'auftraege', a.id,
           COALESCE(NULLIF(a.title, ''), 'Auftrag')::TEXT, a.auftrag_nummer::TEXT,
           a.status::TEXT, a.total::NUMERIC(12,2), a.language::TEXT
    FROM public.auftraege a WHERE a.customer_id = p_customer_id AND a.deleted_at IS NULL
    UNION ALL
    -- Der Termin wird nach seinem DATUM einsortiert, nicht nach seiner Erfassung.
    SELECT (t.appointment_date + COALESCE(t.start_time, TIME '00:00')) AT TIME ZONE 'Europe/Zurich',
           'termin', 'appointments', t.id,
           COALESCE(NULLIF(t.title, ''), 'Termin')::TEXT, t.appointment_type::TEXT,
           t.status::TEXT, NULL::NUMERIC(12,2), t.language::TEXT
    FROM public.appointments t WHERE t.customer_id = p_customer_id
    UNION ALL
    SELECT r.created_at, 'rechnung', 'rechnungen', r.id,
           COALESCE(r.rechnung_nr, 'Rechnung')::TEXT, NULL::TEXT,
           r.status::TEXT, r.gesamttotal::NUMERIC(12,2), r.language::TEXT
    FROM public.rechnungen r WHERE r.customer_id = p_customer_id
    UNION ALL
    SELECT q.created_at, 'quittung', 'quittungen', q.id,
           COALESCE(q.quittung_nr, 'Quittung')::TEXT, NULL::TEXT,
           q.status::TEXT, q.gesamttotal::NUMERIC(12,2), q.language::TEXT
    FROM public.quittungen q WHERE q.customer_id = p_customer_id
    UNION ALL
    SELECT i.received_at, 'email', 'inbound_emails', i.id,
           COALESCE(NULLIF(i.subject, ''), 'E-Mail')::TEXT, i.from_email::TEXT,
           i.processing_status::TEXT, NULL::NUMERIC(12,2), NULL::TEXT
    FROM public.inbound_emails i WHERE i.customer_id = p_customer_id
  )
  SELECT alle.ts, alle.art, alle.tab, alle.eid, alle.tit, alle.sub, alle.st, alle.betr, alle.spr
  FROM alle
  WHERE p_before IS NULL OR alle.ts < p_before
  ORDER BY alle.ts DESC, alle.eid
  LIMIT v_limit OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

COMMENT ON FUNCTION public.customer_timeline(UUID, INTEGER, INTEGER, TIMESTAMPTZ) IS
  'Verlauf eines Kunden ueber sieben Tabellen. Termine werden nach ihrem Datum '
  'einsortiert, nicht nach ihrer Erfassung. Ab etwa 1000 Ereignissen je Kunde '
  'gehoert das LIMIT in die einzelnen Zweige (MergeAppend); heute waere das '
  'verfruehte Optimierung.';

-- -----------------------------------------------------------------------------
-- 3. Liste
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_customers(
  p_company_id UUID,
  p_query      TEXT    DEFAULT NULL,
  p_filter     TEXT    DEFAULT 'alle',
  p_limit      INTEGER DEFAULT 25,
  p_offset     INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                  UUID,
  display_name        TEXT,
  customer_type       TEXT,
  first_name          TEXT,
  last_name           TEXT,
  company_name        TEXT,
  primary_email       TEXT,
  primary_phone       TEXT,
  language            TEXT,
  status              TEXT,
  possible_duplicate  BOOLEAN,
  first_seen_at       TIMESTAMPTZ,
  letzte_aktion       TIMESTAMPTZ,
  offerten_offen      INTEGER,
  auftraege_gesamt    INTEGER,
  offener_betrag      NUMERIC(12,2),
  bezahlter_betrag    NUMERIC(12,2),
  ort                 TEXT,
  gesamt              BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit  INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
  v_such   TEXT;
  v_ziffer TEXT;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_such := NULLIF(TRIM(COALESCE(p_query, '')), '');

  -- Der Bediener tippt "079 123 45 67", gespeichert ist "+41791234567". Nach dem
  -- Entfernen der Nicht-Ziffern bliebe "0791234567" — und das kommt in
  -- "+41791234567" NICHT vor. Die fuehrende Null der nationalen Schreibweise
  -- muss also weg, sonst findet die Suche ausgerechnet die Form nicht, die man
  -- am ehesten eintippt.
  v_ziffer := NULLIF(regexp_replace(
                regexp_replace(COALESCE(v_such, ''), '\D', '', 'g'),
                '^0+', ''), '');

  RETURN QUERY
  WITH treffer AS (
    SELECT c.*
    FROM public.customers c
    WHERE c.company_id = p_company_id
      -- Zusammengefuehrte Kunden erscheinen NIE in der Liste; die
      -- Nachvollziehbarkeit haengt am Hinweisband der Kundenkarte.
      AND c.merged_into_customer_id IS NULL
      AND (p_filter IS DISTINCT FROM 'person'    OR c.customer_type = 'person')
      AND (p_filter IS DISTINCT FROM 'firma'     OR c.customer_type = 'company')
      AND (p_filter IS DISTINCT FROM 'duplikate' OR c.possible_duplicate)
      AND (
        v_such IS NULL
        OR c.display_name  ILIKE '%' || v_such || '%'
        OR c.primary_email ILIKE '%' || v_such || '%'
        OR (v_ziffer IS NOT NULL AND length(v_ziffer) >= 3
            AND c.phone_normalized ILIKE '%' || v_ziffer || '%')
      )
  ),
  gezaehlt AS (SELECT count(*) AS n FROM treffer)
  SELECT
    t.id, t.display_name, t.customer_type, t.first_name, t.last_name, t.company_name,
    t.primary_email, t.primary_phone, t.language, t.status, t.possible_duplicate,
    t.first_seen_at,
    akt.letzte,
    COALESCE(off.offen, 0)::INTEGER,
    COALESCE(auf.n, 0)::INTEGER,
    COALESCE(fin.offen, 0)::NUMERIC(12,2),
    COALESCE(fin.bezahlt, 0)::NUMERIC(12,2),
    ort.ort,
    gezaehlt.n
  FROM treffer t
  CROSS JOIN gezaehlt
  LEFT JOIN LATERAL (
    SELECT max(x.t) AS letzte FROM (
      SELECT max(l.created_at) t FROM public.leads      l WHERE l.customer_id = t.id
      UNION ALL SELECT max(o.created_at) FROM public.offers     o WHERE o.customer_id = t.id
      UNION ALL SELECT max(a.created_at) FROM public.auftraege  a WHERE a.customer_id = t.id
      UNION ALL SELECT max(r.created_at) FROM public.rechnungen r WHERE r.customer_id = t.id
      UNION ALL SELECT max(i.received_at) FROM public.inbound_emails i WHERE i.customer_id = t.id
    ) x
  ) akt ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*) AS offen FROM public.offers o
    WHERE o.customer_id = t.id AND o.status IN ('draft','sent','viewed')
  ) off ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*) AS n FROM public.auftraege a
    WHERE a.customer_id = t.id AND a.deleted_at IS NULL
  ) auf ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(r.gesamttotal) FILTER (WHERE r.status = 'versendet'), 0) AS offen,
           COALESCE(SUM(r.gesamttotal) FILTER (WHERE r.status = 'bezahlt'),   0) AS bezahlt
    FROM public.rechnungen r WHERE r.customer_id = t.id
  ) fin ON TRUE
  LEFT JOIN LATERAL (
    SELECT NULLIF(TRIM(CONCAT_WS(' ', l.from_plz, l.from_city)), '') AS ort
    FROM public.leads l WHERE l.customer_id = t.id AND l.from_city IS NOT NULL
    ORDER BY l.created_at DESC LIMIT 1
  ) ort ON TRUE
  ORDER BY akt.letzte DESC NULLS LAST, t.display_name
  LIMIT v_limit OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

COMMENT ON FUNCTION public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER) IS
  'Kundenliste mit Suche, Filter und Seitenzahl. Die abgeleiteten Werte (letzte '
  'Aktion, offene Offerten, offener Betrag) entstehen hier per LATERAL statt als '
  'gespeicherte Spalten, die veralten wuerden. gesamt traegt die Trefferzahl fuer '
  'die Blaetterleiste. Ab etwa 10 000 Kunden braucht die ILIKE-Suche pg_trgm + '
  'GIN; heute nicht.';

REVOKE ALL ON FUNCTION public.customer_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_summary(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.customer_timeline(UUID, INTEGER, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_timeline(UUID, INTEGER, INTEGER, TIMESTAMPTZ) TO authenticated;
REVOKE ALL ON FUNCTION public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

COMMIT;
