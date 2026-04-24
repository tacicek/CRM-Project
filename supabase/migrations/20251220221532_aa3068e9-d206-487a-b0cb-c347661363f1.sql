-- Drop existing insert policy and recreate it properly
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;

-- Create policy that allows unauthenticated users to insert leads
CREATE POLICY "Public can submit leads" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);