-- Migration: submit_lead_json with token_cost calculated at creation
-- Uses exact column list from the working 20260323100000 migration, adding token_cost.

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_lead_json(lead_data JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_lead_id UUID;
  v_service_type TEXT;
  v_base_cost NUMERIC;
  v_rooms NUMERIC;
  v_m2 INTEGER;
  v_max_companies INTEGER;
  v_size_mult NUMERIC := 1.0;
  v_offerten_mult NUMERIC := 1.0;
  v_min_tokens NUMERIC := 10;
  v_max_tokens NUMERIC := 200;
  v_size_multipliers JSONB;
  v_offerten_multipliers JSONB;
  v_token_cost NUMERIC;
  v_effective_rooms NUMERIC;
  v_rec RECORD;
BEGIN
  v_service_type := lead_data->>'service_type';
  v_rooms        := NULLIF(lead_data->>'from_rooms', '')::NUMERIC;
  v_m2           := NULLIF(lead_data->>'from_living_space_m2', '')::INTEGER;
  v_max_companies := COALESCE(NULLIF(lead_data->>'max_companies', '')::INTEGER, 5);

  -- 1. base_token_cost from service_catalog (exact, then prefix fallback)
  SELECT base_token_cost INTO v_base_cost
  FROM public.service_catalog
  WHERE service_type = v_service_type AND is_active = true
  LIMIT 1;

  IF v_base_cost IS NULL THEN
    SELECT base_token_cost INTO v_base_cost
    FROM public.service_catalog
    WHERE service_type LIKE (split_part(v_service_type, '_', 1) || '%') AND is_active = true
    ORDER BY sort_order ASC LIMIT 1;
  END IF;

  v_base_cost := COALESCE(v_base_cost, 15);

  -- 2. pricing_settings
  SELECT
    COALESCE(size_multipliers,      '{"1-2":1.0,"3":1.2,"4-5":1.4,"6+":1.6}'::JSONB),
    COALESCE(offerten_multipliers,  '{"3":1.3,"4":1.15,"5":1.0}'::JSONB),
    COALESCE(min_lead_price_tokens, 10),
    COALESCE(max_lead_price_tokens, 200)
  INTO v_size_multipliers, v_offerten_multipliers, v_min_tokens, v_max_tokens
  FROM public.pricing_settings LIMIT 1;

  v_size_multipliers     := COALESCE(v_size_multipliers,     '{"1-2":1.0,"3":1.2,"4-5":1.4,"6+":1.6}'::JSONB);
  v_offerten_multipliers := COALESCE(v_offerten_multipliers, '{"3":1.3,"4":1.15,"5":1.0}'::JSONB);

  -- 3. effective rooms (fallback from m²)
  v_effective_rooms := v_rooms;
  IF v_effective_rooms IS NULL AND v_m2 IS NOT NULL THEN
    v_effective_rooms := CASE
      WHEN v_m2 >= 150 THEN 6
      WHEN v_m2 >= 100 THEN 4
      WHEN v_m2 >= 60  THEN 3
      ELSE 2
    END;
  END IF;

  -- 4. size multiplier
  IF v_effective_rooms IS NOT NULL AND v_effective_rooms > 0 THEN
    FOR v_rec IN SELECT key, value::NUMERIC AS mult FROM jsonb_each_text(v_size_multipliers) LOOP
      IF v_rec.key LIKE '%+' THEN
        IF v_effective_rooms >= replace(v_rec.key, '+', '')::NUMERIC THEN
          v_size_mult := v_rec.mult;
        END IF;
      ELSIF v_rec.key LIKE '%-%' THEN
        IF v_effective_rooms >= split_part(v_rec.key, '-', 1)::NUMERIC
           AND v_effective_rooms <= split_part(v_rec.key, '-', 2)::NUMERIC THEN
          v_size_mult := v_rec.mult;
        END IF;
      ELSE
        IF ABS(v_effective_rooms - v_rec.key::NUMERIC) < 0.5 THEN
          v_size_mult := v_rec.mult;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 5. offerten multiplier
  IF v_offerten_multipliers ? (v_max_companies::TEXT) THEN
    v_offerten_mult := (v_offerten_multipliers->>(v_max_companies::TEXT))::NUMERIC;
  END IF;

  -- 6. calculate & clamp
  v_token_cost := GREATEST(LEAST(ROUND(v_base_cost * v_size_mult * v_offerten_mult), v_max_tokens), v_min_tokens);

  -- 7. INSERT (same columns as 20260323100000, with token_cost added)
  INSERT INTO public.leads (
    service_type,
    source,
    from_plz,
    from_city,
    from_street,
    from_house_number,
    from_floor,
    from_has_lift,
    from_rooms,
    from_living_space_m2,
    to_plz,
    to_city,
    to_street,
    to_house_number,
    to_floor,
    to_has_lift,
    preferred_date,
    moving_date,
    preferred_time_slot,
    is_flexible_date,
    moving_flexibility,
    description,
    special_items,
    packing_service_needed,
    cleaning_service_needed,
    storage_needed,
    additional_services_umzug,
    piano_type,
    piano_brand,
    piano_weight_kg,
    staircase_type,
    staircase_width_cm,
    staircase_turns,
    window_access_possible,
    moebellift_floor,
    moebellift_item_description,
    moebellift_item_dimensions,
    property_type,
    bathroom_count,
    has_balcony,
    has_garage,
    has_basement,
    has_attic,
    clearing_type,
    estimated_volume,
    has_heavy_items,
    heavy_items_description,
    disposal_type,
    items_description,
    storage_duration,
    storage_volume,
    access_frequency,
    needs_climate_control,
    storage_items_description,
    pickup_street,
    pickup_house_number,
    pickup_floor,
    pickup_has_lift,
    distance_km,
    estimated_duration_minutes,
    customer_first_name,
    customer_last_name,
    customer_email,
    customer_phone,
    customer_salutation,
    customer_contact_time,
    max_companies,
    source_form_id,
    ip_address,
    status,
    form_version,
    detailed_form_data,
    token_cost
  ) VALUES (
    lead_data->>'service_type',
    COALESCE(lead_data->>'source', 'web_form'),
    lead_data->>'from_plz',
    lead_data->>'from_city',
    lead_data->>'from_street',
    lead_data->>'from_house_number',
    NULLIF(lead_data->>'from_floor', '')::INTEGER,
    (lead_data->>'from_has_lift')::BOOLEAN,
    NULLIF(lead_data->>'from_rooms', '')::NUMERIC,
    NULLIF(lead_data->>'from_living_space_m2', '')::INTEGER,
    lead_data->>'to_plz',
    lead_data->>'to_city',
    lead_data->>'to_street',
    lead_data->>'to_house_number',
    NULLIF(lead_data->>'to_floor', '')::INTEGER,
    (lead_data->>'to_has_lift')::BOOLEAN,
    NULLIF(lead_data->>'preferred_date', '')::DATE,
    NULLIF(lead_data->>'preferred_date', '')::DATE,
    lead_data->>'preferred_time_slot',
    COALESCE((lead_data->>'is_flexible_date')::BOOLEAN, false),
    lead_data->>'moving_flexibility',
    lead_data->>'description',
    CASE
      WHEN jsonb_typeof(lead_data->'special_items') = 'array'
      THEN (SELECT ARRAY_AGG(elem::text) FROM jsonb_array_elements_text(lead_data->'special_items') AS elem)
      ELSE NULL
    END,
    COALESCE((lead_data->>'packing_service_needed')::BOOLEAN, false),
    COALESCE((lead_data->>'cleaning_service_needed')::BOOLEAN, false),
    COALESCE((lead_data->>'storage_needed')::BOOLEAN, false),
    CASE
      WHEN jsonb_typeof(lead_data->'additional_services_umzug') = 'object'
      THEN lead_data->'additional_services_umzug'
      ELSE '{}'::jsonb
    END,
    lead_data->>'piano_type',
    lead_data->>'piano_brand',
    NULLIF(lead_data->>'piano_weight_kg', '')::INTEGER,
    lead_data->>'staircase_type',
    NULLIF(lead_data->>'staircase_width_cm', '')::INTEGER,
    NULLIF(lead_data->>'staircase_turns', '')::INTEGER,
    (lead_data->>'window_access_possible')::BOOLEAN,
    NULLIF(lead_data->>'moebellift_floor', '')::INTEGER,
    lead_data->>'moebellift_item_description',
    lead_data->>'moebellift_item_dimensions',
    lead_data->>'property_type',
    NULLIF(lead_data->>'bathroom_count', '')::INTEGER,
    COALESCE((lead_data->>'has_balcony')::BOOLEAN, false),
    COALESCE((lead_data->>'has_garage')::BOOLEAN, false),
    COALESCE((lead_data->>'has_basement')::BOOLEAN, false),
    COALESCE((lead_data->>'has_attic')::BOOLEAN, false),
    lead_data->>'clearing_type',
    lead_data->>'estimated_volume',
    COALESCE((lead_data->>'has_heavy_items')::BOOLEAN, false),
    lead_data->>'heavy_items_description',
    lead_data->>'disposal_type',
    lead_data->>'items_description',
    lead_data->>'storage_duration',
    lead_data->>'storage_volume',
    lead_data->>'access_frequency',
    COALESCE((lead_data->>'needs_climate_control')::BOOLEAN, false),
    lead_data->>'storage_items_description',
    lead_data->>'pickup_street',
    lead_data->>'pickup_house_number',
    NULLIF(lead_data->>'pickup_floor', '')::INTEGER,
    COALESCE((lead_data->>'pickup_has_lift')::BOOLEAN, false),
    NULLIF(lead_data->>'distance_km', '')::NUMERIC,
    NULLIF(lead_data->>'estimated_duration_minutes', '')::INTEGER,
    lead_data->>'customer_first_name',
    lead_data->>'customer_last_name',
    lead_data->>'customer_email',
    lead_data->>'customer_phone',
    lead_data->>'customer_salutation',
    lead_data->>'customer_contact_time',
    COALESCE(NULLIF(lead_data->>'max_companies', '')::INTEGER, 5),
    NULLIF(lead_data->>'source_form_id', '')::UUID,
    lead_data->>'ip_address',
    COALESCE(lead_data->>'status', 'new'),
    COALESCE(NULLIF(lead_data->>'form_version', '')::INTEGER, 1),
    lead_data->'detailed_form_data',
    v_token_cost
  )
  RETURNING id INTO new_lead_id;

  RETURN new_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_lead_json TO anon;
GRANT EXECUTE ON FUNCTION public.submit_lead_json TO authenticated;

COMMIT;
