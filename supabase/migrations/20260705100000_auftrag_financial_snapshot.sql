-- C2 (Auftrag analysis): the accept flow (update_offer_by_token) created the Auftrag
-- WITHOUT the offer's financials/items — subtotal/total defaulted to 0 and items to '[]',
-- while the manual AuftragModal path froze a full snapshot. Result: every accepted job
-- showed CHF 0 in the Auftraege list and produced empty-line Quittung/Rechnung prefills.
-- Fix: freeze subtotal/vat/total/items/service_type/pricing_type/hourly_rate on INSERT,
-- exactly like the manual path (snapshot, not a live link). Signature unchanged.

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

-- One-time backfill: accept-flow Aufträge created BEFORE this fix have empty financials.
-- Idempotent (guarded on total=0 OR items empty); safe to re-run.
UPDATE public.auftraege a SET
  subtotal     = COALESCE(o.subtotal, 0),
  vat_rate     = COALESCE(o.vat_rate, a.vat_rate, 8.1),
  vat_amount   = COALESCE(o.vat_amount, 0),
  total        = COALESCE(o.total, 0),
  service_type = COALESCE(a.service_type, l.service_type),
  pricing_type = COALESCE(NULLIF(a.pricing_type, ''), CASE o.price_model
                   WHEN 'stundenansatz' THEN 'hourly'
                   WHEN 'kostendach'    THEN 'estimate'
                   ELSE 'fixed' END),
  hourly_rate  = COALESCE(a.hourly_rate, o.hourly_rate),
  items        = COALESCE(
                   (SELECT jsonb_agg(to_jsonb(oi.*) ORDER BY oi.position)
                    FROM public.offer_items oi WHERE oi.offer_id = o.id),
                   '[]'::jsonb),
  updated_at   = now()
FROM public.offers o
LEFT JOIN public.leads l ON l.id = o.lead_id
WHERE a.offer_id = o.id
  AND a.deleted_at IS NULL
  AND (COALESCE(a.total, 0) = 0 OR jsonb_array_length(COALESCE(a.items, '[]'::jsonb)) = 0);
