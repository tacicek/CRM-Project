-- Fix: Partner Registrierung sonrası firma oluşturma
-- Problem: signUp + email confirmation required → session null → RLS INSERT engellendi
-- Çözüm: SECURITY DEFINER fonksiyon → tüm kayıt işlemini RLS bypass ederek yapar

CREATE OR REPLACE FUNCTION public.create_company_after_signup(
  p_user_id       UUID,
  p_company_name  TEXT,
  p_legal_name    TEXT DEFAULT NULL,
  p_street        TEXT DEFAULT NULL,
  p_house_number  TEXT DEFAULT NULL,
  p_plz           TEXT DEFAULT '0000',
  p_city          TEXT DEFAULT '',
  p_phone         TEXT DEFAULT NULL,
  p_email         TEXT DEFAULT NULL,
  p_website       TEXT DEFAULT NULL,
  p_services      TEXT[] DEFAULT '{}',
  p_coverage_plz  TEXT DEFAULT NULL,
  p_coverage_radius INTEGER DEFAULT 25
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_service TEXT;
  v_priority INT := 1;
BEGIN
  -- Güvenlik: user_id gerçekten auth.users'da var mı?
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Güvenlik: aynı user_id için zaten firma varsa hata ver
  IF EXISTS (SELECT 1 FROM public.companies WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Company already exists for this user';
  END IF;

  -- 1. Firma oluştur
  INSERT INTO public.companies (
    user_id,
    company_name,
    legal_name,
    street,
    house_number,
    plz,
    city,
    phone,
    email,
    website,
    notification_email,
    is_active,
    is_verified
  ) VALUES (
    p_user_id,
    p_company_name,
    p_legal_name,
    p_street,
    p_house_number,
    COALESCE(p_plz, '0000'),
    COALESCE(p_city, ''),
    p_phone,
    p_email,
    p_website,
    p_email,
    true,
    false
  )
  RETURNING id INTO v_company_id;

  -- 2. Services ekle
  FOREACH v_service IN ARRAY p_services
  LOOP
    INSERT INTO public.company_services (
      company_id,
      service_type,
      priority,
      is_active
    ) VALUES (
      v_company_id,
      v_service,
      v_priority,
      true
    );
    v_priority := v_priority + 1;
  END LOOP;

  -- 3. PLZ coverage ekle
  IF p_coverage_plz IS NOT NULL THEN
    INSERT INTO public.company_plz_coverage (
      company_id,
      plz,
      radius_km,
      is_active
    ) VALUES (
      v_company_id,
      p_coverage_plz,
      p_coverage_radius,
      true
    );
  END IF;

  RETURN v_company_id;
END;
$$;

-- Anon kullanıcıların bu fonksiyonu çağırmasına izin ver
-- (signUp sonrası session null olduğu için anon key ile çağırılır)
GRANT EXECUTE ON FUNCTION public.create_company_after_signup TO anon;
GRANT EXECUTE ON FUNCTION public.create_company_after_signup TO authenticated;
