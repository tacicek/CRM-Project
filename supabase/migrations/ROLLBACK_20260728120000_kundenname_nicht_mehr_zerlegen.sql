-- =============================================================================
-- ROLLBACK für 20260728120000_kundenname_nicht_mehr_zerlegen.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach wird der Kundenname bei jedem angenommenen Angebot wieder zu EINEM
--    Feld zusammengeklebt und beim Anlegen des Termins am ersten Leerzeichen
--    geraten. "Anna Maria von Gunten" wird dann wieder zu
--    Vorname "Anna" / Nachname "Maria von Gunten".
--
--    Die beiden Spalten auf `auftraege` bleiben absichtlich STEHEN: sie enthalten
--    für alle nach dem 2026-07-28 angenommenen Angebote die einzige korrekte
--    Trennung. Sie zu löschen wäre der eigentliche Datenverlust.
--
--    Die beiden Funktionsrümpfe unten sind der Stand aus 20260705100000 bzw.
--    20260704151000, wörtlich aus der Produktion ausgelesen.
-- =============================================================================

BEGIN;

-- Stand vor 20260728120000 (20260705100000)
CREATE OR REPLACE FUNCTION public.update_offer_by_token(offer_access_token text, new_status text DEFAULT NULL::text, new_viewed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_accepted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_rejected_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_customer_response_note text DEFAULT NULL::text, new_agb_accepted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_agb_version text DEFAULT NULL::text, new_agb_ip_address text DEFAULT NULL::text)
 RETURNS boolean
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
  -- Validate new_status against whitelist
  IF new_status IS NOT NULL AND NOT (new_status = ANY(ALLOWED_STATUSES)) THEN
    RAISE EXCEPTION 'Invalid status value: %', new_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Offer bilgilerini oku
  SELECT status, service_date, valid_until, id, company_id, lead_id
  INTO v_status, v_service_date, v_valid_until, v_offer_id, v_company_id, v_lead_id
  FROM public.offers
  WHERE access_token = offer_access_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Terminal statüdeki teklifler üzerinde status değişikliği yapılamaz
  -- (kabul edilmiş teklif reddedilemez, reddedilmiş kabul edilemez)
  IF new_status IS NOT NULL AND v_status = ANY(TERMINAL_STATUSES) THEN
    RETURN false;
  END IF;

  -- Kabul ediliyorsa son tarih kontrolü
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

  -- Offers tablosunu güncelle
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

  -- Auftrag otomatik oluştur (kabul durumunda, idempotent).
  -- Full column set restored from 20260411000004 — the 20260606 rewrite reduced
  -- this to a minimal INSERT that omitted the NOT-NULL scheduled_date (and other
  -- useful fields), so it could never succeed.
  IF new_status = 'accepted' AND v_offer_id IS NOT NULL THEN
    INSERT INTO public.auftraege (
      company_id,
      offer_id,
      lead_id,
      auftrag_nummer,
      title,
      customer_name,
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
      TRIM(CONCAT(
        COALESCE(o.customer_first_name, ''), ' ',
        COALESCE(o.customer_last_name, '')
      )),
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
      -- C2: freeze the offer's financial snapshot onto the Auftrag (the manual
      -- AuftragModal path already did this; the accept path did not → total=0, items=[]).
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


-- Stand vor 20260728120000 (20260704151000)
CREATE OR REPLACE FUNCTION public.create_appointments_for_auftrag()
 RETURNS trigger
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

  v_first := split_part(COALESCE(NEW.customer_name, ''), ' ', 1);
  v_last  := NULLIF(TRIM(substr(COALESCE(NEW.customer_name, ''), length(v_first) + 1)), '');

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
        NEW.from_address, NULLIF(v_first, ''), v_last,
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
      NEW.from_address, NULLIF(v_first, ''), v_last,
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


-- ALTER TABLE public.auftraege DROP COLUMN customer_first_name;  -- absichtlich auskommentiert, siehe Kopf
-- ALTER TABLE public.auftraege DROP COLUMN customer_last_name;

COMMIT;
