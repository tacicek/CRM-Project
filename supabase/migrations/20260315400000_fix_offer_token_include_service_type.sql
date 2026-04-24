-- ============================================================
-- Fix get_offer_by_token to include lead's service_type
--
-- OfferView.tsx (public offer page) needs the service_type so it
-- can filter agb_sections correctly instead of showing ALL AGB
-- sections for the company merged together.
--
-- PostgreSQL does not allow CREATE OR REPLACE to change a function's
-- return type, so we DROP and recreate it.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_offer_by_token(text);

CREATE FUNCTION public.get_offer_by_token(offer_access_token text)
RETURNS TABLE (
  id uuid,
  title character varying,
  description text,
  customer_first_name character varying,
  customer_last_name character varying,
  customer_email character varying,
  customer_phone character varying,
  service_date date,
  valid_until date,
  subtotal numeric,
  vat_rate numeric,
  vat_amount numeric,
  total numeric,
  status character varying,
  created_at timestamp with time zone,
  sent_at timestamp with time zone,
  viewed_at timestamp with time zone,
  accepted_at timestamp with time zone,
  rejected_at timestamp with time zone,
  company_id uuid,
  lead_id uuid,
  agb_accepted_at timestamp with time zone,
  service_type character varying
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
    l.service_type
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.access_token = offer_access_token;
$$;
