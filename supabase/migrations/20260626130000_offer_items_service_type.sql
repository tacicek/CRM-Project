-- ============================================================
-- offer_items.service_type — multi-service grouping anahtarı (Faz 1: schema).
--
-- Kalemleri servis bazına (umzug/reinigung/...) göre gruplamak için (referans §2/§7).
-- Bu adım SADECE şema: kolon (nullable) + public read RPC'ye ekleme. Stamping (Faz 2) ve
-- grouping render (Faz 3) ayrı.
--
-- Kolon NULLABLE, DEFAULT yok → mevcut item'lar null kalır = "Allgemein" grubu (backward compat).
-- Firma tarafı offer_items'ı select('*') ile okuyor → kolon otomatik akar, ek RPC gerekmez.
-- Public OfferView get_offer_items_by_token RPC'siyle okuyor → service_type eklenir (aşağıda).
-- ============================================================

ALTER TABLE public.offer_items ADD COLUMN service_type text;

-- ---------- get_offer_items_by_token: service_type ekle ----------
-- RETURNS TABLE imzası değişiyor → DROP + CREATE. Mevcut 12 kolon AYNEN korunur, service_type
-- sona eklenir. status whitelist + SECURITY DEFINER + search_path + ORDER BY + GRANT korunur.
DROP FUNCTION IF EXISTS public.get_offer_items_by_token(text);

CREATE FUNCTION public.get_offer_items_by_token(p_access_token text)
 RETURNS TABLE(
   id uuid, offer_id uuid, description text, quantity numeric,
   unit text, unit_price numeric, total numeric, price_type text,
   "position" integer, is_optional boolean, is_highlighted boolean, time_estimate jsonb,
   -- YENİ (sona eklendi):
   service_type text
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
    oi.time_estimate,
    -- YENİ (sona eklendi):
    oi.service_type
  FROM public.offer_items oi
  INNER JOIN public.offers o ON o.id = oi.offer_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
  ORDER BY oi.position;
$function$;

GRANT EXECUTE ON FUNCTION public.get_offer_items_by_token(text) TO anon, authenticated;
