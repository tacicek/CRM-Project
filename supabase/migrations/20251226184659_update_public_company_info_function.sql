-- Drop existing function first because we are changing the return type
DROP FUNCTION IF EXISTS public.get_public_company_info(uuid);

-- Re-create get_public_company_info to return more fields needed for public offer view
CREATE OR REPLACE FUNCTION public.get_public_company_info(company_uuid uuid)
RETURNS TABLE (
  id uuid,
  company_name character varying,
  street character varying,
  house_number character varying,
  city character varying,
  plz character varying,
  phone character varying,
  email character varying,
  website text,
  logo_url text,
  primary_color character varying,
  slogan text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.company_name,
    c.street,
    c.house_number,
    c.city,
    c.plz,
    c.phone,
    c.email,
    c.website,
    c.logo_url,
    c.primary_color,
    c.slogan
  FROM public.companies c
  WHERE c.id = company_uuid;
$$;
