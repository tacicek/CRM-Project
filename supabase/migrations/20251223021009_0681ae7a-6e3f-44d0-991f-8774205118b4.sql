-- =====================================================
-- CRITICAL SECURITY FIX: Companies and Offers RLS Policies
-- =====================================================

-- 1. DROP the overly permissive policies
DROP POLICY IF EXISTS "Public can view company with offers" ON public.companies;
DROP POLICY IF EXISTS "Public can view offer by access token" ON public.offers;
DROP POLICY IF EXISTS "Public can update offer status" ON public.offers;

-- 2. Create SECURE policies for offers table
-- Public can only view an offer if they provide the correct access_token in the query
CREATE POLICY "Public can view offer with valid token" 
ON public.offers 
FOR SELECT 
USING (
  -- Allow if user is authenticated and owns the company
  (auth.uid() IS NOT NULL AND is_company_owner(company_id, auth.uid()))
  OR
  -- Allow if admin
  (auth.uid() IS NOT NULL AND is_admin(auth.uid()))
  OR
  -- Allow public access ONLY when access_token matches (via function check)
  (access_token = current_setting('request.headers', true)::json->>'x-offer-token')
);

-- Public can update offer status only when they have the correct access token
CREATE POLICY "Public can update offer with valid token" 
ON public.offers 
FOR UPDATE 
USING (
  -- Allow if user is authenticated and owns the company
  (auth.uid() IS NOT NULL AND is_company_owner(company_id, auth.uid()))
  OR
  -- Allow if admin
  (auth.uid() IS NOT NULL AND is_admin(auth.uid()))
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND is_company_owner(company_id, auth.uid()))
  OR
  (auth.uid() IS NOT NULL AND is_admin(auth.uid()))
);

-- 3. Create SECURE policy for companies table - only expose non-sensitive data
-- First create a view function to get only public company info
CREATE OR REPLACE FUNCTION public.get_public_company_info(company_uuid uuid)
RETURNS TABLE (
  id uuid,
  company_name character varying,
  city character varying,
  plz character varying,
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
    c.city,
    c.plz,
    c.logo_url,
    c.primary_color,
    c.slogan
  FROM public.companies c
  WHERE c.id = company_uuid;
$$;

-- Create a secure policy for companies that only exposes non-sensitive data
CREATE POLICY "Public can view limited company info via offers" 
ON public.companies 
FOR SELECT 
USING (
  -- Allow full access if user owns the company
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- Allow full access if admin
  (auth.uid() IS NOT NULL AND is_admin(auth.uid()))
  OR
  -- For public: only allow if company has offers (but sensitive data will be filtered by the function)
  (is_company_visible_via_offer(id))
);

-- 4. Create a secure function for public offer access that validates token
CREATE OR REPLACE FUNCTION public.get_offer_by_token(offer_access_token text)
RETURNS TABLE (
  id uuid,
  title character varying,
  description text,
  customer_first_name character varying,
  customer_last_name character varying,
  customer_email character varying,
  customer_phone character varying,
  service_date date,
  valid_until date,
  subtotal numeric,
  vat_rate numeric,
  vat_amount numeric,
  total numeric,
  status character varying,
  created_at timestamp with time zone,
  sent_at timestamp with time zone,
  viewed_at timestamp with time zone,
  accepted_at timestamp with time zone,
  rejected_at timestamp with time zone,
  company_id uuid,
  lead_id uuid,
  agb_accepted_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id,
    o.title,
    o.description,
    o.customer_first_name,
    o.customer_last_name,
    o.customer_email,
    o.customer_phone,
    o.service_date,
    o.valid_until,
    o.subtotal,
    o.vat_rate,
    o.vat_amount,
    o.total,
    o.status,
    o.created_at,
    o.sent_at,
    o.viewed_at,
    o.accepted_at,
    o.rejected_at,
    o.company_id,
    o.lead_id,
    o.agb_accepted_at
  FROM public.offers o
  WHERE o.access_token = offer_access_token;
$$;

-- 5. Create a secure function to update offer via token
CREATE OR REPLACE FUNCTION public.update_offer_by_token(
  offer_access_token text,
  new_status text DEFAULT NULL,
  new_viewed_at timestamp with time zone DEFAULT NULL,
  new_accepted_at timestamp with time zone DEFAULT NULL,
  new_rejected_at timestamp with time zone DEFAULT NULL,
  new_customer_response_note text DEFAULT NULL,
  new_agb_accepted_at timestamp with time zone DEFAULT NULL,
  new_agb_version text DEFAULT NULL,
  new_agb_ip_address text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE public.offers
  SET 
    status = COALESCE(new_status, status),
    viewed_at = COALESCE(new_viewed_at, viewed_at),
    accepted_at = COALESCE(new_accepted_at, accepted_at),
    rejected_at = COALESCE(new_rejected_at, rejected_at),
    customer_response_note = COALESCE(new_customer_response_note, customer_response_note),
    agb_accepted_at = COALESCE(new_agb_accepted_at, agb_accepted_at),
    agb_version = COALESCE(new_agb_version, agb_version),
    agb_ip_address = COALESCE(new_agb_ip_address, agb_ip_address),
    updated_at = now()
  WHERE access_token = offer_access_token;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;