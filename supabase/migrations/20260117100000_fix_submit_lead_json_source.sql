-- =============================================
-- FIX: Add source column to submit_lead_json function
-- The source column has a CHECK constraint that requires valid values
-- =============================================

-- Drop and recreate the function with source column
DROP FUNCTION IF EXISTS public.submit_lead_json;

CREATE OR REPLACE FUNCTION public.submit_lead_json(lead_data JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_lead_id UUID;
BEGIN
  INSERT INTO public.leads (
    service_type,
    source,  -- Added source column
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
    preferred_time_slot,
    is_flexible_date,
    description,
    special_items,
    packing_service_needed,
    cleaning_service_needed,
    storage_needed,
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
    detailed_form_data
  ) VALUES (
    lead_data->>'service_type',
    COALESCE(lead_data->>'source', 'web_form'),  -- Default to 'web_form' if not provided
    lead_data->>'from_plz',
    lead_data->>'from_city',
    lead_data->>'from_street',
    lead_data->>'from_house_number',
    (lead_data->>'from_floor')::INTEGER,
    (lead_data->>'from_has_lift')::BOOLEAN,
    (lead_data->>'from_rooms')::NUMERIC,
    (lead_data->>'from_living_space_m2')::INTEGER,
    lead_data->>'to_plz',
    lead_data->>'to_city',
    lead_data->>'to_street',
    lead_data->>'to_house_number',
    (lead_data->>'to_floor')::INTEGER,
    (lead_data->>'to_has_lift')::BOOLEAN,
    (lead_data->>'preferred_date')::DATE,
    lead_data->>'preferred_time_slot',
    COALESCE((lead_data->>'is_flexible_date')::BOOLEAN, false),
    lead_data->>'description',
    CASE 
      WHEN lead_data->'special_items' IS NULL THEN NULL
      ELSE (SELECT ARRAY_AGG(elem::text) FROM jsonb_array_elements_text(lead_data->'special_items') AS elem)
    END,
    COALESCE((lead_data->>'packing_service_needed')::BOOLEAN, false),
    COALESCE((lead_data->>'cleaning_service_needed')::BOOLEAN, false),
    COALESCE((lead_data->>'storage_needed')::BOOLEAN, false),
    lead_data->>'piano_type',
    lead_data->>'piano_brand',
    (lead_data->>'piano_weight_kg')::INTEGER,
    lead_data->>'staircase_type',
    (lead_data->>'staircase_width_cm')::INTEGER,
    (lead_data->>'staircase_turns')::INTEGER,
    (lead_data->>'window_access_possible')::BOOLEAN,
    (lead_data->>'moebellift_floor')::INTEGER,
    lead_data->>'moebellift_item_description',
    lead_data->>'moebellift_item_dimensions',
    lead_data->>'property_type',
    (lead_data->>'bathroom_count')::INTEGER,
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
    (lead_data->>'pickup_floor')::INTEGER,
    COALESCE((lead_data->>'pickup_has_lift')::BOOLEAN, false),
    (lead_data->>'distance_km')::NUMERIC,
    (lead_data->>'estimated_duration_minutes')::INTEGER,
    lead_data->>'customer_first_name',
    lead_data->>'customer_last_name',
    lead_data->>'customer_email',
    lead_data->>'customer_phone',
    lead_data->>'customer_salutation',
    lead_data->>'customer_contact_time',
    COALESCE((lead_data->>'max_companies')::INTEGER, 5),
    (lead_data->>'source_form_id')::UUID,
    lead_data->>'ip_address',
    COALESCE(lead_data->>'status', 'new'),
    COALESCE((lead_data->>'form_version')::INTEGER, 1),
    lead_data->'detailed_form_data'
  )
  RETURNING id INTO new_lead_id;
  
  RETURN new_lead_id;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.submit_lead_json TO anon;
GRANT EXECUTE ON FUNCTION public.submit_lead_json TO authenticated;

COMMENT ON FUNCTION public.submit_lead_json IS 'Flexible lead submission function with source, form_version and detailed_form_data support. Accepts all form data as JSONB and bypasses RLS using SECURITY DEFINER.';
