-- ====================================================
-- LEAD MATCHING DEBUG SCRIPT
-- Supabase SQL Editor'da çalıştırın
-- ====================================================

-- 1. ADIM: Firmayı e-mail ile bulun
-- info@designx.ch yerine aradığınız firmayı yazın
SELECT 
  c.id,
  c.company_name,
  c.email,
  c.is_active,
  c.is_verified,
  c.token_balance,
  c.notification_email
FROM companies c
WHERE c.email ILIKE '%designx%';

-- ====================================================

-- 2. ADIM: Firmanın aktif servislerini kontrol edin
-- company_id'yi yukarıdan alın
SELECT 
  cs.id,
  cs.service_type,
  cs.is_active,
  sc.name_de
FROM company_services cs
LEFT JOIN service_catalog sc ON sc.service_type = cs.service_type
WHERE cs.company_id = 'COMPANY_ID_BURAYA'; -- Yukarıdan aldığınız ID

-- ====================================================

-- 3. ADIM: Firmanın PLZ kapsamını kontrol edin
SELECT 
  cpc.id,
  cpc.plz,
  cpc.radius_km,
  cpc.is_active,
  sp.ortschaft,
  sp.latitude,
  sp.longitude
FROM company_plz_coverage cpc
LEFT JOIN swiss_plz sp ON sp.plz = cpc.plz
WHERE cpc.company_id = 'COMPANY_ID_BURAYA'; -- Yukarıdan aldığınız ID

-- ====================================================

-- 4. ADIM: Son lead'in bilgilerini kontrol edin
SELECT 
  id,
  slug,
  service_type,
  from_plz,
  from_city,
  status,
  max_companies,
  token_cost,
  created_at
FROM leads
ORDER BY created_at DESC
LIMIT 5;

-- ====================================================

-- 5. ADIM: Lead için hangi firmalar eşleşti?
-- lead_id'yi yukarıdan alın
SELECT 
  ld.id,
  ld.lead_id,
  ld.company_id,
  ld.status,
  ld.token_cost,
  ld.sent_at,
  c.company_name,
  c.email
FROM lead_distributions ld
JOIN companies c ON c.id = ld.company_id
WHERE ld.lead_id = 'LEAD_ID_BURAYA'; -- Yukarıdan aldığınız Lead ID

-- ====================================================

-- 6. ADIM: find_companies_in_radius fonksiyonunu test edin
-- Luzern için PLZ: 6000-6020
SELECT * FROM find_companies_in_radius('6003', 'umzug', 10);

-- ====================================================

-- 7. ADIM: swiss_plz tablosunda Luzern var mı?
SELECT * FROM swiss_plz WHERE plz LIKE '60%' LIMIT 20;

-- ====================================================

-- 8. ADIM: Tüm koşulları kontrol eden kapsamlı sorgu
-- Bu sorgu, belirli bir PLZ ve service_type için neden firma eşleşmediğini gösterir
WITH target AS (
  SELECT '6003' AS plz, 'umzug' AS service_type
),
company_check AS (
  SELECT 
    c.id,
    c.company_name,
    c.email,
    c.is_active,
    c.is_verified,
    c.token_balance,
    EXISTS(
      SELECT 1 FROM company_services cs 
      WHERE cs.company_id = c.id 
      AND cs.service_type = (SELECT service_type FROM target)
      AND cs.is_active = true
    ) AS has_active_service,
    EXISTS(
      SELECT 1 FROM company_plz_coverage cpc 
      WHERE cpc.company_id = c.id 
      AND cpc.is_active = true
    ) AS has_any_plz_coverage,
    EXISTS(
      SELECT 1 FROM company_plz_coverage cpc 
      WHERE cpc.company_id = c.id 
      AND cpc.plz = (SELECT plz FROM target)
      AND cpc.is_active = true
    ) AS has_exact_plz_match,
    (SELECT string_agg(cpc.plz || ' (+' || COALESCE(cpc.radius_km::text, '0') || 'km)', ', ')
     FROM company_plz_coverage cpc 
     WHERE cpc.company_id = c.id AND cpc.is_active = true
    ) AS active_coverages
  FROM companies c
  WHERE c.email ILIKE '%designx%' -- Firmayı buradan filtreleyin
)
SELECT 
  *,
  CASE 
    WHEN NOT is_active THEN '❌ Firma nicht aktiv'
    WHEN NOT is_verified THEN '❌ Firma nicht verifiziert'
    WHEN NOT has_active_service THEN '❌ Service nicht aktiv oder nicht vorhanden'
    WHEN NOT has_any_plz_coverage THEN '❌ Keine PLZ-Abdeckung definiert'
    WHEN NOT has_exact_plz_match THEN '⚠️ Keine exakte PLZ-Übereinstimmung (Radius prüfen)'
    WHEN token_balance < 10 THEN '❌ Nicht genug Token (' || token_balance || ')'
    ELSE '✅ Sollte matchen'
  END AS diagnose
FROM company_check;

-- ====================================================

-- 9. ADIM: Mesafe hesaplamasını kontrol et
-- Firma PLZ'si ile Lead PLZ'si arasındaki mesafe
WITH company_coverage AS (
  SELECT 
    cpc.plz AS coverage_plz,
    cpc.radius_km,
    sp.latitude AS cov_lat,
    sp.longitude AS cov_lon
  FROM company_plz_coverage cpc
  JOIN swiss_plz sp ON sp.plz = cpc.plz
  WHERE cpc.company_id = 'COMPANY_ID_BURAYA'
  AND cpc.is_active = true
),
target_location AS (
  SELECT latitude, longitude FROM swiss_plz WHERE plz = '6003'
)
SELECT 
  cc.*,
  tl.*,
  CASE 
    WHEN cc.cov_lat IS NULL OR tl.latitude IS NULL THEN NULL
    ELSE calculate_distance_km(tl.latitude, tl.longitude, cc.cov_lat, cc.cov_lon)
  END AS calculated_distance
FROM company_coverage cc
CROSS JOIN target_location tl;

