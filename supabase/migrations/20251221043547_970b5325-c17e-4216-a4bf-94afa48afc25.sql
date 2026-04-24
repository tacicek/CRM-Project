-- Allow public read access to companies when accessed via valid offer token
CREATE POLICY "Public can view companies via offer access token"
ON public.companies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM offers 
    WHERE offers.company_id = companies.id
  )
);