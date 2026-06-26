-- ============================================================
-- get_offer_by_token + get_offer_items_by_token: pricing/blind alanlarını ekle.
-- (3a — public OfferView müşteri yüzeyi)
--
-- Sorun: İki public token-RPC'si offer.price_model / hourly_rate / kostendach_max /
-- offerte_type ve offer_items.time_estimate alanlarını DÖNDÜRMÜYOR. Bu yüzden:
--   · OfferView'deki stundenansatz/kostendach kutuları ölü kod (alan hep undefined),
--   · blind teklifte tahmini saat-aralığı + "Hinweis" müşteriye HİÇ gösterilmiyor
--     → müşteri sabit fiyat sanıp onaylıyor (risk).
-- PDF (ServiceTable + BlindOfferteDisclaimer) bu alanları zaten gösteriyor; veri
-- akışını public yüzeye de açıyoruz.
--
-- RETURNS TABLE imzası değişiyor → CREATE OR REPLACE yetmez, DROP + CREATE gerekir.
-- Mevcut kolonlar/sıra/where filtresi/SECURITY DEFINER/search_path AYNEN korunur;
-- yeni kolonlar listenin SONUNA eklenir. Grant'lar yeniden verilir.
-- Gerçek tipler (information_schema): price_model/offerte_type=text,
-- hourly_rate/kostendach_max=numeric, time_estimate=jsonb.
-- ============================================================

-- ---------- get_offer_by_token ----------
DROP FUNCTION IF EXISTS public.get_offer_by_token(text);

CREATE FUNCTION public.get_offer_by_token(offer_access_token text)
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
   surcharges jsonb,
   -- YENİ (sona eklendi):
   price_model text, hourly_rate numeric, kostendach_max numeric, offerte_type text
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
    o.surcharges,
    -- YENİ (sona eklendi):
    o.price_model,
    o.hourly_rate,
    o.kostendach_max,
    o.offerte_type
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.access_token = offer_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected');
$function$;

GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO anon, authenticated;

-- ---------- get_offer_items_by_token ----------
DROP FUNCTION IF EXISTS public.get_offer_items_by_token(text);

CREATE FUNCTION public.get_offer_items_by_token(p_access_token text)
 RETURNS TABLE(
   id uuid, offer_id uuid, description text, quantity numeric,
   unit text, unit_price numeric, total numeric, price_type text,
   "position" integer, is_optional boolean, is_highlighted boolean,
   -- YENİ (sona eklendi):
   time_estimate jsonb
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    oi.id,
    oi.offer_id,
    oi.description,
    oi.quantity,
    oi.unit,
    oi.unit_price,
    oi.total,
    oi.price_type::text,
    oi."position",
    COALESCE(oi.is_optional, false),
    COALESCE(oi.is_highlighted, false),
    -- YENİ (sona eklendi):
    oi.time_estimate
  FROM public.offer_items oi
  INNER JOIN public.offers o ON o.id = oi.offer_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
  ORDER BY oi.position;
$function$;

GRANT EXECUTE ON FUNCTION public.get_offer_items_by_token(text) TO anon, authenticated;
