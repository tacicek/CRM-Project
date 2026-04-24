-- Fix leads insert policy to allow public form submissions
-- Drop existing insert policies
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
DROP POLICY IF EXISTS "Public can submit leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public lead submissions" ON public.leads;

-- Create new policy that allows anyone (including anonymous) to insert leads
CREATE POLICY "Allow public lead submissions" ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also ensure the detailed_form_data and form_version columns exist
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS detailed_form_data JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS form_version INTEGER DEFAULT 1;

-- Comments
COMMENT ON COLUMN public.leads.detailed_form_data IS 'Complete form data from detailed wizard as JSON';
COMMENT ON COLUMN public.leads.form_version IS 'Version of the form used to submit (1=basic, 2=detailed wizard)';


