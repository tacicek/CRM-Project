-- ============================================================
-- Offerte Redesign — Katman 2b: get_offer_by_token adres okuma → frozen öncelik
-- ============================================================
-- Public OfferView bu RPC'nin döndürdüğü from_*/to_* alanlarını okuyor. Şimdiye kadar bunlar
-- doğrudan leads join'inden (l.from_*) geliyordu — lead silinirse (FK SET NULL) adres boş dönerdi.
--
-- Değişiklik: her adres alanı COALESCE(o.frozen_*, l.from_*) — önce dondurulmuş teklif adresi,
--   yoksa lead'e düş (geriye dönük güvenli fallback). LEFT JOIN leads KALIR (fallback için).
--   İmza (RETURNS TABLE) DEĞİŞMEZ — sadece SELECT ifadeleri COALESCE'lendi. varchar dönüş tipini
--   korumak için text frozen kolonları ::character varying cast'lenir.
--
-- Davranış: 16/16 teklifte frozen === lead (backfill sonrası mismatch=0), bu yüzden ŞU AN çıktı
--   birebir aynı. Değişiklik yalnızca gelecekte silinen lead'lere karşı koruma sağlar.
--
-- ⚠ Fiyatlandırma/total/offer_items'a dokunulmaz — bu yalnızca adres okuma önceliği.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_offer_by_token(offer_access_token text)
RETURNS TABLE(
  id uuid, title character varying, description text,
  customer_first_name character varying, customer_last_name character varying,
  customer_email character varying, customer_phone character varying,
  service_date date, valid_until date, subtotal numeric, vat_rate numeric,
  vat_amount numeric, total numeric, status character varying,
  created_at timestamp with time zone, sent_at timestamp with time zone,
  viewed_at timestamp with time zone, accepted_at timestamp with time zone,
  rejected_at timestamp with time zone, company_id uuid, lead_id uuid,
  agb_accepted_at timestamp with time zone, service_type character varying,
  is_expired boolean,
  from_street character varying, from_house_number character varying,
  from_plz character varying, from_city character varying,
  from_floor integer, from_has_lift boolean,
  to_street character varying, to_house_number character varying,
  to_plz character varying, to_city character varying,
  to_floor integer, to_has_lift boolean,
  surcharges jsonb, price_model text, hourly_rate numeric,
  kostendach_max numeric, offerte_type text
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
    o.offerte_type
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.access_token = offer_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected');
$function$;
