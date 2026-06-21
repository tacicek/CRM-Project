-- ============================================================
-- get_offer_by_token: draft (ve diğer non-public) offer'ları gizle. (spec §2.1)
-- Önceki davranış: WHERE access_token = ... → herhangi statü (draft dahil) dönüyordu
-- → geçerli token'la yayınlanmamış offer (fiyat) public'te okunabiliyordu (güvenlik açığı).
-- Düzeltme: yalnız sent/viewed/accepted/rejected döner.
-- Tek tüketici OfferView (public); firma draft'ı doğrudan tablodan (id, RLS) okur → kırılmaz.
-- RETURNS TABLE değişmiyor → CREATE OR REPLACE (grant'ler korunur, DROP gerekmez).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_offer_by_token(offer_access_token text)
 RETURNS TABLE(
   id uuid, title character varying, description text,
   customer_first_name character varying, customer_last_name character varying,
   customer_email character varying, customer_phone character varying,
   service_date date, valid_until date,
   subtotal numeric, vat_rate numeric, vat_amount numeric, total numeric,
   status character varying, created_at timestamp with time zone,
   sent_at timestamp with time zone, viewed_at timestamp with time zone,
   accepted_at timestamp with time zone, rejected_at timestamp with time zone,
   company_id uuid, lead_id uuid, agb_accepted_at timestamp with time zone,
   service_type character varying, is_expired boolean,
   from_street character varying, from_house_number character varying,
   from_plz character varying, from_city character varying,
   from_floor integer, from_has_lift boolean,
   to_street character varying, to_house_number character varying,
   to_plz character varying, to_city character varying,
   to_floor integer, to_has_lift boolean,
   surcharges jsonb
 )
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
    l.from_street,
    l.from_house_number,
    l.from_plz,
    l.from_city,
    l.from_floor,
    l.from_has_lift,
    l.to_street,
    l.to_house_number,
    l.to_plz,
    l.to_city,
    l.to_floor,
    l.to_has_lift,
    o.surcharges
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.access_token = offer_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected');
$function$;
