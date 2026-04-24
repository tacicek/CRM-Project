-- =============================================================================
-- CRM Trial System
-- Allows admins and company owners to activate a free trial period.
-- Billing starts the moment the company subscribes via Stripe.
-- =============================================================================

-- Extend subscription_type to allow 'trial'
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_subscription_type_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_subscription_type_check
  CHECK (subscription_type IN ('basic', 'crm', 'enterprise', 'trial'));

-- Track whether a company has ever used a free trial (one-time per company)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_granted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS trial_granted_at TIMESTAMPTZ;

-- =============================================================================
-- grant_trial(company_id, days, granted_by)
-- Admin or service role grants a free trial to a company.
-- Sets subscription_type='trial', crm_enabled=true, subscription_expires_at=NOW()+days.
-- Can be called multiple times by admin (re-grants trial); trial_used prevents
-- self-serve re-use.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.grant_trial(
  p_company_id   UUID,
  p_days         INTEGER DEFAULT 14,
  p_granted_by   UUID    DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_expires TIMESTAMPTZ;
BEGIN
  v_new_expires := NOW() + (p_days || ' days')::INTERVAL;

  UPDATE public.companies
  SET
    crm_enabled          = TRUE,
    subscription_type    = 'trial',
    subscription_expires_at = v_new_expires,
    trial_used           = TRUE,
    trial_granted_by     = p_granted_by,
    trial_granted_at     = NOW(),
    crm_enabled_at       = COALESCE(crm_enabled_at, NOW()),
    last_reminder_sent_at = NULL,
    last_reminder_type    = NULL
  WHERE id = p_company_id;

  RETURN FOUND;
END;
$$;

-- Self-serve trial: company owner calls this once (enforces trial_used guard)
CREATE OR REPLACE FUNCTION public.activate_self_trial(
  p_days INTEGER DEFAULT 14
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_trial_used BOOLEAN;
  v_new_expires TIMESTAMPTZ;
BEGIN
  -- Find the company of the calling user
  SELECT id, trial_used
    INTO v_company_id, v_trial_used
    FROM public.companies
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Company not found');
  END IF;

  IF v_trial_used THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Trial bereits verwendet');
  END IF;

  v_new_expires := NOW() + (p_days || ' days')::INTERVAL;

  UPDATE public.companies
  SET
    crm_enabled             = TRUE,
    subscription_type       = 'trial',
    subscription_expires_at = v_new_expires,
    trial_used              = TRUE,
    trial_granted_at        = NOW(),
    crm_enabled_at          = COALESCE(crm_enabled_at, NOW()),
    last_reminder_sent_at   = NULL,
    last_reminder_type      = NULL
  WHERE id = v_company_id;

  RETURN jsonb_build_object(
    'success',      TRUE,
    'company_id',   v_company_id,
    'expires_at',   v_new_expires
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_trial(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_self_trial(INTEGER) TO authenticated;

-- Comments
COMMENT ON COLUMN public.companies.trial_used        IS 'TRUE after a free trial has ever been activated (prevents repeated self-serve trials)';
COMMENT ON COLUMN public.companies.trial_granted_by  IS 'Admin user who granted the trial (NULL for self-serve)';
COMMENT ON COLUMN public.companies.trial_granted_at  IS 'Timestamp when the trial was activated';
COMMENT ON FUNCTION public.grant_trial               IS 'Admin: grants a free CRM trial to a company (can be called multiple times)';
COMMENT ON FUNCTION public.activate_self_trial       IS 'Company owner: activates a one-time free trial (blocked if trial_used=TRUE)';
