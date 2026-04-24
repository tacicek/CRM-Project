-- Allow admins to update lead_distributions (e.g., to sync token_cost after manual edit)
CREATE POLICY "Admins can update lead distributions"
  ON public.lead_distributions
  FOR UPDATE
  USING (public.is_admin(auth.uid()));
