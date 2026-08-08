-- =============================================================================
-- ROLLBACK für 20260807100000 — NICHT als Migration ausführen.
--
-- ⚠️ Löscht alle Kundenanschriften (`customer_addresses`). Diese Angaben stehen
--    NIRGENDWO sonst: Belegadressen sind Snapshots, `service_locations` sind
--    Einsatzstellen, und die Anschrift wurde bewusst nicht aus Leads gefüllt.
--    Nach dieser Datei ist sie weg und nicht rekonstruierbar.
--
--    Vorher sichern:
--      \copy (SELECT * FROM public.customer_addresses) TO 'anschriften.csv' CSV HEADER
--
-- ⚠️ Setzt `merge_customers` auf den Stand von 20260728130000 zurück — also auf
--    die Fassung, die NUR sieben Tabellen umhängt. Bereits zusammengeführte
--    Kunden bleiben zusammengeführt; künftige Zusammenführungen lassen dann
--    wieder Zahlungen, Fälle, Aufgaben, Orte und Anschriften an der Quelle
--    stehen. Das ist der Befund, den 20260807100000 behoben hat.
--
-- Die vier Lesefunktionen werden wortgleich auf ihre jeweils vorige Fassung
-- gesetzt (customer_summary + search_customers aus 20260729160000,
-- customer_merge_preview + merge_customers aus 20260728130000).
-- `customer_kennzahlen` und `customer_reference_columns` gab es vorher nicht und
-- werden entfernt.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Anschriften
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_customer_addresses_nachruecken ON public.customer_addresses;
DROP TRIGGER IF EXISTS trigger_customer_addresses_eine_hauptadresse ON public.customer_addresses;
DROP TRIGGER IF EXISTS customer_addresses_updated_at ON public.customer_addresses;
DROP FUNCTION IF EXISTS public.customer_addresses_hauptadresse_nachruecken();
DROP FUNCTION IF EXISTS public.customer_addresses_eine_hauptadresse();
DROP TABLE IF EXISTS public.customer_addresses;

-- -----------------------------------------------------------------------------
-- 2. Neue Funktionen entfernen
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.customer_kennzahlen(UUID);

-- -----------------------------------------------------------------------------
-- 3. customer_summary — Stand 20260729160000
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
      'fakturiert',  (SELECT COALESCE(SUM(COALESCE(gesamttotal, total, 0)), 0)
                      FROM public.rechnungen
                      WHERE customer_id = p_customer_id AND status <> 'entwurf'),
      'bezahlt',     (SELECT COALESCE(SUM(amount), 0) FROM public.payments
                      WHERE customer_id = p_customer_id),
      'offen',       (SELECT COALESCE(SUM(open_amount), 0) FROM public.rechnungen
                      WHERE customer_id = p_customer_id
                        AND status <> 'entwurf' AND open_amount > 0),
      'davon_quittungen', (SELECT COALESCE(SUM(p.amount), 0)
                      FROM public.payments p
                      JOIN public.quittungen q ON q.payment_id = p.id
                      WHERE p.customer_id = p_customer_id),
      'gutschriften', (SELECT COALESCE(SUM(amount), 0) FROM public.credit_notes
                      WHERE customer_id = p_customer_id AND status = 'versendet')
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

