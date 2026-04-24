-- Fix infinite recursion between companies <-> offers RLS policies by using a SECURITY DEFINER ownership check.

CREATE OR REPLACE FUNCTION public.is_company_owner(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND c.user_id = _user_id
  );
$$;

-- Replace offers policies that join companies (which caused recursion when companies policy referenced offers)
DROP POLICY IF EXISTS "Companies can view their own offers" ON public.offers;
DROP POLICY IF EXISTS "Companies can insert their own offers" ON public.offers;
DROP POLICY IF EXISTS "Companies can update their own offers" ON public.offers;
DROP POLICY IF EXISTS "Companies can delete their own offers" ON public.offers;

CREATE POLICY "Companies can view their own offers"
ON public.offers
FOR SELECT
TO authenticated
USING (public.is_company_owner(company_id, auth.uid()));

CREATE POLICY "Companies can insert their own offers"
ON public.offers
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_owner(company_id, auth.uid()));

CREATE POLICY "Companies can update their own offers"
ON public.offers
FOR UPDATE
TO authenticated
USING (public.is_company_owner(company_id, auth.uid()))
WITH CHECK (public.is_company_owner(company_id, auth.uid()));

CREATE POLICY "Companies can delete their own offers"
ON public.offers
FOR DELETE
TO authenticated
USING (public.is_company_owner(company_id, auth.uid()));
