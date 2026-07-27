-- =============================================================================
-- Den Kundennamen nicht mehr zusammenkleben und danach raten
-- =============================================================================
--
-- BEFUND
-- Der Name einer Person laeuft durch die Kette und kommt falsch heraus:
--
--   offers.customer_first_name = 'Anna Maria'
--   offers.customer_last_name  = 'von Gunten'
--        │  update_offer_by_token: TRIM(CONCAT(first, ' ', last))
--        ▼
--   auftraege.customer_name    = 'Anna Maria von Gunten'      ← EIN Feld
--        │  create_appointments_for_auftrag: split_part(…, ' ', 1)
--        ▼
--   appointments.customer_first_name = 'Anna'
--   appointments.customer_last_name  = 'Maria von Gunten'     ← FALSCH
--
-- Die Ursache liegt NICHT beim split_part. Sie liegt beim CONCAT: dort wird eine
-- Information vernichtet, die unmittelbar daneben getrennt vorliegt. Der
-- split_part ist nur der Ort, an dem der Verlust sichtbar wird — er muss raten,
-- weil ihm die Trennung genommen wurde.
--
-- ABHILFE
-- 1. auftraege bekommt customer_first_name / customer_last_name.
-- 2. update_offer_by_token schreibt beide Felder GETRENNT mit. Hier endet die
--    Vernichtung.
-- 3. create_appointments_for_auftrag liest die neuen Felder. Der split_part
--    bleibt als Rueckfall stehen — fuer die 15 Auftraege von vor dieser
--    Migration und fuer Zeilen, die jemand direkt per SQL schreibt, gibt es
--    nichts Getrenntes zu lesen. Das ist kein Pflaster: fuer diese Zeilen IST
--    die fehlende Quelle die Ursache.
--
-- customer_name BLEIBT und bleibt NOT NULL. Es ist keine abgeleitete Spalte,
-- sondern — wie customer_email daneben — der eingefrorene Stand zum Zeitpunkt
-- des Auftrags. Die Belegdarstellung (PDF, QR-Rechnung) liest es.
--
-- BEWUSST NICHT geaendert: rechnungen und quittungen. Dort wird der Name
-- nirgends zerlegt; zwei ungenutzte Spalten haetten nur den Anschein erweckt,
-- ein Problem sei geloest. Wer den Namen dort strukturiert braucht, geht ueber
-- customer_id → customers.first_name/last_name.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Spalten
-- -----------------------------------------------------------------------------

ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS customer_first_name TEXT;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS customer_last_name  TEXT;

COMMENT ON COLUMN public.auftraege.customer_first_name IS
  'Vorname zum Zeitpunkt des Auftrags. NULL bei Zeilen von vor 2026-07-28 — '
  'dort steht nur der zusammengesetzte customer_name.';
COMMENT ON COLUMN public.auftraege.customer_last_name IS
  'Nachname zum Zeitpunkt des Auftrags. Siehe customer_first_name.';
COMMENT ON COLUMN public.auftraege.customer_name IS
  'Anzeigename fuer Beleg und PDF, eingefroren. Bleibt fuehrend fuer die '
  'Darstellung; die strukturierte Form steht in customer_first_name/last_name.';

