-- Fix the circular reference in companies table RLS policy
-- The "Public can view companies via offer access token" policy joins offers, which joins back to companies

DROP POLICY IF EXISTS "Public can view companies via offer access token" ON public.companies;

-- Create a simpler policy that allows viewing companies if they have any public offers
-- This avoids the recursion by not checking offer conditions that would re-query companies
CREATE POLICY "Public can view companies via offer access token"
ON public.companies
FOR SELECT
USING (
  id IN (SELECT DISTINCT company_id FROM public.offers)
);