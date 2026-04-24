-- =============================================================================
-- Add Stripe fields to companies for self-serve CRM subscription
-- =============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id    TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Unique constraints so we can look up company by Stripe IDs in webhooks
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_stripe_customer_id
  ON public.companies(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_stripe_subscription_id
  ON public.companies(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.companies.stripe_customer_id    IS 'Stripe customer ID (cus_...) — set when first Stripe Checkout is created';
COMMENT ON COLUMN public.companies.stripe_subscription_id IS 'Active Stripe subscription ID (sub_...) — set by webhook on subscription creation';
