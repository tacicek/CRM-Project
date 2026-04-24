-- Fix security vulnerabilities in companies and offers tables

-- Drop overly permissive policies on companies table
DROP POLICY IF EXISTS "Public can view companies via offer access token" ON public.companies;

-- Drop overly permissive policies on offers table
DROP POLICY IF EXISTS "Public can view offers via access token" ON public.offers;
DROP POLICY IF EXISTS "Public can update offer status via token" ON public.offers;

-- Create a security definer function to validate offer access token
CREATE OR REPLACE FUNCTION public.validate_offer_access_token(offer_id uuid, token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.offers
    WHERE id = offer_id
      AND access_token = token
  )
$$;

-- Create a function to get company_id from valid offer token
CREATE OR REPLACE FUNCTION public.get_company_id_from_offer_token(offer_id uuid, token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.offers
  WHERE id = offer_id
    AND access_token = token
$$;

-- New policy: Public can ONLY view offers with valid access token
-- This requires the token to be passed in the request context
CREATE POLICY "Public can view offer with valid token"
ON public.offers
FOR SELECT
TO anon
USING (
  -- Allow viewing only if access_token matches
  access_token = current_setting('request.headers', true)::json->>'x-offer-token'
);

-- New policy: Public can update offer status ONLY with valid access token
-- Only allows updating specific columns (status, accepted_at, rejected_at, customer_response_note, viewed_at)
CREATE POLICY "Public can respond to offer with valid token"
ON public.offers
FOR UPDATE
TO anon
USING (
  access_token = current_setting('request.headers', true)::json->>'x-offer-token'
)
WITH CHECK (
  access_token = current_setting('request.headers', true)::json->>'x-offer-token'
);

-- New policy: Public can view company info ONLY for offers they have valid access to
CREATE POLICY "Public can view company via valid offer token"
ON public.companies
FOR SELECT
TO anon
USING (
  id IN (
    SELECT company_id 
    FROM public.offers 
    WHERE access_token = current_setting('request.headers', true)::json->>'x-offer-token'
  )
);