-- Add admin policy for inserting token transactions
CREATE POLICY "Admins can insert token transactions"
ON public.token_transactions
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Add admin policy for viewing all token transactions
CREATE POLICY "Admins can view all token transactions"
ON public.token_transactions
FOR SELECT
USING (public.is_admin(auth.uid()));