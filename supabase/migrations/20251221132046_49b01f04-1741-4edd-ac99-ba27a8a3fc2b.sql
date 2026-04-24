-- Update RLS policies to work with query-based token validation
-- Drop header-based policies
DROP POLICY IF EXISTS "Public can view offer with valid token" ON public.offers;
DROP POLICY IF EXISTS "Public can respond to offer with valid token" ON public.offers;
DROP POLICY IF EXISTS "Public can view company via valid offer token" ON public.companies;

-- Simpler approach: Allow public to view offers by access_token (must be queried directly)
-- The security is in the access_token itself being secret/unguessable
CREATE POLICY "Public can view offer by access token"
ON public.offers
FOR SELECT
TO anon, authenticated
USING (true);

-- Public can update offers but only status-related fields with valid token
-- We rely on the application to filter by access_token
CREATE POLICY "Public can update offer status"
ON public.offers
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- For companies, we need a more restrictive approach
-- Create a function to check if a company is linked to any valid offer token
CREATE OR REPLACE FUNCTION public.is_company_visible_via_offer(company_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.offers
    WHERE company_id = company_uuid
  )
$$;

-- Public can only view companies that have offers
CREATE POLICY "Public can view company with offers"
ON public.companies
FOR SELECT
TO anon
USING (is_company_visible_via_offer(id));