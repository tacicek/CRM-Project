-- ============================================================
-- get_offer_items_by_token: amount_basis + kostendach_max an die Rueckgabe anhaengen (Phase 3c)
-- ============================================================
-- Public OfferView liest die Positionen ueber DIESE RPC (get_offer_items_by_token), NICHT ueber
-- get_offer_by_token (offer-level). Damit die item-level Betrags-Achse + das Item-Kostendach auch
-- in der oeffentlichen Ansicht ankommen, werden zwei Spalten ANS ENDE der RETURNS TABLE gehaengt.
--
-- RETURNS TABLE aendert sich → CREATE OR REPLACE unmoeglich ("cannot change return type").
-- Daher DROP + CREATE, danach GRANT-Restore (DROP entfernt die Grants). Attribute unveraendert:
-- LANGUAGE sql, STABLE, SECURITY DEFINER, SET search_path='public'. Read-only (reiner SELECT) →
-- keine Datenaenderung; frozen/gesendete Offerten NICHT betroffen (nur zusaetzliche Ausgabespalten).
-- ============================================================

DROP FUNCTION IF EXISTS public.get_offer_items_by_token(text);

CREATE FUNCTION public.get_offer_items_by_token(p_access_token text)
RETURNS TABLE(
  id uuid,
  offer_id uuid,
  description text,
  quantity numeric,
  unit text,
  unit_price numeric,
  total numeric,
  price_type text,
  "position" integer,
  is_optional boolean,
  is_highlighted boolean,
  time_estimate jsonb,
  service_type text,
  scheduled_date date,
  scheduled_start_time time without time zone,
  scheduled_end_time time without time zone,
  amount_basis text,
  kostendach_max numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
    oi.service_type,
    oi.scheduled_date,
    oi.scheduled_start_time,
    oi.scheduled_end_time,
    oi.amount_basis,
    oi.kostendach_max
  FROM public.offer_items oi
  INNER JOIN public.offers o ON o.id = oi.offer_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
  ORDER BY oi.position;
$function$;

-- GRANT-Restore — IDENTISCH zur aktuellen (Live-)Definition:
GRANT EXECUTE ON FUNCTION public.get_offer_items_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_offer_items_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_offer_items_by_token(text) TO service_role;
