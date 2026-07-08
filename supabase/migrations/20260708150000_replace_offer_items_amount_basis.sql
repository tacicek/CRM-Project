-- ============================================================
-- replace_offer_items: amount_basis + kostendach_max persistieren (Phase 3d)
-- ============================================================
-- Der Save-Pfad (Erstellen + Bearbeiten) schreibt Positionen ueber diese RPC. Die item-level
-- Betrags-Achse + das Item-Kostendach werden dem Haupt-INSERT in offer_items hinzugefuegt.
--
-- Rueckgabe bleibt void → CREATE OR REPLACE (KEIN DROP): Signatur + Grants bleiben erhalten
-- (ACL: PUBLIC/postgres/authenticated/service_role, kein anon — Editieren ist authenticated-only).
-- amount_basis faellt bei fehlendem/leerem JSON-Wert auf 'fixed' zurueck (rueckwaertskompatibel).
-- Bereits abgeschlossene Offerten (accepted/rejected) sind durch die Guard-Klausel nicht editierbar.
-- ============================================================

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
    scheduled_end_time,
    amount_basis,
    kostendach_max
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
    (item ->> 'scheduled_end_time')::time,
    COALESCE(NULLIF(item ->> 'amount_basis', ''), 'fixed'),
    (item ->> 'kostendach_max')::numeric
  FROM jsonb_array_elements(p_items) AS item;

  INSERT INTO public.offer_item_effort_meta (
    offer_item_id, crew, vehicles, vehicle_type, hourly_rate, aufwand_min_h, aufwand_max_h
  )
  SELECT
    oi.id,
    (m ->> 'crew')::integer,
    (m ->> 'vehicles')::integer,
    NULLIF(m ->> 'vehicle_type', ''),
    (m ->> 'hourly_rate')::numeric,
    (m ->> 'aufwand_min_h')::numeric,
    (m ->> 'aufwand_max_h')::numeric
  FROM jsonb_array_elements(p_items) AS item
  JOIN public.offer_items oi
    ON oi.offer_id = p_offer_id AND oi.position = (item ->> 'position')::integer
  CROSS JOIN LATERAL (SELECT item -> 'effort_meta' AS m) x
  WHERE jsonb_typeof(item -> 'effort_meta') = 'object';

  INSERT INTO public.offer_item_volume_meta (
    offer_item_id, volume_m3, volume_min_m3, volume_max_m3, rate, rate_unit, location
  )
  SELECT
    oi.id,
    (m ->> 'volume_m3')::numeric,
    (m ->> 'volume_min_m3')::numeric,
    (m ->> 'volume_max_m3')::numeric,
    (m ->> 'rate')::numeric,
    NULLIF(m ->> 'rate_unit', ''),
    NULLIF(m ->> 'location', '')
  FROM jsonb_array_elements(p_items) AS item
  JOIN public.offer_items oi
    ON oi.offer_id = p_offer_id AND oi.position = (item ->> 'position')::integer
  CROSS JOIN LATERAL (SELECT item -> 'volume_meta' AS m) x
  WHERE jsonb_typeof(item -> 'volume_meta') = 'object';

  INSERT INTO public.offer_item_area_meta (
    offer_item_id, object_type, area_m2, abgabe, abnahmegarantie
  )
  SELECT
    oi.id,
    NULLIF(m ->> 'object_type', ''),
    (m ->> 'area_m2')::numeric,
    NULLIF(m ->> 'abgabe', ''),
    (m ->> 'abnahmegarantie')::boolean
  FROM jsonb_array_elements(p_items) AS item
  JOIN public.offer_items oi
    ON oi.offer_id = p_offer_id AND oi.position = (item ->> 'position')::integer
  CROSS JOIN LATERAL (SELECT item -> 'area_meta' AS m) x
  WHERE jsonb_typeof(item -> 'area_meta') = 'object';

END;
$function$;
