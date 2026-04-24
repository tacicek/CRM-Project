-- Fix find_companies_in_radius function
-- Problem: DISTINCT ON (c.id) was selecting random coverage, not the best match
-- Solution: Check ALL coverages first, then select best match per company

CREATE OR REPLACE FUNCTION public.find_companies_in_radius(
  target_plz VARCHAR,
  service_type_filter VARCHAR,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  company_id UUID,
  company_name VARCHAR,
  email VARCHAR,
  notification_email VARCHAR,
  distance_km DECIMAL,
  coverage_plz VARCHAR,
  coverage_radius_km INTEGER
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  target_coords RECORD;
BEGIN
  -- Get coordinates for target PLZ
  SELECT latitude, longitude INTO target_coords
  FROM public.swiss_plz
  WHERE plz = target_plz
  LIMIT 1;
  
  IF target_coords IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH all_coverages AS (
    -- Get ALL coverage entries for matching companies (no DISTINCT ON yet)
    SELECT 
      c.id AS cmp_id,
      c.company_name AS cmp_name,
      c.email AS cmp_email,
      c.notification_email AS cmp_notification_email,
      cpc.plz AS cov_plz,
      cpc.radius_km AS cov_radius_km,
      sp.latitude AS coverage_lat,
      sp.longitude AS coverage_lon,
      -- Calculate distance from coverage PLZ to target PLZ
      CASE 
        WHEN cpc.plz = target_plz THEN 0::DECIMAL
        WHEN sp.latitude IS NOT NULL THEN
          public.calculate_distance_km(
            target_coords.latitude,
            target_coords.longitude,
            sp.latitude,
            sp.longitude
          )
        ELSE NULL
      END AS calc_distance,
      -- Is this coverage valid? (exact match OR within radius)
      CASE 
        WHEN cpc.plz = target_plz THEN true
        WHEN sp.latitude IS NOT NULL 
          AND cpc.radius_km > 0
          AND public.calculate_distance_km(
            target_coords.latitude,
            target_coords.longitude,
            sp.latitude,
            sp.longitude
          ) <= cpc.radius_km THEN true
        ELSE false
      END AS is_valid_coverage
    FROM public.companies c
    INNER JOIN public.company_services cs ON cs.company_id = c.id
    INNER JOIN public.company_plz_coverage cpc ON cpc.company_id = c.id
    LEFT JOIN public.swiss_plz sp ON sp.plz = cpc.plz
    WHERE c.is_active = true
      AND c.is_verified = true
      AND cs.service_type = service_type_filter
      AND cs.is_active = true
      AND cpc.is_active = true
  ),
  valid_coverages AS (
    -- Filter to only valid coverages
    SELECT * FROM all_coverages WHERE is_valid_coverage = true
  ),
  best_coverage_per_company AS (
    -- Select the BEST coverage for each company
    -- Priority: 1. Exact PLZ match (distance = 0), 2. Shortest distance
    SELECT DISTINCT ON (cmp_id)
      cmp_id,
      cmp_name,
      cmp_email,
      cmp_notification_email,
      cov_plz,
      cov_radius_km,
      calc_distance
    FROM valid_coverages
    ORDER BY 
      cmp_id,
      calc_distance ASC NULLS LAST
  )
  SELECT 
    bc.cmp_id AS company_id,
    bc.cmp_name AS company_name,
    bc.cmp_email AS email,
    bc.cmp_notification_email AS notification_email,
    bc.calc_distance AS distance_km,
    bc.cov_plz AS coverage_plz,
    bc.cov_radius_km AS coverage_radius_km
  FROM best_coverage_per_company bc
  ORDER BY 
    CASE WHEN bc.calc_distance = 0 THEN 0 ELSE 1 END,
    bc.calc_distance ASC NULLS LAST
  LIMIT max_results;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.find_companies_in_radius IS 
'Finds companies that can serve a given PLZ based on their coverage settings.
A company matches if:
1. They have an exact PLZ match (coverage_plz = target_plz), OR
2. They have a radius coverage where the distance from coverage_plz to target_plz is within radius_km

The function returns the best coverage entry for each company (preferring exact matches, then shortest distance).';

