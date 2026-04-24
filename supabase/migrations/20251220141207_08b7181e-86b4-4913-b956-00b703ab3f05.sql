-- Allow lead_distributions to be inserted by service role (edge function)
-- The edge function uses service role key so it bypasses RLS
-- But we need policies for admin access too

-- Add admin policies for lead_distributions
CREATE POLICY "Admins can view all lead distributions"
ON public.lead_distributions
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert lead distributions"
ON public.lead_distributions
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update lead distributions"
ON public.lead_distributions
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete lead distributions"
ON public.lead_distributions
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Add admin policies for leads management
CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update leads"
ON public.leads
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete leads"
ON public.leads
FOR DELETE
USING (public.is_admin(auth.uid()));