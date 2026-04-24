-- =============================================================================
-- CRM SUBSCRIPTION SYSTEM
-- Adds subscription management for CRM features
-- =============================================================================

-- Add subscription fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS crm_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS crm_enabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS crm_enabled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'basic' CHECK (subscription_type IN ('basic', 'crm', 'enterprise')),
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_notes TEXT;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_companies_crm_enabled ON public.companies(crm_enabled);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_type ON public.companies(subscription_type);

-- Add comment for documentation
COMMENT ON COLUMN public.companies.crm_enabled IS 'Whether CRM features are enabled for this company';
COMMENT ON COLUMN public.companies.crm_enabled_at IS 'When CRM was enabled';
COMMENT ON COLUMN public.companies.crm_enabled_by IS 'Admin who enabled CRM';
COMMENT ON COLUMN public.companies.subscription_type IS 'Subscription tier: basic (leads only), crm (full CRM), enterprise (all features)';
COMMENT ON COLUMN public.companies.subscription_expires_at IS 'When the subscription expires (null = no expiry)';
COMMENT ON COLUMN public.companies.subscription_notes IS 'Internal notes about the subscription';

-- Function to check if CRM is enabled for a company
CREATE OR REPLACE FUNCTION public.is_crm_enabled(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_crm_enabled BOOLEAN;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT crm_enabled, subscription_expires_at
  INTO v_crm_enabled, v_expires_at
  FROM public.companies
  WHERE id = p_company_id;
  
  -- If not found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If CRM is not enabled, return false
  IF NOT v_crm_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- If there's an expiry date, check if it's still valid
  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_crm_enabled(UUID) TO authenticated;

