BEGIN;

-- =====================================================
-- ATOMIC TOKEN BALANCE OPERATIONS
-- Prevents race conditions on all token_balance writes
-- Uses SELECT ... FOR UPDATE to ensure serialized access
-- =====================================================

-- 1. Generic atomic token balance adjustment function
-- Used by: stripe-webhook (purchase), admin token management (credit/debit)
CREATE OR REPLACE FUNCTION public.atomic_adjust_token_balance(
  p_company_id UUID,
  p_amount DECIMAL,                -- positive = credit, negative = debit
  p_type TEXT,                     -- 'purchase', 'credit', 'debit', 'charge', 'refund'
  p_description TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Lock the company row to prevent concurrent balance modifications
  SELECT token_balance INTO v_current_balance
  FROM public.companies
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Company not found'
    );
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  v_new_balance := v_current_balance + p_amount;

  -- Prevent negative balance on debits
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'current_balance', v_current_balance,
      'requested_amount', p_amount
    );
  END IF;

  -- Atomic update
  UPDATE public.companies
  SET token_balance = v_new_balance
  WHERE id = p_company_id;

  -- Record transaction
  -- Cast p_reference_id to UUID since the column is UUID type
  INSERT INTO public.token_transactions (
    company_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    payment_method,
    payment_reference,
    reference_type,
    reference_id
  ) VALUES (
    p_company_id,
    p_type,
    p_amount,
    v_current_balance,
    v_new_balance,
    p_description,
    p_payment_method,
    p_payment_reference,
    p_reference_type,
    CASE WHEN p_reference_id IS NOT NULL AND p_reference_id != '' THEN p_reference_id::UUID ELSE NULL END
  );

  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
END;
$$;

-- Grant execute to authenticated users (admin calls via frontend)
GRANT EXECUTE ON FUNCTION public.atomic_adjust_token_balance TO authenticated;
-- Grant execute to service_role (edge function calls)
GRANT EXECUTE ON FUNCTION public.atomic_adjust_token_balance TO service_role;


-- 2. Fix atomic_accept_lead to read balance from DB instead of trusting JS input
CREATE OR REPLACE FUNCTION public.atomic_accept_lead(
  p_lead_id UUID,
  p_distribution_id UUID,
  p_company_id UUID,
  p_token_cost DECIMAL,
  p_current_balance DECIMAL,  -- DEPRECATED: kept for backward compatibility, ignored
  p_max_companies INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_distribution RECORD;
  v_actual_balance DECIMAL;
  v_new_accepted_count INTEGER;
  v_new_balance DECIMAL;
  v_quota_full BOOLEAN := FALSE;
BEGIN
  -- Lock the lead row to prevent concurrent modifications
  SELECT id, accepted_count, max_companies, service_type, from_city, from_plz, status
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead nicht gefunden');
  END IF;

  -- Check if quota is already full
  IF COALESCE(v_lead.accepted_count, 0) >= COALESCE(v_lead.max_companies, p_max_companies) THEN
    UPDATE public.lead_distributions
    SET status = 'quota_full', responded_at = NOW()
    WHERE id = p_distribution_id;
    
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Das Kontingent für diese Anfrage ist bereits voll',
      'quota_full', true
    );
  END IF;

  -- Lock and check distribution
  SELECT id, status
  INTO v_distribution
  FROM public.lead_distributions
  WHERE id = p_distribution_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verteilung nicht gefunden');
  END IF;

  IF v_distribution.status != 'sent' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Diese Anfrage wurde bereits bearbeitet',
      'status', v_distribution.status
    );
  END IF;

  -- FIX: Read ACTUAL balance from DB with FOR UPDATE instead of trusting p_current_balance
  SELECT COALESCE(token_balance, 0) INTO v_actual_balance
  FROM public.companies
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company nicht gefunden');
  END IF;

  -- Check token balance using actual DB value
  IF v_actual_balance < p_token_cost THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Nicht genügend Tokens',
      'required', p_token_cost,
      'current', v_actual_balance
    );
  END IF;

  -- All checks passed - atomically update everything

  -- 1. Increment accepted_count
  v_new_accepted_count := COALESCE(v_lead.accepted_count, 0) + 1;
  v_quota_full := v_new_accepted_count >= COALESCE(v_lead.max_companies, p_max_companies);

  UPDATE public.leads
  SET 
    accepted_count = v_new_accepted_count,
    status = CASE WHEN v_quota_full THEN 'completed' ELSE status END
  WHERE id = p_lead_id;

  -- 2. Update distribution status
  UPDATE public.lead_distributions
  SET 
    status = 'accepted',
    responded_at = NOW(),
    token_charged = true
  WHERE id = p_distribution_id;

  -- 3. Deduct tokens from company (using actual DB balance)
  v_new_balance := v_actual_balance - p_token_cost;
  
  UPDATE public.companies
  SET token_balance = v_new_balance
  WHERE id = p_company_id;

  -- 4. Record token transaction (with actual balance values)
  INSERT INTO public.token_transactions (
    company_id,
    type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    description
  ) VALUES (
    p_company_id,
    'charge',
    -p_token_cost,
    v_actual_balance,
    v_new_balance,
    'lead',
    p_lead_id,
    'Lead angenommen: ' || v_lead.service_type || ' in ' || v_lead.from_city
  );

  -- 5. If quota is now full, mark remaining distributions
  IF v_quota_full THEN
    UPDATE public.lead_distributions
    SET status = 'quota_full', responded_at = NOW()
    WHERE lead_id = p_lead_id 
      AND status = 'sent'
      AND id != p_distribution_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_accepted_count', v_new_accepted_count,
    'new_balance', v_new_balance,
    'quota_full', v_quota_full
  );
END;
$$;


-- 3. Unique index on token_transactions to prevent duplicate Stripe webhook processing
-- Only applies to non-null payment_reference (manual/admin transactions have null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_transactions_payment_ref_type_unique
ON public.token_transactions (payment_reference, type)
WHERE payment_reference IS NOT NULL;

COMMIT;
