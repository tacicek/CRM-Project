-- =====================================================
-- MANUAL IMPORT SUBSCRIPTIONS
-- Premium feature for companies to import their own leads
-- =====================================================

-- Add manual import fields to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS manual_import_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_import_activated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manual_import_monthly_fee INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS manual_import_next_billing_at TIMESTAMPTZ;

-- Create subscription tracking table
CREATE TABLE IF NOT EXISTS public.manual_import_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'expired')),
  monthly_tokens INTEGER DEFAULT 20,
  activated_by UUID REFERENCES auth.users(id),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  total_imports_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create imported leads table to track manually imported anfragen
CREATE TABLE IF NOT EXISTS public.manual_imported_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  raw_import_text TEXT NOT NULL,
  ai_confidence_score INTEGER,
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_import_subs_company ON public.manual_import_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_manual_import_subs_status ON public.manual_import_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_manual_imported_leads_company ON public.manual_imported_leads(company_id);

-- Enable RLS
ALTER TABLE public.manual_import_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_imported_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manual_import_subscriptions
CREATE POLICY "Admins can view all subscriptions" ON public.manual_import_subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage subscriptions" ON public.manual_import_subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Companies can view own subscription" ON public.manual_import_subscriptions
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- RLS Policies for manual_imported_leads
CREATE POLICY "Admins can view all imported leads" ON public.manual_imported_leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Companies can manage own imported leads" ON public.manual_imported_leads
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_manual_import_sub_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_manual_import_sub_updated_at ON public.manual_import_subscriptions;
CREATE TRIGGER trigger_manual_import_sub_updated_at
  BEFORE UPDATE ON public.manual_import_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_manual_import_sub_updated_at();

-- Function to activate manual import subscription
CREATE OR REPLACE FUNCTION public.activate_manual_import(
  p_company_id UUID,
  p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_company RECORD;
  v_subscription_id UUID;
  v_monthly_fee INTEGER;
BEGIN
  -- Get company and check token balance
  SELECT id, company_name, token_balance, manual_import_enabled, COALESCE(manual_import_monthly_fee, 20) as monthly_fee
  INTO v_company
  FROM public.companies
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found');
  END IF;
  
  v_monthly_fee := v_company.monthly_fee;
  
  IF v_company.manual_import_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual import already enabled');
  END IF;
  
  IF v_company.token_balance < v_monthly_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient token balance', 'required', v_monthly_fee, 'available', v_company.token_balance);
  END IF;
  
  -- Deduct tokens
  UPDATE public.companies
  SET 
    token_balance = token_balance - v_monthly_fee,
    manual_import_enabled = true,
    manual_import_activated_at = NOW(),
    manual_import_next_billing_at = NOW() + INTERVAL '30 days'
  WHERE id = p_company_id;
  
  -- Create subscription record
  INSERT INTO public.manual_import_subscriptions (
    company_id,
    status,
    monthly_tokens,
    activated_by,
    activated_at,
    expires_at
  ) VALUES (
    p_company_id,
    'active',
    v_monthly_fee,
    p_admin_id,
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_subscription_id;
  
  -- Log token transaction
  INSERT INTO public.token_transactions (
    company_id,
    amount,
    transaction_type,
    description,
    balance_after
  ) VALUES (
    p_company_id,
    -v_monthly_fee,
    'subscription',
    'Manuelle Anfrage Import - Monatsgebühr',
    v_company.token_balance - v_monthly_fee
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'subscription_id', v_subscription_id,
    'tokens_deducted', v_monthly_fee,
    'expires_at', NOW() + INTERVAL '30 days'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate manual import subscription
CREATE OR REPLACE FUNCTION public.deactivate_manual_import(
  p_company_id UUID,
  p_reason TEXT DEFAULT 'Admin deactivated'
)
RETURNS JSONB AS $$
BEGIN
  -- Update company
  UPDATE public.companies
  SET 
    manual_import_enabled = false,
    manual_import_next_billing_at = NULL
  WHERE id = p_company_id;
  
  -- Update subscription
  UPDATE public.manual_import_subscriptions
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = p_reason
  WHERE company_id = p_company_id AND status = 'active';
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment manual import count
CREATE OR REPLACE FUNCTION public.increment_manual_import_count(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.manual_import_subscriptions
  SET total_imports_count = total_imports_count + 1
  WHERE company_id = p_company_id AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.activate_manual_import TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_manual_import TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_manual_import_count TO authenticated;

