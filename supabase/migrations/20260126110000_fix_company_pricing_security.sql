-- =============================================================================
-- FIX: Company Pricing Security and Transaction Safety
-- Fixes:
-- 1. SET search_path for SQL injection prevention
-- 2. Proper exception handling for atomic operations
-- 3. Authorization check inside SECURITY DEFINER functions
-- 4. Audit logging for pricing changes
-- =============================================================================

-- =============================================================================
-- Create audit log table for pricing changes
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.company_pricing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.company_pricing_configs(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'deactivate')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_pricing_audit_company_id ON public.company_pricing_audit_log(company_id);
CREATE INDEX idx_pricing_audit_changed_at ON public.company_pricing_audit_log(changed_at DESC);

-- RLS for audit log
ALTER TABLE public.company_pricing_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_read_own_audit"
  ON public.company_pricing_audit_log
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- =============================================================================
-- FIXED: get_company_pricing_config with proper security
-- =============================================================================
CREATE OR REPLACE FUNCTION get_company_pricing_config(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- FIX: Prevent SQL injection
STABLE  -- Optimization: function doesn't modify data
AS $$
DECLARE
  v_config JSONB;
  v_has_access BOOLEAN;
BEGIN
  -- Input validation
  IF p_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check authorization (even though SECURITY DEFINER bypasses RLS)
  SELECT EXISTS(
    SELECT 1 FROM public.companies WHERE id = p_company_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied to company pricing config'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- Get config
  SELECT jsonb_build_object(
    'id', id,
    'companyId', company_id,
    'currency', currency,
    'vatRate', vat_rate,
    'minimumHours', minimum_hours,
    'minimumCharge', minimum_charge,
    'teamRates', team_rates,
    'hourlyRate', hourly_rate,
    'vehiclePrices', vehicle_prices,
    'distanceSurchargeRate', distance_surcharge_rate,
    'distanceSurchargeThreshold', distance_surcharge_threshold,
    'surcharges', surcharges,
    'floorSurcharges', floor_surcharges,
    'equipment', equipment,
    'packingServiceRate', packing_service_rate,
    'externalLiftCost', external_lift_cost,
    'disposalCost', disposal_cost,
    'pianoTransportCost', piano_transport_cost,
    'storageCostPerM3', storage_cost_per_m3,
    'multipliers', multipliers,
    'templateId', template_id,
    'templateName', template_name,
    'isActive', is_active,
    'updatedAt', updated_at
  ) INTO v_config
  FROM public.company_pricing_configs
  WHERE company_id = p_company_id
    AND is_active = true
  LIMIT 1;
  
  RETURN v_config;
END;
$$;

-- =============================================================================
-- FIXED: upsert_company_pricing_config with transaction safety
-- =============================================================================
CREATE OR REPLACE FUNCTION upsert_company_pricing_config(
  p_company_id UUID,
  p_config JSONB,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- FIX: Prevent SQL injection
AS $$
DECLARE
  v_config_id UUID;
  v_old_config_id UUID;
  v_old_values JSONB;
  v_has_access BOOLEAN;
  v_actual_user_id UUID;
BEGIN
  -- Input validation
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id cannot be null'
      USING ERRCODE = '22023';  -- invalid_parameter_value
  END IF;
  
  IF p_config IS NULL THEN
    RAISE EXCEPTION 'config cannot be null'
      USING ERRCODE = '22023';
  END IF;

  -- Get actual user ID (prefer auth.uid() over parameter for security)
  v_actual_user_id := COALESCE(auth.uid(), p_user_id);

  -- Check authorization
  SELECT EXISTS(
    SELECT 1 FROM public.companies WHERE id = p_company_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied to modify company pricing config'
      USING ERRCODE = '42501';
  END IF;

  -- Validate team_rates structure
  IF p_config ? 'teamRates' THEN
    IF jsonb_typeof(p_config->'teamRates') != 'array' THEN
      RAISE EXCEPTION 'teamRates must be an array'
        USING ERRCODE = '22023';
    END IF;
    
    IF jsonb_array_length(p_config->'teamRates') = 0 THEN
      RAISE EXCEPTION 'teamRates cannot be empty'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Get existing config for audit log
  SELECT id, jsonb_build_object(
    'teamRates', team_rates,
    'vatRate', vat_rate,
    'minimumHours', minimum_hours,
    'minimumCharge', minimum_charge
  )
  INTO v_old_config_id, v_old_values
  FROM public.company_pricing_configs
  WHERE company_id = p_company_id AND is_active = true;

  -- BEGIN ATOMIC OPERATION
  -- Note: PL/pgSQL functions are already atomic - if any statement fails,
  -- all changes are rolled back automatically
  
  -- Deactivate existing config (if any)
  IF v_old_config_id IS NOT NULL THEN
    UPDATE public.company_pricing_configs
    SET 
      is_active = false, 
      updated_at = NOW(), 
      updated_by = v_actual_user_id
    WHERE id = v_old_config_id;
    
    -- Log deactivation
    INSERT INTO public.company_pricing_audit_log (
      company_id, config_id, action, old_values, changed_by
    ) VALUES (
      p_company_id, v_old_config_id, 'deactivate', v_old_values, v_actual_user_id
    );
  END IF;
  
  -- Insert new config
  INSERT INTO public.company_pricing_configs (
    company_id,
    template_id,
    template_name,
    currency,
    vat_rate,
    minimum_hours,
    minimum_charge,
    team_rates,
    hourly_rate,
    vehicle_prices,
    distance_surcharge_rate,
    distance_surcharge_threshold,
    surcharges,
    floor_surcharges,
    equipment,
    packing_service_rate,
    external_lift_cost,
    disposal_cost,
    piano_transport_cost,
    storage_cost_per_m3,
    multipliers,
    is_active,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    COALESCE(p_config->>'templateId', 'custom'),
    COALESCE(p_config->>'templateName', 'Benutzerdefiniert'),
    COALESCE(p_config->>'currency', 'CHF'),
    COALESCE((p_config->>'vatRate')::NUMERIC, 8.1),
    COALESCE((p_config->>'minimumHours')::INTEGER, 4),
    COALESCE((p_config->>'minimumCharge')::NUMERIC, 480),
    COALESCE(p_config->'teamRates', '[{"trucks":1,"workers":2,"hourlyRate":180,"label":"1 LKW + 2 Helfer"}]'::jsonb),
    COALESCE((p_config->>'hourlyRate')::NUMERIC, 60),
    COALESCE(p_config->'vehiclePrices', '{"transporter":80,"truck_3_5t":120,"truck_7_5t":180,"truck_18t":250}'::jsonb),
    COALESCE((p_config->>'distanceSurchargeRate')::NUMERIC, 2.50),
    COALESCE((p_config->>'distanceSurchargeThreshold')::INTEGER, 20),
    COALESCE(p_config->'surcharges', '{}'::jsonb),
    COALESCE(p_config->'floorSurcharges', '{}'::jsonb),
    COALESCE(p_config->'equipment', '{}'::jsonb),
    COALESCE((p_config->>'packingServiceRate')::NUMERIC, 45),
    COALESCE((p_config->>'externalLiftCost')::NUMERIC, 550),
    COALESCE((p_config->>'disposalCost')::NUMERIC, 35),
    COALESCE((p_config->>'pianoTransportCost')::NUMERIC, 350),
    COALESCE((p_config->>'storageCostPerM3')::NUMERIC, 45),
    COALESCE(p_config->'multipliers', '{"weekend":1.25,"evening":1.15,"holiday":1.50,"express":1.30}'::jsonb),
    true,
    v_actual_user_id,
    v_actual_user_id
  )
  RETURNING id INTO v_config_id;
  
  -- Log creation
  INSERT INTO public.company_pricing_audit_log (
    company_id, config_id, action, new_values, changed_by
  ) VALUES (
    p_company_id, 
    v_config_id, 
    CASE WHEN v_old_config_id IS NULL THEN 'create' ELSE 'update' END,
    jsonb_build_object(
      'teamRates', p_config->'teamRates',
      'vatRate', p_config->>'vatRate',
      'minimumHours', p_config->>'minimumHours',
      'minimumCharge', p_config->>'minimumCharge'
    ),
    v_actual_user_id
  );
  
  -- END ATOMIC OPERATION
  
  RETURN v_config_id;

EXCEPTION 
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A pricing configuration already exists for this company'
      USING ERRCODE = '23505';
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE WARNING 'upsert_company_pricing_config failed for company %: % (SQLSTATE: %)', 
      p_company_id, SQLERRM, SQLSTATE;
    RAISE;  -- Re-raise to ensure rollback
END;
$$;

-- =============================================================================
-- NEW: Function to get pricing history
-- =============================================================================
CREATE OR REPLACE FUNCTION get_company_pricing_history(
  p_company_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  -- Check authorization
  IF NOT EXISTS(
    SELECT 1 FROM public.companies WHERE id = p_company_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Access denied'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.old_values,
    al.new_values,
    al.changed_by,
    al.changed_at
  FROM public.company_pricing_audit_log al
  WHERE al.company_id = p_company_id
  ORDER BY al.changed_at DESC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- Grant permissions
-- =============================================================================
GRANT EXECUTE ON FUNCTION get_company_pricing_config(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_company_pricing_config(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_pricing_history(UUID, INTEGER) TO authenticated;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE public.company_pricing_audit_log IS 
  'Audit trail for all pricing configuration changes. Stores before/after values for debugging and rollback.';

COMMENT ON FUNCTION get_company_pricing_config IS 
  'Securely retrieves company pricing configuration with proper authorization checks.';

COMMENT ON FUNCTION upsert_company_pricing_config IS 
  'Atomically updates company pricing configuration with audit logging. Rolls back on any error.';

COMMENT ON FUNCTION get_company_pricing_history IS 
  'Returns the history of pricing changes for a company.';
