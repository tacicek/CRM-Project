-- ============================================================
-- CRITICAL FIX: Company service type matching
--
-- ROOT CAUSE:
--   normalizeServiceTypeForMatching() maps granular lead types
--   to base categories (e.g. umzug_privat → umzug).
--   But company_services stores granular types from the UI
--   (e.g. umzug_privat, umzug_firma).
--   find_companies_in_radius does exact match:
--     WHERE cs.service_type = service_type_filter  ← always 'umzug'
--   This means companies with 'umzug_privat' in company_services
--   NEVER match and receive ZERO leads.
--
-- FIX:
--   Extend the WHERE condition to also match known granular
--   sub-types when given a base category filter.
--   Backward compatible: direct matches still work.
-- ============================================================

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
    SELECT 
      c.id AS cmp_id,
      c.company_name AS cmp_name,
      c.email AS cmp_email,
      c.notification_email AS cmp_notification_email,
      cpc.plz AS cov_plz,
      cpc.radius_km AS cov_radius_km,
      sp.latitude AS coverage_lat,
      sp.longitude AS coverage_lon,
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
      AND cs.is_active = true
      AND cpc.is_active = true
      -- Match either exact type OR known granular sub-types for base category filters
      AND (
        cs.service_type = service_type_filter
        OR CASE service_type_filter
          WHEN 'umzug' THEN
            cs.service_type IN (
              'umzug_privat', 'umzug_firma', 'umzug_buero', 'umzug_international',
              'privatumzug', 'firmenumzug', 'bueroumzug', 'seniorenumzug', 'studentenumzug'
            )
          WHEN 'reinigung' THEN
            cs.service_type IN (
              'reinigung_end', 'reinigung_grund', 'reinigung_fenster', 'reinigung_bau',
              'endreinigung', 'grundreinigung', 'unterhaltsreinigung', 'uebergabereinigung',
              'baureinigung', 'buroreinigung', 'fensterreinigung'
            )
          WHEN 'raeumung' THEN
            cs.service_type IN (
              'raeumung_wohnung', 'raeumung_haus', 'raeumung_keller', 'raeumung_dachboden',
              'raeumung_estrich', 'raeumung_buero',
              'kellerraeumung', 'wohnungsraeumung', 'hausraeumung', 'estrichraeumung',
              'nachlassraeumung', 'messieraeumung'
            )
          WHEN 'moebeltransport' THEN
            cs.service_type IN (
              'transport_moebel', 'usm_transport', 'wasserbett_transport',
              'einzeltransport', 'schwertransport', 'kunsttransport'
            )
          WHEN 'malerarbeiten' THEN
            cs.service_type IN ('malerarbeit', 'malerarbeiten', 'maler', 'anstrich', 'tapezieren')
          WHEN 'klaviertransport' THEN
            cs.service_type IN (
              'klaviertransport_transport', 'klaviertransport_storage',
              'klaviertransport_disposal', 'klaviertransport_internal_move',
              'klaviertransport_tuning', 'fluegeltransport', 'piano_transport'
            )
          WHEN 'moebellift' THEN
            cs.service_type IN ('moebellift_mieten', 'moebellift_service', 'moebellift_miete', 'aussenlift', 'moebelaufzug')
          WHEN 'entsorgung' THEN
            cs.service_type IN (
              'entsorgung_moebel', 'entsorgung_elektro', 'entsorgung_sperrgut', 'entsorgung_bauschutt',
              'moebelentsorgung', 'sperrmuell', 'elektroentsorgung'
            )
          WHEN 'lagerung' THEN
            cs.service_type IN (
              'lagerung_kurz', 'lagerung_lang', 'lagerung_einlagerung', 'lagerung_zwischenlagerung', 'lagerung_selfstorage',
              'einlagerung', 'zwischenlagerung', 'moebeleinlagerung', 'selfstorage'
            )
          WHEN 'renovation' THEN
            cs.service_type IN ('renovierung', 'sanierung')
          ELSE FALSE
        END
      )
  ),
  valid_coverages AS (
    SELECT * FROM all_coverages WHERE is_valid_coverage = true
  ),
  best_coverage_per_company AS (
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
