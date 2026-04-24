-- =====================================================
-- ATOMIC ACCEPT LEAD FUNCTION
-- Prevents race conditions when multiple companies accept the same lead
-- =====================================================

CREATE OR REPLACE FUNCTION public.atomic_accept_lead(
  p_lead_id UUID,
  p_distribution_id UUID,
  p_company_id UUID,
  p_token_cost DECIMAL,
  p_current_balance DECIMAL,
  p_max_companies INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead RECORD;
  v_distribution RECORD;
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
    -- Update distribution as quota_full
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

  -- Check token balance
  IF p_current_balance < p_token_cost THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Nicht genügend Tokens',
      'required', p_token_cost,
      'current', p_current_balance
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

  -- 3. Deduct tokens from company
  v_new_balance := p_current_balance - p_token_cost;
  
  UPDATE public.companies
  SET token_balance = v_new_balance
  WHERE id = p_company_id;

  -- 4. Record token transaction
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
    p_current_balance,
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