-- -----------------------------------------------------------------------------
-- 2. update_offer_by_token — Vor- und Nachname getrennt mitschreiben
--
-- Unveraendert gegenueber 20260705100000 bis auf die zwei neuen Spalten in
-- INSERT-Liste und SELECT.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_offer_by_token(
  offer_access_token          TEXT,
  new_status                  TEXT        DEFAULT NULL,
  new_viewed_at               TIMESTAMPTZ DEFAULT NULL,
  new_accepted_at             TIMESTAMPTZ DEFAULT NULL,
  new_rejected_at             TIMESTAMPTZ DEFAULT NULL,
  new_customer_response_note  TEXT        DEFAULT NULL,
  new_agb_accepted_at         TIMESTAMPTZ DEFAULT NULL,
  new_agb_version             TEXT        DEFAULT NULL,
  new_agb_ip_address          TEXT        DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected_rows         integer;
  v_status              text;
  v_service_date        date;
  v_valid_until         date;
  v_acceptance_deadline date;
  v_offer_id            uuid;
  v_company_id          uuid;
  v_lead_id             uuid;
  ALLOWED_STATUSES      text[] := ARRAY['viewed', 'accepted', 'rejected'];
  TERMINAL_STATUSES     text[] := ARRAY['accepted', 'rejected'];
BEGIN
  IF new_status IS NOT NULL AND NOT (new_status = ANY(ALLOWED_STATUSES)) THEN
    RAISE EXCEPTION 'Invalid status value: %', new_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT status, service_date, valid_until, id, company_id, lead_id
  INTO v_status, v_service_date, v_valid_until, v_offer_id, v_company_id, v_lead_id
  FROM public.offers
  WHERE access_token = offer_access_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Eine angenommene Offerte wird nicht abgelehnt und umgekehrt.
  IF new_status IS NOT NULL AND v_status = ANY(TERMINAL_STATUSES) THEN
    RETURN false;
  END IF;

  IF new_status = 'accepted' THEN
    v_acceptance_deadline := v_valid_until;
    IF v_service_date IS NOT NULL THEN
      IF v_acceptance_deadline IS NULL OR (v_service_date - INTERVAL '1 day')::date < v_acceptance_deadline THEN
        v_acceptance_deadline := (v_service_date - INTERVAL '1 day')::date;
      END IF;
    END IF;
    IF v_acceptance_deadline IS NOT NULL AND CURRENT_DATE > v_acceptance_deadline THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.offers
  SET
    status                 = COALESCE(new_status, status),
    viewed_at              = COALESCE(new_viewed_at, viewed_at),
    accepted_at            = COALESCE(new_accepted_at, accepted_at),
    rejected_at            = COALESCE(new_rejected_at, rejected_at),
    customer_response_note = COALESCE(new_customer_response_note, customer_response_note),
    agb_accepted_at        = COALESCE(new_agb_accepted_at, agb_accepted_at),
    agb_version            = COALESCE(new_agb_version, agb_version)
    -- agb_ip_address intentionally NOT updated from caller-supplied value
  WHERE access_token = offer_access_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN
    RETURN false;
  END IF;

  IF new_status = 'accepted' AND v_offer_id IS NOT NULL THEN
    INSERT INTO public.auftraege (
      company_id,
      offer_id,
      lead_id,
      auftrag_nummer,
      title,
      customer_name,
      customer_first_name,
      customer_last_name,
      customer_email,
      customer_phone,
      from_address,
      to_address,
      scheduled_date,
      scheduled_time,
      description,
      status,
      subtotal,
      vat_rate,
      vat_amount,
      total,
      service_type,
      pricing_type,
      hourly_rate,
      items
    )
    SELECT
      o.company_id,
      o.id,
      o.lead_id,
      '',   -- auftrag_nummer: trigger tarafından otomatik oluşturulur
      COALESCE(NULLIF(o.title, ''), 'Auftrag'),
      -- Anzeigename fuer den Beleg …
      TRIM(CONCAT(
        COALESCE(o.customer_first_name, ''), ' ',
        COALESCE(o.customer_last_name, '')
      )),
      -- … und daneben die Trennung, die die Offerte ohnehin schon kennt.
      NULLIF(TRIM(o.customer_first_name), ''),
      NULLIF(TRIM(o.customer_last_name), ''),
      o.customer_email,
      o.customer_phone,
      NULLIF(TRIM(CONCAT(
        COALESCE(l.from_street, ''), ' ',
        COALESCE(l.from_house_number, ''),
        CASE WHEN l.from_plz IS NOT NULL THEN ', ' || l.from_plz || ' ' || COALESCE(l.from_city, '') ELSE '' END
      )), ''),
      NULLIF(TRIM(CONCAT(
        COALESCE(l.to_street, ''), ' ',
        COALESCE(l.to_house_number, ''),
        CASE WHEN l.to_plz IS NOT NULL THEN ', ' || l.to_plz || ' ' || COALESCE(l.to_city, '') ELSE '' END
      )), ''),
      COALESCE(o.service_date, l.preferred_date, CURRENT_DATE + INTERVAL '7 days'),
      o.service_start_time::time,
      o.description,
      'geplant'::public.auftrag_status,
      COALESCE(o.subtotal, 0),
      COALESCE(o.vat_rate, 8.1),
      COALESCE(o.vat_amount, 0),
      COALESCE(o.total, 0),
      l.service_type,
      CASE o.price_model
        WHEN 'stundenansatz' THEN 'hourly'
        WHEN 'kostendach'    THEN 'estimate'
        ELSE 'fixed'
      END,
      o.hourly_rate,
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(oi.*) ORDER BY oi.position)
         FROM public.offer_items oi WHERE oi.offer_id = o.id),
        '[]'::jsonb
      )
    FROM public.offers o
    LEFT JOIN public.leads l ON l.id = o.lead_id
    WHERE o.access_token = offer_access_token
      AND NOT EXISTS (
        SELECT 1 FROM public.auftraege a
        WHERE a.offer_id = o.id
      );

    -- lead_distributions has no updated_at column; responded_at is the correct
    -- response-time field (consistent with 20260411000004).
    UPDATE public.lead_distributions
    SET status = 'job_confirmed', responded_at = COALESCE(responded_at, NOW())
    WHERE lead_id = v_lead_id AND company_id = v_company_id;

    UPDATE public.leads
    SET status = 'job_confirmed', updated_at = NOW()
    WHERE id = v_lead_id;
  END IF;

  RETURN true;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3. create_appointments_for_auftrag — erst lesen, dann raten
