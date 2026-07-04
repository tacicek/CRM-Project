-- Estrich/Keller data chain (Auszug side), approved 2026-07-04:
--  1. leads gains from_has_estrich / from_has_keller (collected via ManualImport UI;
--     external channels (n8n/VAPI/submit_lead_json) simply leave them NULL).
--  2. offers.frozen_has_estrich / frozen_has_keller (existing fork-remnant columns)
--     are revived: the create flow freezes the lead values into them.
--  3. get_offer_by_token returns both (frozen first, lead fallback) — columns appended
--     at the END (positional stability), same DROP+CREATE + explicit-GRANT discipline
--     as 20260704090000 (RETURNS TABLE change forbids CREATE OR REPLACE).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS from_has_estrich boolean,
  ADD COLUMN IF NOT EXISTS from_has_keller boolean;

DROP FUNCTION IF EXISTS public.get_offer_by_token(text);

CREATE FUNCTION public.get_offer_by_token(offer_access_token text)
 RETURNS TABLE(id uuid, title character varying, description text, customer_first_name character varying, customer_last_name character varying, customer_email character varying, customer_phone character varying, service_date date, valid_until date, subtotal numeric, vat_rate numeric, vat_amount numeric, total numeric, status character varying, created_at timestamp with time zone, sent_at timestamp with time zone, viewed_at timestamp with time zone, accepted_at timestamp with time zone, rejected_at timestamp with time zone, company_id uuid, lead_id uuid, agb_accepted_at timestamp with time zone, service_type character varying, is_expired boolean, from_street character varying, from_house_number character varying, from_plz character varying, from_city character varying, from_floor integer, from_has_lift boolean, to_street character varying, to_house_number character varying, to_plz character varying, to_city character varying, to_floor integer, to_has_lift boolean, surcharges jsonb, price_model text, hourly_rate numeric, kostendach_max numeric, offerte_type text, discount_percent numeric, from_has_estrich boolean, from_has_keller boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    CASE
      WHEN o.valid_until IS NOT NULL AND o.valid_until < CURRENT_DATE THEN true
      ELSE false
    END AS is_expired,
    -- Frozen öncelik, lead fallback (LEFT JOIN leads korunur)
    COALESCE(o.frozen_from_street, l.from_street)::character varying           AS from_street,
    COALESCE(o.frozen_from_house_number, l.from_house_number)::character varying AS from_house_number,
    COALESCE(o.frozen_from_plz, l.from_plz)::character varying                 AS from_plz,
    COALESCE(o.frozen_from_city, l.from_city)::character varying               AS from_city,
    COALESCE(o.frozen_from_floor, l.from_floor)                               AS from_floor,
    COALESCE(o.frozen_from_has_lift, l.from_has_lift)                         AS from_has_lift,
    COALESCE(o.frozen_to_street, l.to_street)::character varying              AS to_street,
    COALESCE(o.frozen_to_house_number, l.to_house_number)::character varying  AS to_house_number,
    COALESCE(o.frozen_to_plz, l.to_plz)::character varying                    AS to_plz,
    COALESCE(o.frozen_to_city, l.to_city)::character varying                  AS to_city,
    COALESCE(o.frozen_to_floor, l.to_floor)                                   AS to_floor,
    COALESCE(o.frozen_to_has_lift, l.to_has_lift)                             AS to_has_lift,
    o.surcharges,
    o.price_model,
    o.hourly_rate,
    o.kostendach_max,
    o.offerte_type,
    o.discount_percent,
    COALESCE(o.frozen_has_estrich, l.from_has_estrich) AS from_has_estrich,
    COALESCE(o.frozen_has_keller, l.from_has_keller)   AS from_has_keller
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.access_token = offer_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected');
$function$;

GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO service_role;
