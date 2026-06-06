-- =============================================================================
-- Güvenlik: Müşteri Teklif Görüntüleme RPC'leri
-- Sorun: offer_items, agb_sections, checklist_templates tabloları RLS ile
--   korunuyor ve anon kullanıcılar SELECT yapamıyor. Müşteri sayfasında
--   (OfferView.tsx) bu veriler boş geliyor.
-- Çözüm: SECURITY DEFINER RPC'ler ile access_token doğrulaması yaparak
--   ilgili verileri döndür. Token geçersizse boş döndür.
-- =============================================================================

-- 1. Offer items — müşteri access_token ile erişsin
CREATE OR REPLACE FUNCTION public.get_offer_items_by_token(p_access_token text)
RETURNS TABLE (
  id            uuid,
  offer_id      uuid,
  description   text,
  quantity      numeric,
  unit          text,
  unit_price    numeric,
  total         numeric,
  price_type    text,
  position      integer,
  is_optional   boolean,
  is_highlighted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.id,
    oi.offer_id,
    oi.description,
    oi.quantity,
    oi.unit,
    oi.unit_price,
    oi.total,
    oi.price_type::text,
    oi.position,
    COALESCE(oi.is_optional, false),
    COALESCE(oi.is_highlighted, false)
  FROM public.offer_items oi
  INNER JOIN public.offers o ON o.id = oi.offer_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
  ORDER BY oi.position;
$$;

COMMENT ON FUNCTION public.get_offer_items_by_token(text) IS
  'Müşteri teklif görüntüleme için public RPC. access_token ile offer_items döndürür. '
  'Draft teklifler görüntülenemez (status filtresi).';

GRANT EXECUTE ON FUNCTION public.get_offer_items_by_token(text) TO anon, authenticated;

-- 2. AGB sections — müşteri access_token ve service_type ile erişsin
CREATE OR REPLACE FUNCTION public.get_agb_sections_by_offer_token(
  p_access_token  text,
  p_service_type  text DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  company_id    uuid,
  title         text,
  content       text,
  service_type  text,
  display_order integer,
  is_active     boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.company_id,
    a.title,
    a.content,
    a.service_type::text,
    a.display_order,
    a.is_active
  FROM public.agb_sections a
  INNER JOIN public.offers o ON o.company_id = a.company_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
    AND a.is_active = true
    AND (p_service_type IS NULL OR a.service_type = p_service_type OR a.service_type IS NULL)
  ORDER BY a.display_order;
$$;

COMMENT ON FUNCTION public.get_agb_sections_by_offer_token(text, text) IS
  'Müşteri teklif görüntüleme için public RPC. access_token ile şirkete ait AGB bölümlerini döndürür.';

GRANT EXECUTE ON FUNCTION public.get_agb_sections_by_offer_token(text, text) TO anon, authenticated;

-- 3. Checklist — müşteri access_token ile erişsin
CREATE OR REPLACE FUNCTION public.get_checklist_by_offer_token(
  p_access_token  text,
  p_service_type  text DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  title         text,
  subtitle      text,
  sections      jsonb,
  service_type  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ct.id,
    ct.title,
    ct.subtitle,
    ct.sections,
    ct.service_type::text
  FROM public.checklist_templates ct
  INNER JOIN public.offers o ON o.company_id = ct.company_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
    AND ct.is_active = true
    AND ct.include_in_offerte = true
    AND (p_service_type IS NULL OR ct.service_type = p_service_type)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_checklist_by_offer_token(text, text) IS
  'Müşteri teklif görüntüleme için public RPC. access_token ile şirkete ait checklist döndürür.';

GRANT EXECUTE ON FUNCTION public.get_checklist_by_offer_token(text, text) TO anon, authenticated;

-- 4. update_offer_by_token: accepted/rejected teklifler tekrar değiştirilemesin
-- Mevcut fonksiyon yeniden yazılıyor — status geçiş guard ekleniyor
CREATE OR REPLACE FUNCTION public.update_offer_by_token(
  offer_access_token              text,
  new_status                      text DEFAULT NULL,
  new_viewed_at                   timestamp with time zone DEFAULT NULL,
  new_accepted_at                 timestamp with time zone DEFAULT NULL,
  new_rejected_at                 timestamp with time zone DEFAULT NULL,
  new_customer_response_note      text DEFAULT NULL,
  new_agb_accepted_at             timestamp with time zone DEFAULT NULL,
  new_agb_version                 text DEFAULT NULL,
  new_agb_ip_address              text DEFAULT NULL  -- intentionally ignored
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Auftrag otomatik oluştur (kabul durumunda, idempotent)
  IF new_status = 'accepted' AND v_offer_id IS NOT NULL THEN
    INSERT INTO public.auftraege (
      offer_id, company_id, lead_id, status, created_at, updated_at
    )
    SELECT v_offer_id, v_company_id, v_lead_id, 'confirmed', NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.auftraege WHERE offer_id = v_offer_id
    );

    UPDATE public.lead_distributions
    SET status = 'job_confirmed', updated_at = NOW()
    WHERE lead_id = v_lead_id AND company_id = v_company_id;

    UPDATE public.leads
    SET status = 'job_confirmed', updated_at = NOW()
    WHERE id = v_lead_id;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.update_offer_by_token IS
  'Updates offer status/metadata via customer access token. '
  'new_status validated against allowed values (viewed/accepted/rejected). '
  'Terminal statuses (accepted/rejected) block further status changes. '
  'new_agb_ip_address is ignored — must be set by Edge Function from request headers.';
