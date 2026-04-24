-- =============================================
-- CREATE SECURITY DEFINER FUNCTION FOR PUBLIC LEAD SUBMISSION
-- This function bypasses RLS and allows anonymous users to insert leads
-- =============================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.submit_lead;

-- Create the function with SECURITY DEFINER
-- This allows the function to run with the privileges of the function owner (postgres)
-- regardless of who calls it, effectively bypassing RLS
CREATE OR REPLACE FUNCTION public.submit_lead(
  p_service_type TEXT,
  p_from_plz TEXT DEFAULT NULL,
  p_from_city TEXT DEFAULT NULL,
  p_from_street TEXT DEFAULT NULL,
  p_from_house_number TEXT DEFAULT NULL,
  p_customer_first_name TEXT DEFAULT NULL,
  p_customer_last_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_preferred_date DATE DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_from_rooms NUMERIC DEFAULT NULL,
  p_from_living_space_m2 INTEGER DEFAULT NULL,
  p_detailed_form_data JSONB DEFAULT NULL,
  p_form_version INTEGER DEFAULT 2
)
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
    from_plz,
    from_city,
    from_street,
    from_house_number,
    customer_first_name,
    customer_last_name,
    customer_email,
    customer_phone,
    preferred_date,
    description,
    property_type,
    from_rooms,
    from_living_space_m2,
    detailed_form_data,
    form_version,
    status,
    max_companies
  ) VALUES (
    p_service_type,
    p_from_plz,
    p_from_city,
    p_from_street,
    p_from_house_number,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_email,
    p_customer_phone,
    p_preferred_date,
    p_description,
    p_property_type,
    p_from_rooms,
    p_from_living_space_m2,
    p_detailed_form_data,
    p_form_version,
    'new',
    5
  )
  RETURNING id INTO new_lead_id;
  
  RETURN new_lead_id;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.submit_lead TO anon;
GRANT EXECUTE ON FUNCTION public.submit_lead TO authenticated;

-- Comment explaining the function
COMMENT ON FUNCTION public.submit_lead IS 'Securely insert a new lead. Uses SECURITY DEFINER to bypass RLS, allowing anonymous form submissions.';

