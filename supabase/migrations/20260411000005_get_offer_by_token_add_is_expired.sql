-- =============================================================================
-- D14: get_offer_by_token — valid_until server-side kontrol
-- is_expired boolean alanı eklendi (server taraflı hesaplama)
-- Frontend artık valid_until'i client-side date ile karşılaştırmak yerine
-- is_expired alanını kullanabilir.
-- =============================================================================

-- Return type değiştiği için DROP zorunlu
DROP FUNCTION IF EXISTS public.get_offer_by_token(text);

CREATE FUNCTION public.get_offer_by_token(offer_access_token text)
RETURNS TABLE (
  id                  uuid,
  title               character varying,
  description         text,
  customer_first_name character varying,
  customer_last_name  character varying,
  customer_email      character varying,
  customer_phone      character varying,
  service_date        date,
  valid_until         date,
  subtotal            numeric,
  vat_rate            numeric,
  vat_amount          numeric,
  total               numeric,
  status              character varying,
  created_at          timestamp with time zone,
  sent_at             timestamp with time zone,
  viewed_at           timestamp with time zone,
  accepted_at         timestamp with time zone,
  rejected_at         timestamp with time zone,
  company_id          uuid,
  lead_id             uuid,
  agb_accepted_at     timestamp with time zone,
  service_type        character varying,
  is_expired          boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.title,
    o.description,
    o.customer_first_name,
    o.customer_last_name,
    o.customer_email,
    o.customer_phone,
    o.service_date,
    o.valid_until,
    o.subtotal,
    o.vat_rate,
    o.vat_amount,
    o.total,
    o.status,
    o.created_at,
    o.sent_at,
    o.viewed_at,
    o.accepted_at,
    o.rejected_at,
    o.company_id,
    o.lead_id,
    o.agb_accepted_at,
    l.service_type,
    -- D14: valid_until geçtiyse is_expired = true
    CASE
      WHEN o.valid_until IS NOT NULL AND o.valid_until < CURRENT_DATE THEN true
      ELSE false
    END AS is_expired
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.access_token = offer_access_token;
$$;

COMMENT ON FUNCTION public.get_offer_by_token(text) IS
  'Müşteri teklif görüntüleme için public RPC. '
  'is_expired: valid_until < CURRENT_DATE ise true — frontend bu alanı kullanmalı.';
