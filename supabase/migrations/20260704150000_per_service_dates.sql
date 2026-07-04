-- Per-service dates on multi-service offers (feature spec 2026-07-04).
-- Dates live on the line items (offer_items), NOT in a separate table: every consumer
-- (create/edit/PDF/detail/public view) already reads this table, and items already
-- carry service_type. Invariant: ALL items of one service_type group carry the SAME
-- scheduled_* values (the UI collects one date per group and copies it to each item).
-- Fallback: scheduled_date NULL -> renderers/calendar fall back to offers.service_date,
-- so legacy offers keep their exact behavior (no backfill needed).

ALTER TABLE public.offer_items
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_start_time time,
  ADD COLUMN IF NOT EXISTS scheduled_end_time time;

-- ── replace_offer_items: edit flow does delete+insert through this RPC — without the
--    new columns every edit would silently reset the dates to NULL (known trap; the
--    same thing happened with service_type before). Signature unchanged → OR REPLACE.
CREATE OR REPLACE FUNCTION public.replace_offer_items(p_offer_id uuid, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.offers o
    JOIN public.companies c ON c.id = o.company_id
    WHERE o.id = p_offer_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Offerte'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.offers
    WHERE id = p_offer_id AND status IN ('accepted', 'rejected')
  ) THEN
    RAISE EXCEPTION 'Offerte ist bereits abgeschlossen und kann nicht bearbeitet werden'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  DELETE FROM public.offer_items WHERE offer_id = p_offer_id;

  INSERT INTO public.offer_items (
    offer_id,
    position,
    description,
    quantity,
    unit,
    unit_price,
    price_type,
    is_highlighted,
    is_optional,
    time_estimate,
    service_type,
    scheduled_date,
    scheduled_start_time,
    scheduled_end_time
  )
  SELECT
    p_offer_id,
    (item ->> 'position')::integer,
    item ->> 'description',
    COALESCE((item ->> 'quantity')::numeric, 1),
    item ->> 'unit',
    COALESCE((item ->> 'unit_price')::numeric, 0),
    item ->> 'price_type',
    COALESCE((item ->> 'is_highlighted')::boolean, false),
    COALESCE((item ->> 'is_optional')::boolean, false),
    CASE
      WHEN item -> 'time_estimate' IS NOT NULL AND item ->> 'time_estimate' != 'null'
      THEN (item -> 'time_estimate')::jsonb
      ELSE NULL
    END,
    item ->> 'service_type',
    (item ->> 'scheduled_date')::date,
    (item ->> 'scheduled_start_time')::time,
    (item ->> 'scheduled_end_time')::time
  FROM jsonb_array_elements(p_items) AS item;

END;
$function$;

-- ── get_offer_items_by_token: explicit RETURNS TABLE → new columns appended at the
--    END (positional stability). Return type changes ⇒ DROP + CREATE (OR REPLACE is
--    not allowed) + explicit GRANT restore, same discipline as get_offer_by_token.
DROP FUNCTION IF EXISTS public.get_offer_items_by_token(text);

CREATE FUNCTION public.get_offer_items_by_token(p_access_token text)
 RETURNS TABLE(id uuid, offer_id uuid, description text, quantity numeric, unit text, unit_price numeric, total numeric, price_type text, "position" integer, is_optional boolean, is_highlighted boolean, time_estimate jsonb, service_type text, scheduled_date date, scheduled_start_time time, scheduled_end_time time)
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
    oi.service_type,
    oi.scheduled_date,
    oi.scheduled_start_time,
    oi.scheduled_end_time
  FROM public.offer_items oi
  INNER JOIN public.offers o ON o.id = oi.offer_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
  ORDER BY oi.position;
$function$;

GRANT EXECUTE ON FUNCTION public.get_offer_items_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_offer_items_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_offer_items_by_token(text) TO service_role;
