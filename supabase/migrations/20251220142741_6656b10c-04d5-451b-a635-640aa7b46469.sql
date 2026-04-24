-- Add stripe_price_id column to token_packages for linking with Stripe
ALTER TABLE public.token_packages
ADD COLUMN stripe_price_id VARCHAR(255) NULL;

-- Update existing packages with Stripe price IDs
UPDATE public.token_packages SET stripe_price_id = 'price_1SgR632RiFfcqop7Ziw2bGyH' WHERE name = 'Starter';
UPDATE public.token_packages SET stripe_price_id = 'price_1SgR6Z2RiFfcqop7QOc7oUv1' WHERE name = 'Standard';
UPDATE public.token_packages SET stripe_price_id = 'price_1SgR6r2RiFfcqop7Q3SUqPk7' WHERE name = 'Professional';
UPDATE public.token_packages SET stripe_price_id = 'price_1SgR7W2RiFfcqop7F3u7aTfp' WHERE name = 'Business';
UPDATE public.token_packages SET stripe_price_id = 'price_1SgR7k2RiFfcqop783fp7xzt' WHERE name = 'Enterprise';

-- Allow companies to insert token transactions (for webhook)
CREATE POLICY "Companies can insert their token transactions"
ON public.token_transactions
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.companies
  WHERE companies.id = token_transactions.company_id
  AND companies.user_id = auth.uid()
));