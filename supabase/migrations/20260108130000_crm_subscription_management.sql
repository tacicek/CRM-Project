-- =============================================================================
-- CRM SUBSCRIPTION MANAGEMENT
-- Payment tracking, reminders, and auto-deactivation
-- =============================================================================

-- Create subscription payments table
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'CHF',
  payment_method TEXT CHECK (payment_method IN ('invoice', 'bank_transfer', 'twint', 'stripe', 'paypal', 'other')),
  payment_reference TEXT,
  subscription_months INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  invoice_number TEXT,
  invoice_sent_at TIMESTAMPTZ
);

-- Create subscription reminders log
CREATE TABLE IF NOT EXISTS public.subscription_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('expiry_30_days', 'expiry_14_days', 'expiry_7_days', 'expiry_3_days', 'expiry_1_day', 'expired', 'deactivated')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_sent_to TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_payments_company_id ON public.subscription_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON public.subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_reminders_company_id ON public.subscription_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_reminders_reminder_type ON public.subscription_reminders(reminder_type);

-- Add reminder tracking to companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_reminder_type TEXT;

-- Function to extend subscription
CREATE OR REPLACE FUNCTION public.extend_subscription(
  p_company_id UUID,
  p_months INTEGER,
  p_confirmed_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_expires TIMESTAMPTZ;
  v_new_expires TIMESTAMPTZ;
BEGIN
  -- Get current expiry date
  SELECT subscription_expires_at INTO v_current_expires
  FROM public.companies
  WHERE id = p_company_id;
  
  -- Calculate new expiry date
  IF v_current_expires IS NULL OR v_current_expires < NOW() THEN
    v_new_expires := NOW() + (p_months || ' months')::INTERVAL;
  ELSE
    v_new_expires := v_current_expires + (p_months || ' months')::INTERVAL;
  END IF;
  
  -- Update company
  UPDATE public.companies
  SET 
    crm_enabled = TRUE,
    subscription_type = 'crm',
    subscription_expires_at = v_new_expires,
    crm_enabled_at = COALESCE(crm_enabled_at, NOW()),
    crm_enabled_by = COALESCE(crm_enabled_by, p_confirmed_by),
    last_reminder_sent_at = NULL,
    last_reminder_type = NULL
  WHERE id = p_company_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and deactivate expired subscriptions
CREATE OR REPLACE FUNCTION public.deactivate_expired_subscriptions()
RETURNS TABLE(company_id UUID, company_name TEXT, email TEXT) AS $$
BEGIN
  RETURN QUERY
  UPDATE public.companies
  SET 
    crm_enabled = FALSE,
    subscription_type = 'basic'
  WHERE 
    crm_enabled = TRUE
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at < NOW()
  RETURNING id, companies.company_name, companies.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get companies needing reminders
CREATE OR REPLACE FUNCTION public.get_companies_needing_reminders()
RETURNS TABLE(
  company_id UUID,
  company_name TEXT,
  email TEXT,
  notification_email TEXT,
  expires_at TIMESTAMPTZ,
  days_until_expiry INTEGER,
  reminder_type TEXT,
  last_reminder_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS company_id,
    c.company_name,
    c.email,
    c.notification_email,
    c.subscription_expires_at AS expires_at,
    EXTRACT(DAY FROM (c.subscription_expires_at - NOW()))::INTEGER AS days_until_expiry,
    CASE
      WHEN c.subscription_expires_at <= NOW() THEN 'expired'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '1 day' THEN 'expiry_1_day'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '3 days' THEN 'expiry_3_days'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '7 days' THEN 'expiry_7_days'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '14 days' THEN 'expiry_14_days'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '30 days' THEN 'expiry_30_days'
      ELSE NULL
    END AS reminder_type,
    c.last_reminder_type
  FROM public.companies c
  WHERE 
    c.crm_enabled = TRUE
    AND c.subscription_expires_at IS NOT NULL
    AND c.subscription_expires_at <= NOW() + INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.extend_subscription(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_expired_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_companies_needing_reminders() TO authenticated;

-- RLS for subscription_payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Admins can see all payments
CREATE POLICY "Admins can manage subscription payments" ON public.subscription_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Companies can see their own payments
CREATE POLICY "Companies can view their payments" ON public.subscription_payments
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- RLS for subscription_reminders
ALTER TABLE public.subscription_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage subscription reminders" ON public.subscription_reminders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Comments
COMMENT ON TABLE public.subscription_payments IS 'Tracks CRM subscription payments';
COMMENT ON TABLE public.subscription_reminders IS 'Logs subscription expiry reminder emails';
COMMENT ON FUNCTION public.extend_subscription IS 'Extends a company subscription by N months';
COMMENT ON FUNCTION public.deactivate_expired_subscriptions IS 'Deactivates expired subscriptions and returns affected companies';
COMMENT ON FUNCTION public.get_companies_needing_reminders IS 'Returns companies that need expiry reminder emails';

