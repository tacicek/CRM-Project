-- =============================================================================
-- Company-Specific Pricing Configurations
-- Multi-tenant pricing system allowing each company to set their own rates
-- =============================================================================

-- Create company_pricing_configs table
CREATE TABLE IF NOT EXISTS public.company_pricing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Template reference (optional - for tracking which template was used)
  template_id TEXT DEFAULT 'custom',
  template_name TEXT DEFAULT 'Benutzerdefiniert',
  
  -- Basic settings
  currency TEXT DEFAULT 'CHF' CHECK (currency IN ('CHF', 'EUR')),
  vat_rate NUMERIC(4,2) DEFAULT 8.1 CHECK (vat_rate >= 0 AND vat_rate <= 30),
  minimum_hours INTEGER DEFAULT 4 CHECK (minimum_hours >= 1 AND minimum_hours <= 24),
  minimum_charge NUMERIC(10,2) DEFAULT 480 CHECK (minimum_charge >= 0),
  
  -- Team-based pricing (JSONB array of team rates)
  -- Format: [{ "trucks": 1, "workers": 2, "hourlyRate": 180, "label": "1 LKW + 2 Helfer" }]
  team_rates JSONB DEFAULT '[
    {"trucks": 1, "workers": 1, "hourlyRate": 120, "label": "1 LKW + 1 Helfer"},
    {"trucks": 1, "workers": 2, "hourlyRate": 180, "label": "1 LKW + 2 Helfer"},
    {"trucks": 1, "workers": 3, "hourlyRate": 230, "label": "1 LKW + 3 Helfer"},
    {"trucks": 2, "workers": 4, "hourlyRate": 290, "label": "2 LKW + 4 Helfer"},
    {"trucks": 2, "workers": 5, "hourlyRate": 350, "label": "2 LKW + 5 Helfer"},
    {"trucks": 2, "workers": 6, "hourlyRate": 420, "label": "2 LKW + 6 Helfer"}
  ]'::jsonb,
  
  -- Legacy per-person pricing (for backward compatibility)
  hourly_rate NUMERIC(10,2) DEFAULT 60,
  vehicle_prices JSONB DEFAULT '{
    "transporter": 80,
    "truck_3_5t": 120,
    "truck_7_5t": 180,
    "truck_18t": 250
  }'::jsonb,
  
  -- Distance pricing
  distance_surcharge_rate NUMERIC(6,2) DEFAULT 2.50,
  distance_surcharge_threshold INTEGER DEFAULT 20,
  
  -- Surcharges for special items
  surcharges JSONB DEFAULT '{
    "heavyItemOver100kg": 50,
    "pianoUpright": 350,
    "pianoGrand": 650,
    "safeSmall": 150,
    "safeLarge": 350,
    "aquarium": 200,
    "poolTable": 450
  }'::jsonb,
  
  -- Floor-based surcharges
  floor_surcharges JSONB DEFAULT '{
    "perFloorWithoutElevator": 30,
    "perFloorWithElevator": 10,
    "groundFloorBase": 0
  }'::jsonb,
  
  -- Equipment rental costs
  equipment JSONB DEFAULT '{
    "moebelliftSingleLocation": 350,
    "moebelliftBothLocations": 550,
    "packingMaterialPerM3": 25
  }'::jsonb,
  
  -- Extra services pricing
  packing_service_rate NUMERIC(6,2) DEFAULT 45,
  external_lift_cost NUMERIC(8,2) DEFAULT 550,
  disposal_cost NUMERIC(6,2) DEFAULT 35,
  piano_transport_cost NUMERIC(8,2) DEFAULT 350,
  storage_cost_per_m3 NUMERIC(6,2) DEFAULT 45,
  
  -- Time-based multipliers
  multipliers JSONB DEFAULT '{
    "weekend": 1.25,
    "evening": 1.15,
    "holiday": 1.50,
    "express": 1.30
  }'::jsonb,
  
  -- Status and metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Add unique constraint for one active config per company
CREATE UNIQUE INDEX idx_company_pricing_configs_active 
  ON public.company_pricing_configs(company_id) 
  WHERE is_active = true;

-- Create index for faster lookups
CREATE INDEX idx_company_pricing_configs_company_id 
  ON public.company_pricing_configs(company_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_company_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_pricing_updated_at
  BEFORE UPDATE ON public.company_pricing_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_company_pricing_updated_at();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE public.company_pricing_configs ENABLE ROW LEVEL SECURITY;

-- Companies can read their own pricing config
CREATE POLICY "company_read_own_pricing"
  ON public.company_pricing_configs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'moderator')
    )
  );

-- Companies can insert their own pricing config
CREATE POLICY "company_insert_own_pricing"
  ON public.company_pricing_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'moderator')
    )
  );

-- Companies can update their own pricing config
CREATE POLICY "company_update_own_pricing"
  ON public.company_pricing_configs
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'moderator')
    )
  );

-- Companies can delete their own pricing config
CREATE POLICY "company_delete_own_pricing"
  ON public.company_pricing_configs
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'moderator')
    )
  );

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to get company pricing config (with fallback to defaults)
CREATE OR REPLACE FUNCTION get_company_pricing_config(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config JSONB;
BEGIN
  -- Try to get company-specific config
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
  
  -- Return config or NULL (frontend will use defaults)
  RETURN v_config;
END;
$$;

-- Function to upsert company pricing config
CREATE OR REPLACE FUNCTION upsert_company_pricing_config(
  p_company_id UUID,
  p_config JSONB,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config_id UUID;
BEGIN
  -- Deactivate any existing config
  UPDATE public.company_pricing_configs
  SET is_active = false, updated_at = NOW(), updated_by = p_user_id
  WHERE company_id = p_company_id AND is_active = true;
  
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
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_config_id;
  
  RETURN v_config_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_company_pricing_config(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_company_pricing_config(UUID, JSONB, UUID) TO authenticated;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE public.company_pricing_configs IS 
  'Company-specific pricing configurations for the moving calculator. Each company can have their own rates based on Swiss market standards (Delta Umzug reference).';

COMMENT ON COLUMN public.company_pricing_configs.team_rates IS 
  'Array of team configurations with combined hourly rates (truck + workers). Format: [{"trucks": 1, "workers": 2, "hourlyRate": 180, "label": "1 LKW + 2 Helfer"}]';

COMMENT ON COLUMN public.company_pricing_configs.multipliers IS 
  'Time-based price multipliers. Format: {"weekend": 1.25, "evening": 1.15, "holiday": 1.50, "express": 1.30}';
