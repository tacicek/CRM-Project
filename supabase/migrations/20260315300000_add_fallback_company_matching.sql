-- ============================================================
-- FALLBACK COMPANY MATCHING
--
-- When find_companies_in_radius returns no results (a company's
-- declared PLZ coverage doesn't include the lead's PLZ), use
-- geographic proximity to find the nearest companies anyway.
--
-- The fallback ignores the company's declared radius_km and instead
-- asks: "which companies have ANY coverage PLZ within fallback_radius_km
-- of the lead's PLZ?" This ensures leads in uncovered areas still
-- reach the geographically closest companies.
-- ============================================================

CREATE OR REPLACE FUNCTION public.find_companies_fallback(
  target_plz      VARCHAR,
  service_type_filter VARCHAR,
  fallback_radius_km  NUMERIC DEFAULT 30,
  max_results         INTEGER DEFAULT 10
)
RETURNS TABLE (
  company_id        UUID,
  company_name      VARCHAR,
  email             VARCHAR,
  notification_email VARCHAR,
  distance_km       DECIMAL,
  coverage_plz      VARCHAR,
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
  WITH company_distances AS (
    -- For each company, find the closest coverage PLZ to the lead PLZ
    SELECT
      c.id                        AS cmp_id,
      c.company_name              AS cmp_name,
      c.email                     AS cmp_email,
      c.notification_email        AS cmp_notification_email,
      cpc.plz                     AS cov_plz,
      cpc.radius_km               AS cov_radius_km,
      public.calculate_distance_km(
        target_coords.latitude,
        target_coords.longitude,
        sp.latitude,
        sp.longitude
      )                           AS dist_km
    FROM public.companies c
    INNER JOIN public.company_services cs  ON cs.company_id  = c.id
    INNER JOIN public.company_plz_coverage cpc ON cpc.company_id = c.id
    INNER JOIN public.swiss_plz sp         ON sp.plz = cpc.plz
    WHERE c.is_active  = true
      AND c.is_verified = true
      AND cs.is_active  = true
      AND cpc.is_active = true
      AND sp.latitude IS NOT NULL
      -- Same service type matching logic as find_companies_in_radius
      AND (
        cs.service_type = service_type_filter
        OR CASE service_type_filter
          WHEN 'umzug' THEN
            cs.service_type IN ('umzug_privat','umzug_firma','umzug_buero','umzug_international',
                                'privatumzug','firmenumzug','bueroumzug','seniorenumzug','studentenumzug')
          WHEN 'reinigung' THEN
            cs.service_type IN ('reinigung_end','reinigung_grund','reinigung_fenster','reinigung_bau',
                                'endreinigung','grundreinigung','unterhaltsreinigung','uebergabereinigung',
                                'baureinigung','buroreinigung','fensterreinigung')
          WHEN 'raeumung' THEN
            cs.service_type IN ('raeumung_wohnung','raeumung_haus','raeumung_keller','raeumung_dachboden',
                                'raeumung_estrich','raeumung_buero','kellerraeumung','wohnungsraeumung',
                                'hausraeumung','estrichraeumung','nachlassraeumung','messieraeumung')
          WHEN 'moebeltransport' THEN
            cs.service_type IN ('transport_moebel','usm_transport','wasserbett_transport',
                                'einzeltransport','schwertransport','kunsttransport')
          WHEN 'malerarbeiten' THEN
            cs.service_type IN ('malerarbeit','malerarbeiten','maler','anstrich','tapezieren')
          WHEN 'klaviertransport' THEN
            cs.service_type IN ('klaviertransport_transport','klaviertransport_storage',
                                'klaviertransport_disposal','klaviertransport_internal_move',
                                'klaviertransport_tuning','fluegeltransport','piano_transport')
          WHEN 'moebellift' THEN
            cs.service_type IN ('moebellift_mieten','moebellift_service','moebellift_miete',
                                'aussenlift','moebelaufzug')
          WHEN 'entsorgung' THEN
            cs.service_type IN ('entsorgung_moebel','entsorgung_elektro','entsorgung_sperrgut',
                                'entsorgung_bauschutt','moebelentsorgung','sperrmuell','elektroentsorgung')
          WHEN 'lagerung' THEN
            cs.service_type IN ('lagerung_kurz','lagerung_lang','lagerung_einlagerung',
                                'lagerung_zwischenlagerung','lagerung_selfstorage',
                                'einlagerung','zwischenlagerung','moebeleinlagerung','selfstorage')
          WHEN 'renovation' THEN
            cs.service_type IN ('renovierung','sanierung')
          ELSE FALSE
        END
      )
  ),
  best_per_company AS (
    -- Pick the closest coverage PLZ per company
    SELECT DISTINCT ON (cmp_id)
      cmp_id, cmp_name, cmp_email, cmp_notification_email,
      cov_plz, cov_radius_km, dist_km
    FROM company_distances
    WHERE dist_km <= fallback_radius_km
    ORDER BY cmp_id, dist_km ASC
  )
  SELECT
    b.cmp_id            AS company_id,
    b.cmp_name          AS company_name,
    b.cmp_email         AS email,
    b.cmp_notification_email AS notification_email,
    b.dist_km           AS distance_km,
    b.cov_plz           AS coverage_plz,
    b.cov_radius_km     AS coverage_radius_km
  FROM best_per_company b
  ORDER BY b.dist_km ASC
  LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION public.find_companies_fallback IS
  'Fallback company finder: ignores declared coverage radius and finds companies
   whose nearest coverage PLZ is within fallback_radius_km of the lead PLZ.
   Called when find_companies_in_radius returns no results.';