-- -----------------------------------------------------------------------------
-- 4. search_customers — Stand 20260729160000
--
-- Der Rückgabetyp ändert sich (ort_quelle und offene_faelle fallen weg),
-- deshalb erst DROP, dann neu anlegen.
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER);

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
  v_ziffer := NULLIF(regexp_replace(
                regexp_replace(COALESCE(v_such, ''), '\D', '', 'g'),
                '^0+', ''), '');

  RETURN QUERY
  WITH treffer AS (
    SELECT c.*
    FROM public.customers c
    WHERE c.company_id = p_company_id
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
    SELECT COALESCE(SUM(r.open_amount) FILTER (
             WHERE r.status <> 'entwurf' AND r.open_amount > 0), 0) AS offen,
           COALESCE((SELECT SUM(p.amount) FROM public.payments p
                     WHERE p.customer_id = t.id), 0) AS bezahlt
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

REVOKE ALL ON FUNCTION public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. customer_merge_preview + merge_customers — Stand 20260728130000
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_merge_preview(
  p_company_id         UUID,
  p_source_customer_id UUID,
  p_target_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_src public.customers; v_tgt public.customers;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_src FROM public.customers WHERE id = p_source_customer_id AND company_id = p_company_id;
  SELECT * INTO v_tgt FROM public.customers WHERE id = p_target_customer_id AND company_id = p_company_id;
  IF v_src.id IS NULL OR v_tgt.id IS NULL THEN
    RAISE EXCEPTION 'Kunde gehoert nicht zu dieser Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'moves', jsonb_build_object(
      'leads',          (SELECT count(*) FROM public.leads          WHERE customer_id = v_src.id),
      'offers',         (SELECT count(*) FROM public.offers         WHERE customer_id = v_src.id),
      'auftraege',      (SELECT count(*) FROM public.auftraege      WHERE customer_id = v_src.id),
      'appointments',   (SELECT count(*) FROM public.appointments   WHERE customer_id = v_src.id),
      'rechnungen',     (SELECT count(*) FROM public.rechnungen     WHERE customer_id = v_src.id),
      'quittungen',     (SELECT count(*) FROM public.quittungen     WHERE customer_id = v_src.id),
      'inbound_emails', (SELECT count(*) FROM public.inbound_emails WHERE customer_id = v_src.id)
    ),
    'fills', (
      SELECT jsonb_object_agg(feld, wert) FROM (
        SELECT 'first_name' AS feld, v_src.first_name AS wert
          WHERE v_tgt.first_name IS NULL AND v_src.first_name IS NOT NULL
        UNION ALL SELECT 'last_name', v_src.last_name
          WHERE v_tgt.last_name IS NULL AND v_src.last_name IS NOT NULL
        UNION ALL SELECT 'company_name', v_src.company_name
          WHERE v_tgt.company_name IS NULL AND v_src.company_name IS NOT NULL
        UNION ALL SELECT 'primary_email', v_src.primary_email
          WHERE v_tgt.primary_email IS NULL AND v_src.primary_email IS NOT NULL
        UNION ALL SELECT 'primary_phone', v_src.primary_phone
          WHERE v_tgt.primary_phone IS NULL AND v_src.primary_phone IS NOT NULL
        UNION ALL SELECT 'salutation', v_src.salutation
          WHERE v_tgt.salutation IS NULL AND v_src.salutation IS NOT NULL
        UNION ALL SELECT 'external_customer_number', v_src.external_customer_number
          WHERE v_tgt.external_customer_number IS NULL AND v_src.external_customer_number IS NOT NULL
      ) f
    ),
    'conflicts', (
      SELECT jsonb_object_agg(feld, jsonb_build_object('ziel', ziel, 'quelle', quelle)) FROM (
        SELECT 'first_name' AS feld, v_tgt.first_name AS ziel, v_src.first_name AS quelle
          WHERE v_tgt.first_name IS NOT NULL AND v_src.first_name IS NOT NULL
            AND v_tgt.first_name IS DISTINCT FROM v_src.first_name
        UNION ALL SELECT 'last_name', v_tgt.last_name, v_src.last_name
          WHERE v_tgt.last_name IS NOT NULL AND v_src.last_name IS NOT NULL
            AND v_tgt.last_name IS DISTINCT FROM v_src.last_name
        UNION ALL SELECT 'primary_email', v_tgt.primary_email, v_src.primary_email
          WHERE v_tgt.primary_email IS NOT NULL AND v_src.primary_email IS NOT NULL
            AND v_tgt.primary_email IS DISTINCT FROM v_src.primary_email
        UNION ALL SELECT 'primary_phone', v_tgt.primary_phone, v_src.primary_phone
          WHERE v_tgt.primary_phone IS NOT NULL AND v_src.primary_phone IS NOT NULL
            AND v_tgt.primary_phone IS DISTINCT FROM v_src.primary_phone
        UNION ALL SELECT 'language', v_tgt.language, v_src.language
          WHERE v_tgt.language IS DISTINCT FROM v_src.language
      ) c
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_customers(
  p_company_id         UUID,
  p_source_customer_id UUID,
  p_target_customer_id UUID,
  p_reason             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_src   public.customers;
  v_tgt   public.customers;
  v_moved JSONB := '{}'::JSONB;
  v_n     INTEGER;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Zusammenfuehren ist owner und admin vorbehalten'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_source_customer_id = p_target_customer_id THEN
    RAISE EXCEPTION 'Quelle und Ziel sind identisch'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM 1 FROM public.customers
   WHERE id IN (p_source_customer_id, p_target_customer_id)
   ORDER BY id FOR UPDATE;

  SELECT * INTO v_src FROM public.customers WHERE id = p_source_customer_id;
  SELECT * INTO v_tgt FROM public.customers WHERE id = p_target_customer_id;

  IF v_src.id IS NULL OR v_tgt.id IS NULL
     OR v_src.company_id <> p_company_id OR v_tgt.company_id <> p_company_id THEN
    RAISE EXCEPTION 'Kunde gehoert nicht zu dieser Firma'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_src.merged_into_customer_id IS NOT NULL OR v_tgt.merged_into_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bereits zusammengefuehrte Kunden'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.leads SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('leads', v_n);

  UPDATE public.offers SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('offers', v_n);

  UPDATE public.auftraege SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('auftraege', v_n);

  UPDATE public.appointments SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('appointments', v_n);

  UPDATE public.rechnungen SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('rechnungen', v_n);

  UPDATE public.quittungen SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('quittungen', v_n);

  UPDATE public.inbound_emails SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('inbound_emails', v_n);

  UPDATE public.customers SET
    first_name               = COALESCE(first_name,               v_src.first_name),
    last_name                = COALESCE(last_name,                v_src.last_name),
    company_name             = COALESCE(company_name,             v_src.company_name),
    primary_email            = COALESCE(primary_email,            v_src.primary_email),
    primary_phone            = COALESCE(primary_phone,            v_src.primary_phone),
    salutation               = COALESCE(salutation,               v_src.salutation),
    external_customer_number = COALESCE(external_customer_number, v_src.external_customer_number),
    notes                    = COALESCE(notes,                    v_src.notes),
    source                   = COALESCE(source,                   v_src.source),
    first_seen_at            = LEAST(first_seen_at, v_src.first_seen_at),
    possible_duplicate       = FALSE
  WHERE id = v_tgt.id;

  INSERT INTO public.customer_merges (
    company_id, source_customer_id, target_customer_id, merged_by,
    reason, moved_counts, source_snapshot)
  VALUES (p_company_id, v_src.id, v_tgt.id, auth.uid(),
          NULLIF(TRIM(COALESCE(p_reason, '')), ''), v_moved, to_jsonb(v_src));

  UPDATE public.customers
  SET merged_into_customer_id = v_tgt.id,
      merged_at               = NOW(),
      status                  = 'inactive'
  WHERE id = v_src.id;

  RETURN jsonb_build_object('target_customer_id', v_tgt.id, 'moved', v_moved);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. guard_payment_append_only — Stand 20260729100000 (ohne Merge-Ausnahme)
--
-- Muss NACH merge_customers zurückgesetzt werden: die alte Fassung hängt keine
-- Zahlungen um und braucht die Ausnahme deshalb nicht.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_payment_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  erlaubt TEXT[] := ARRAY['reconciliation_status','reference','note'];
  spalte  TEXT;
  alt_j   JSONB := to_jsonb(OLD);
  neu_j   JSONB := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Zahlungen werden nicht geloescht, sondern storniert (Gegenbuchung).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR spalte IN
    SELECT a.attname FROM pg_attribute a
    WHERE a.attrelid = TG_RELID AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attgenerated = ''
  LOOP
    IF NOT (spalte = ANY(erlaubt))
       AND (alt_j -> spalte) IS DISTINCT FROM (neu_j -> spalte) THEN
      RAISE EXCEPTION
        'Zahlung %: "%" ist nicht nachtraeglich aenderbar. Korrektur nur per Storno.',
        OLD.id, spalte
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Zuletzt, weil merge_customers() und customer_merge_preview() sie oben noch
-- nicht mehr brauchen, die alten Fassungen aber auch nicht.
DROP FUNCTION IF EXISTS public.customer_reference_columns();

COMMIT;
