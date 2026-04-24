-- Fix search_path for calculate_distance_km function
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  earth_radius_km DECIMAL := 6371;
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);
  
  a := SIN(dlat / 2) * SIN(dlat / 2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlon / 2) * SIN(dlon / 2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  
  RETURN earth_radius_km * c;
END;
$$;

-- Fix search_path for get_plz_distance_km function
CREATE OR REPLACE FUNCTION public.get_plz_distance_km(
  plz1 VARCHAR,
  plz2 VARCHAR
)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  coords1 RECORD;
  coords2 RECORD;
BEGIN
  SELECT latitude, longitude INTO coords1
  FROM public.swiss_plz
  WHERE plz = plz1
  LIMIT 1;
  
  SELECT latitude, longitude INTO coords2
  FROM public.swiss_plz
  WHERE plz = plz2
  LIMIT 1;
  
  IF coords1 IS NULL OR coords2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN public.calculate_distance_km(
    coords1.latitude,
    coords1.longitude,
    coords2.latitude,
    coords2.longitude
  );
END;
$$;

-- Fix search_path for find_companies_in_radius function
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
  SELECT latitude, longitude INTO target_coords
  FROM public.swiss_plz
  WHERE plz = target_plz
  LIMIT 1;
  
  IF target_coords IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH company_coverages AS (
    SELECT DISTINCT ON (c.id)
      c.id,
      c.company_name,
      c.email,
      c.notification_email,
      cpc.plz AS coverage_plz,
      cpc.radius_km AS coverage_radius_km,
      sp.latitude AS coverage_lat,
      sp.longitude AS coverage_lon
    FROM public.companies c
    INNER JOIN public.company_services cs ON cs.company_id = c.id
    INNER JOIN public.company_plz_coverage cpc ON cpc.company_id = c.id
    LEFT JOIN public.swiss_plz sp ON sp.plz = cpc.plz
    WHERE c.is_active = true
      AND c.is_verified = true
      AND cs.service_type = service_type_filter
      AND cs.is_active = true
      AND cpc.is_active = true
  )
  SELECT 
    cc.id AS company_id,
    cc.company_name,
    cc.email,
    cc.notification_email,
    CASE 
      WHEN cc.coverage_plz = target_plz THEN 0::DECIMAL
      WHEN cc.coverage_lat IS NOT NULL THEN
        public.calculate_distance_km(
          target_coords.latitude,
          target_coords.longitude,
          cc.coverage_lat,
          cc.coverage_lon
        )
      ELSE NULL
    END AS distance_km,
    cc.coverage_plz,
    cc.coverage_radius_km
  FROM company_coverages cc
  WHERE 
    cc.coverage_plz = target_plz
    OR (
      cc.coverage_lat IS NOT NULL
      AND cc.coverage_radius_km > 0
      AND public.calculate_distance_km(
        target_coords.latitude,
        target_coords.longitude,
        cc.coverage_lat,
        cc.coverage_lon
      ) <= cc.coverage_radius_km
    )
  ORDER BY 
    CASE WHEN cc.coverage_plz = target_plz THEN 0 ELSE 1 END,
    distance_km NULLS LAST
  LIMIT max_results;
END;
$$;