--
-- Unveraendert gegenueber 20260704151000 bis auf die Namensermittlung.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_appointments_for_auftrag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group        RECORD;
  v_group_count  integer;
  v_date         date;
  v_start        time;
  v_end          time;
  v_label        text;
  v_first        text;
  v_last         text;
  v_rest         text;
  v_appt_id      uuid;
  v_primary_appt uuid := NULL;
BEGIN
  IF NEW.offer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE offer_id = NEW.offer_id AND appointment_type = 'service'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(DISTINCT service_type) INTO v_group_count
  FROM public.offer_items
  WHERE offer_id = NEW.offer_id AND service_type IS NOT NULL;

  -- Getrennte Felder haben Vorrang. Der split_part darunter ist der Rueckfall
  -- fuer Auftraege von vor 2026-07-28 und fuer direkt per SQL geschriebene
  -- Zeilen — dort gibt es nichts Getrenntes zu lesen.
  v_first := NULLIF(TRIM(COALESCE(NEW.customer_first_name, '')), '');
  v_last  := NULLIF(TRIM(COALESCE(NEW.customer_last_name, '')), '');

  IF v_first IS NULL AND v_last IS NULL THEN
    v_rest  := split_part(COALESCE(NEW.customer_name, ''), ' ', 1);
    v_first := NULLIF(v_rest, '');
    v_last  := NULLIF(TRIM(substr(COALESCE(NEW.customer_name, ''), length(v_rest) + 1)), '');
  END IF;

  IF v_group_count >= 2 THEN
    FOR v_group IN
      SELECT service_type,
             MIN(scheduled_date)       AS d,
             MIN(scheduled_start_time) AS st,
             MIN(scheduled_end_time)   AS et
      FROM public.offer_items
      WHERE offer_id = NEW.offer_id AND service_type IS NOT NULL
      GROUP BY service_type
      ORDER BY MIN(position)
    LOOP
      v_label := CASE v_group.service_type
        WHEN 'umzug'      THEN 'Umzug'
        WHEN 'reinigung'  THEN 'Reinigung'
        WHEN 'raeumung'   THEN 'Räumung'
        WHEN 'entsorgung' THEN 'Entsorgung'
        WHEN 'lagerung'   THEN 'Lagerung'
        WHEN 'transport'  THEN 'Transport'
        ELSE initcap(v_group.service_type)
      END;
      v_date  := COALESCE(v_group.d, NEW.scheduled_date);
      v_start := COALESCE(v_group.st, NEW.scheduled_time, TIME '08:00');
      v_end   := COALESCE(v_group.et, v_start + INTERVAL '4 hours');

      INSERT INTO public.appointments (
        company_id, offer_id, lead_id, appointment_type, status,
        appointment_date, start_time, end_time, all_day,
        location_address, customer_first_name, customer_last_name,
        customer_email, customer_phone, title, description
      ) VALUES (
        NEW.company_id, NEW.offer_id, NEW.lead_id, 'service', 'pending',
        v_date, v_start, v_end, false,
        NEW.from_address, v_first, v_last,
        NEW.customer_email, NEW.customer_phone,
        v_label || ' - ' || COALESCE(NULLIF(NEW.title, ''), 'Auftrag'), NEW.description
      ) RETURNING id INTO v_appt_id;

      IF v_primary_appt IS NULL THEN
        v_primary_appt := v_appt_id;
      END IF;
    END LOOP;
  ELSE
    v_start := COALESCE(NEW.scheduled_time, TIME '08:00');
    v_end   := v_start + INTERVAL '4 hours';

    INSERT INTO public.appointments (
      company_id, offer_id, lead_id, appointment_type, status,
      appointment_date, start_time, end_time, all_day,
      location_address, customer_first_name, customer_last_name,
      customer_email, customer_phone, title, description
    ) VALUES (
      NEW.company_id, NEW.offer_id, NEW.lead_id, 'service', 'pending',
      NEW.scheduled_date, v_start, v_end, false,
      NEW.from_address, v_first, v_last,
      NEW.customer_email, NEW.customer_phone,
      COALESCE(NULLIF(NEW.title, ''), 'Auftrag'), NEW.description
    ) RETURNING id INTO v_primary_appt;
  END IF;

  IF v_primary_appt IS NOT NULL THEN
    UPDATE public.auftraege SET appointment_id = v_primary_appt WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_appointments_for_auftrag failed for auftrag %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

COMMIT;
