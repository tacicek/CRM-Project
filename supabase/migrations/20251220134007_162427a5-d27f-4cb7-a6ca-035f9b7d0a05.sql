-- Add admin policies for company_services table
CREATE POLICY "Admins can manage all company services"
ON public.company_services
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Add admin policies for company_plz_coverage table  
CREATE POLICY "Admins can manage all PLZ coverage"
ON public.company_plz_coverage
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));