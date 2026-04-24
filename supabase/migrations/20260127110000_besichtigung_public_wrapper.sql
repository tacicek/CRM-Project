-- =============================================================================
-- PUBLIC WRAPPER FOR BESICHTIGUNG SESSION CREATION
-- =============================================================================
-- PostgREST only exposes 'public' schema by default.
-- This wrapper function lives in 'public' so Edge Functions can call it via RPC.
-- It delegates to besichtigung.create_session() which does the actual work.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_besichtigung_session(
  p_company_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_offer_id UUID DEFAULT NULL,
  p_from_address TEXT DEFAULT NULL,
  p_from_plz TEXT DEFAULT NULL,
  p_from_city TEXT DEFAULT NULL,
  p_expires_days INTEGER DEFAULT 30,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Generate unique token (URL-safe base64)
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(v_token, '+', '-');
  v_token := replace(v_token, '/', '_');
  v_token := replace(v_token, '=', '');

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM besichtigung.sessions WHERE token = v_token) LOOP
    v_token := encode(gen_random_bytes(24), 'base64');
    v_token := replace(v_token, '+', '-');
    v_token := replace(v_token, '/', '_');
    v_token := replace(v_token, '=', '');
  END LOOP;

  -- Calculate expiration
  v_expires_at := NOW() + (p_expires_days || ' days')::INTERVAL;

  -- Insert into besichtigung schema
  INSERT INTO besichtigung.sessions (
    token, company_id, lead_id, offer_id,
    customer_name, customer_email, customer_phone,
    from_address, from_plz, from_city,
    expires_at, created_by, status
  ) VALUES (
    v_token, p_company_id, p_lead_id, p_offer_id,
    p_customer_name, p_customer_email, p_customer_phone,
    p_from_address, p_from_plz, p_from_city,
    v_expires_at, COALESCE(p_created_by, auth.uid()), 'pending'
  )
  RETURNING id INTO v_session_id;

  -- Return result as JSON
  SELECT json_build_object(
    'id', s.id,
    'token', s.token,
    'company_id', s.company_id,
    'lead_id', s.lead_id,
    'offer_id', s.offer_id,
    'customer_name', s.customer_name,
    'customer_email', s.customer_email,
    'customer_phone', s.customer_phone,
    'from_address', s.from_address,
    'from_plz', s.from_plz,
    'from_city', s.from_city,
    'status', s.status,
    'expires_at', s.expires_at,
    'created_at', s.created_at
  ) INTO v_result
  FROM besichtigung.sessions s
  WHERE s.id = v_session_id;

  RETURN v_result;
END;
$$;

-- Grant to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.create_besichtigung_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_besichtigung_session TO service_role;
