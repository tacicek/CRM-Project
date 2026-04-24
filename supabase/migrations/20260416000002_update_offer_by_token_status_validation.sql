-- Security fix: validate new_status against allowed enum values in update_offer_by_token.
-- Without this, any caller with a valid access_token could set status to arbitrary values.

CREATE OR REPLACE FUNCTION public.update_offer_by_token(
  offer_access_token text,
  new_status text DEFAULT NULL,
  new_viewed_at timestamp with time zone DEFAULT NULL,
  new_accepted_at timestamp with time zone DEFAULT NULL,
  new_rejected_at timestamp with time zone DEFAULT NULL,
  new_customer_response_note text DEFAULT NULL,
  new_agb_accepted_at timestamp with time zone DEFAULT NULL,
  new_agb_version text DEFAULT NULL,
  -- SECURITY: new_agb_ip_address is IGNORED — IP is extracted server-side from
  -- request headers by Edge Functions and stored separately. Keeping the parameter
  -- for backwards compatibility with existing callers but it is never written.
  new_agb_ip_address text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows         integer;
  v_service_date        date;
  v_valid_until         date;
  v_acceptance_deadline date;
  v_offer_id            uuid;
  v_company_id          uuid;
  v_lead_id             uuid;
  -- Whitelist of statuses a customer can set via access_token
  ALLOWED_STATUSES      text[] := ARRAY['viewed', 'accepted', 'rejected'];
BEGIN
  -- Validate new_status against whitelist before doing anything else
  IF new_status IS NOT NULL AND NOT (new_status = ANY(ALLOWED_STATUSES)) THEN
    RAISE EXCEPTION 'Invalid status value: %', new_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Offer bilgilerini oku
  SELECT service_date, valid_until, id, company_id, lead_id
  INTO v_service_date, v_valid_until, v_offer_id, v_company_id, v_lead_id
  FROM public.offers
  WHERE access_token = offer_access_token;

  -- Token bulunamadıysa false döndür
  IF NOT FOUND THEN
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
    -- agb_ip_address intentionally NOT updated from caller-supplied value (spoofable)
  WHERE access_token = offer_access_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RETURN false;
  END IF;

  -- E15/E17: Auftrag otomatik oluştur (kabul durumunda)
  IF new_status = 'accepted' AND v_offer_id IS NOT NULL THEN
    -- Auftrag yoksa oluştur (idempotent)
    INSERT INTO public.auftraege (
      offer_id, company_id, lead_id, status, created_at, updated_at
    )
    SELECT v_offer_id, v_company_id, v_lead_id, 'confirmed', NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.auftraege WHERE offer_id = v_offer_id
    );

    -- lead_distributions durumunu güncelle
    UPDATE public.lead_distributions
    SET status = 'job_confirmed', updated_at = NOW()
    WHERE lead_id = v_lead_id AND company_id = v_company_id;

    -- leads durumunu güncelle
    UPDATE public.leads
    SET status = 'job_confirmed', updated_at = NOW()
    WHERE id = v_lead_id;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.update_offer_by_token IS
  'Updates offer status/metadata via customer access token. '
  'new_status is validated against allowed values (viewed/accepted/rejected). '
  'new_agb_ip_address should be provided by an Edge Function from request headers, not from client body.';
