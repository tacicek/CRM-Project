-- =============================================================================
-- E15: Müşteri teklifi kabul edince otomatik Auftrag oluştur
-- E17: lead_distributions.status + leads.status = 'job_confirmed'
-- =============================================================================

-- Önceki versiyonu DROP et (ek DECLARE değişkenleri gerekiyor)
DROP FUNCTION IF EXISTS public.update_offer_by_token(text, text, timestamptz, timestamptz, timestamptz, text, timestamptz, text, text);

CREATE FUNCTION public.update_offer_by_token(
  offer_access_token text,
  new_status text DEFAULT NULL,
  new_viewed_at timestamp with time zone DEFAULT NULL,
  new_accepted_at timestamp with time zone DEFAULT NULL,
  new_rejected_at timestamp with time zone DEFAULT NULL,
  new_customer_response_note text DEFAULT NULL,
  new_agb_accepted_at timestamp with time zone DEFAULT NULL,
  new_agb_version text DEFAULT NULL,
  new_agb_ip_address text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows      integer;
  v_service_date     date;
  v_valid_until      date;
  v_acceptance_deadline date;
  -- E15 / E17
  v_offer_id         uuid;
  v_company_id       uuid;
  v_lead_id          uuid;
BEGIN
  -- Offer bilgilerini oku
  SELECT service_date, valid_until, id, company_id, lead_id
  INTO v_service_date, v_valid_until, v_offer_id, v_company_id, v_lead_id
  FROM public.offers
  WHERE access_token = offer_access_token;

  -- Kabul ediliyorsa son tarih kontrolü (mevcut mantık)
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
    agb_version            = COALESCE(new_agb_version, agb_version),
    agb_ip_address         = COALESCE(new_agb_ip_address, agb_ip_address),
    updated_at             = now()
  WHERE access_token = offer_access_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows > 0 AND new_status = 'accepted' THEN

    -- =========================================================================
    -- Takvim randevusu oluştur (idempotent — mevcut mantık korundu)
    -- =========================================================================
    INSERT INTO public.appointments (
      company_id,
      lead_id,
      offer_id,
      appointment_type,
      status,
      appointment_date,
      start_time,
      end_time,
      duration_minutes,
      all_day,
      location_address,
      location_plz,
      location_city,
      customer_first_name,
      customer_last_name,
      customer_email,
      customer_phone,
      title,
      description,
      internal_notes,
      confirmed_by_customer
    )
    SELECT
      o.company_id,
      o.lead_id,
      o.id,
      'service'::public.appointment_type,
      'pending'::public.appointment_status,
      COALESCE(o.service_date, l.preferred_date, CURRENT_DATE),
      ts.start_time,
      ts.end_time,
      ts.duration_minutes,
      false,
      NULLIF(TRIM(CONCAT(COALESCE(l.from_street, ''), ' ', COALESCE(l.from_house_number, ''))), ''),
      l.from_plz,
      l.from_city,
      o.customer_first_name,
      o.customer_last_name,
      o.customer_email,
      o.customer_phone,
      CONCAT('Auftrag - ', COALESCE(NULLIF(o.title, ''), 'Offerte')),
      o.description,
      'Automatisch aus angenommener Offerte erstellt.',
      true
    FROM public.offers o
    LEFT JOIN public.leads l ON l.id = o.lead_id
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(
          o.service_start_time::time,
          CASE
            WHEN l.preferred_time_slot = 'morning'   THEN '08:00:00'::time
            WHEN l.preferred_time_slot = 'afternoon' THEN '13:00:00'::time
            WHEN COALESCE(l.preferred_time_slot, '') ~ '^\d{1,2}:\d{2}'
              THEN substring(l.preferred_time_slot from '(\d{1,2}:\d{2})')::time
            ELSE '09:00:00'::time
          END
        ) AS start_time
    ) start_calc
    CROSS JOIN LATERAL (
      SELECT COALESCE(o.service_end_time::time, (start_calc.start_time + interval '2 hour')::time) AS end_time
    ) end_calc
    CROSS JOIN LATERAL (
      SELECT
        start_calc.start_time AS start_time,
        end_calc.end_time     AS end_time,
        CASE
          WHEN end_calc.end_time > start_calc.start_time
            THEN GREATEST(15, (extract(epoch from (end_calc.end_time - start_calc.start_time)) / 60)::int)
          ELSE 120
        END AS duration_minutes
    ) ts
    WHERE o.access_token = offer_access_token
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.offer_id = o.id AND a.appointment_type = 'service'
      );

    -- =========================================================================
    -- E15: Otomatik Auftrag oluştur (idempotent — zaten varsa atla)
    -- =========================================================================
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
      status
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
      'geplant'::public.auftrag_status
    FROM public.offers o
    LEFT JOIN public.leads l ON l.id = o.lead_id
    WHERE o.access_token = offer_access_token
      AND NOT EXISTS (
        SELECT 1 FROM public.auftraege a
        WHERE a.offer_id = o.id
      );

    -- =========================================================================
    -- E17: lead_distributions.status = 'job_confirmed' (sadece bu firma+lead)
    -- =========================================================================
    UPDATE public.lead_distributions
    SET
      status       = 'job_confirmed',
      responded_at = COALESCE(responded_at, NOW())
    WHERE lead_id    = v_lead_id
      AND company_id = v_company_id
      AND status     = 'accepted';

    -- =========================================================================
    -- E17: leads.status = 'job_confirmed'
    -- =========================================================================
    UPDATE public.leads
    SET
      status     = 'job_confirmed',
      updated_at = NOW()
    WHERE id = v_lead_id
      AND status NOT IN ('job_confirmed', 'completed', 'rejected');

  END IF;

  RETURN affected_rows > 0;
END;
$$;

COMMENT ON FUNCTION public.update_offer_by_token IS
  'Müşteri teklifini kabul/red/görüntüleme durumu günceller. '
  'Kabul edilince: takvim randevusu + Auftrag (idempotent) oluşturur, '
  'lead_distributions ve leads statüsünü job_confirmed yapar.';
