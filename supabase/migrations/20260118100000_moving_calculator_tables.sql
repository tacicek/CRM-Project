-- =====================================================
-- MOVING CALCULATOR SUPPORT
-- Extends offers system for detailed moving calculations
-- =====================================================

-- Add moving calculation specific columns to offers
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS calculation_data JSONB DEFAULT NULL,
-- Structure:
-- {
--   "netVolume": 25.5,
--   "truckVolume": 28.1,
--   "bufferPercentage": 10,
--   "timeBreakdown": {
--     "assemblyTime": 120,
--     "carryingTime": 180,
--     "drivingTime": 45,
--     "bufferTime": 35,
--     "totalTime": 380
--   },
--   "costBreakdown": {
--     "laborCost": 950,
--     "vehicleCost": 250,
--     "distanceSurcharge": 0,
--     "extraServicesCost": 300,
--     "subtotal": 1500,
--     "vat": 121.5,
--     "total": 1621.5
--   },
--   "recommendedVehicle": "truck_3_5t",
--   "recommendedCrew": 3,
--   "extraServices": {
--     "packingService": true,
--     "externalLift": false,
--     "disposal": false,
--     "pianoTransport": false,
--     "storage": false
--   }
-- }

ADD COLUMN IF NOT EXISTS origin_building_info JSONB DEFAULT NULL,
-- Structure:
-- {
--   "floor": 3,
--   "hasElevator": false,
--   "elevatorSize": null,
--   "parkingDistance": 15,
--   "stairwellType": "standard",
--   "hasTightCorners": false,
--   "needsExternalLift": false
-- }

ADD COLUMN IF NOT EXISTS destination_building_info JSONB DEFAULT NULL,
-- Same structure as origin_building_info

ADD COLUMN IF NOT EXISTS moving_distance_km NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moving_driving_time_minutes INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moving_additional_stops INTEGER DEFAULT 0;

-- =====================================================
-- OFFER INVENTORY ITEMS TABLE
-- Stores detailed furniture/inventory items for offers
-- =====================================================

CREATE TABLE IF NOT EXISTS public.offer_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  
  -- Item identification
  item_id VARCHAR(100) NOT NULL, -- e.g., 'sofa_3', 'wardrobe_2m'
  category_id VARCHAR(100) NOT NULL, -- e.g., 'living_room', 'bedroom'
  
  -- Item details
  name_de VARCHAR(255) NOT NULL,
  volume_m3 NUMERIC NOT NULL DEFAULT 0,
  assembly_time_minutes INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Calculated totals
  total_volume_m3 NUMERIC GENERATED ALWAYS AS (volume_m3 * quantity) STORED,
  total_assembly_time_minutes INTEGER GENERATED ALWAYS AS (assembly_time_minutes * quantity) STORED,
  
  -- Display order
  position INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.offer_inventory_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Companies can manage their offer inventory items"
ON public.offer_inventory_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM offers o
  JOIN companies c ON c.id = o.company_id
  WHERE o.id = offer_inventory_items.offer_id
  AND c.user_id = auth.uid()
));

CREATE POLICY "Admins can view all offer inventory items"
ON public.offer_inventory_items FOR SELECT
USING (public.is_admin(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offer_inventory_items_offer_id 
ON public.offer_inventory_items(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_inventory_items_category 
ON public.offer_inventory_items(offer_id, category_id);

-- =====================================================
-- MOVING CALCULATION PRESETS TABLE
-- Stores saved calculation presets per company
-- =====================================================

CREATE TABLE IF NOT EXISTS public.moving_calculation_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Preset info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  
  -- Pricing configuration
  pricing_config JSONB NOT NULL DEFAULT '{
    "hourlyRate": 150,
    "vehiclePrices": {
      "transporter": 150,
      "truck_3_5t": 250,
      "truck_7_5t": 400,
      "truck_18t": 600
    },
    "distanceSurchargeRate": 2,
    "distanceSurchargeThreshold": 30,
    "packingServiceRate": 50,
    "externalLiftCost": 600,
    "disposalCost": 300,
    "pianoTransportCost": 400,
    "storageCostPerM3": 80,
    "vatRate": 8.1
  }',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Note: Default management handled by application logic
  UNIQUE (company_id, name)
);

-- Enable RLS
ALTER TABLE public.moving_calculation_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Companies can manage their calculation presets"
ON public.moving_calculation_presets FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = moving_calculation_presets.company_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all calculation presets"
ON public.moving_calculation_presets FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Index
CREATE INDEX IF NOT EXISTS idx_moving_presets_company 
ON public.moving_calculation_presets(company_id);

-- =====================================================
-- FUNCTION: Save Moving Calculation to Offer
-- =====================================================

CREATE OR REPLACE FUNCTION public.save_moving_calculation(
  p_offer_id UUID,
  p_calculation_data JSONB,
  p_origin_building_info JSONB,
  p_destination_building_info JSONB,
  p_distance_km NUMERIC,
  p_driving_time_minutes INTEGER,
  p_additional_stops INTEGER,
  p_inventory_items JSONB -- Array of inventory items
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_position INTEGER := 0;
BEGIN
  -- Update offer with calculation data
  UPDATE offers SET
    calculation_data = p_calculation_data,
    origin_building_info = p_origin_building_info,
    destination_building_info = p_destination_building_info,
    moving_distance_km = p_distance_km,
    moving_driving_time_minutes = p_driving_time_minutes,
    moving_additional_stops = p_additional_stops,
    -- Also update service_details for compatibility
    service_details = COALESCE(service_details, '{}'::JSONB) || jsonb_build_object(
      'volume_m3', (p_calculation_data->>'netVolume')::NUMERIC,
      'truck_volume_m3', (p_calculation_data->>'truckVolume')::NUMERIC,
      'distance_km', p_distance_km,
      'driving_time_minutes', p_driving_time_minutes
    ),
    -- Update resources
    resources = COALESCE(resources, '{}'::JSONB) || jsonb_build_object(
      'vehicles', jsonb_build_array(jsonb_build_object(
        'type', p_calculation_data->>'recommendedVehicle',
        'count', 1
      )),
      'personnel', jsonb_build_object(
        'count', (p_calculation_data->>'recommendedCrew')::INTEGER
      )
    ),
    updated_at = NOW()
  WHERE id = p_offer_id;

  -- Clear existing inventory items for this offer
  DELETE FROM offer_inventory_items WHERE offer_id = p_offer_id;

  -- Insert new inventory items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_inventory_items)
  LOOP
    v_position := v_position + 1;
    INSERT INTO offer_inventory_items (
      offer_id,
      item_id,
      category_id,
      name_de,
      volume_m3,
      assembly_time_minutes,
      quantity,
      position
    ) VALUES (
      p_offer_id,
      v_item->'item'->>'id',
      v_item->>'category_id',
      v_item->'item'->>'name_de',
      (v_item->'item'->>'volume_m3')::NUMERIC,
      (v_item->'item'->>'assembly_time_minutes')::INTEGER,
      (v_item->>'quantity')::INTEGER,
      v_position
    );
  END LOOP;

  RETURN p_offer_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.save_moving_calculation TO authenticated;

COMMENT ON FUNCTION public.save_moving_calculation IS 'Saves moving calculator results to an offer including inventory items';

-- =====================================================
-- VIEW: Offer Moving Details
-- Convenient view for moving-specific offer data
-- =====================================================

CREATE OR REPLACE VIEW public.offer_moving_details AS
SELECT 
  o.id AS offer_id,
  o.offer_number,
  o.company_id,
  o.lead_id,
  o.customer_first_name,
  o.customer_last_name,
  o.title,
  o.status,
  o.subtotal,
  o.total,
  o.calculation_data,
  o.origin_building_info,
  o.destination_building_info,
  o.moving_distance_km,
  o.moving_driving_time_minutes,
  o.moving_additional_stops,
  -- Extracted fields for easy access
  (o.calculation_data->>'netVolume')::NUMERIC AS net_volume_m3,
  (o.calculation_data->>'truckVolume')::NUMERIC AS truck_volume_m3,
  (o.calculation_data->>'recommendedVehicle') AS recommended_vehicle,
  (o.calculation_data->>'recommendedCrew')::INTEGER AS recommended_crew,
  (o.calculation_data->'timeBreakdown'->>'totalTime')::INTEGER AS total_time_minutes,
  -- Inventory summary
  (SELECT COUNT(*) FROM offer_inventory_items WHERE offer_id = o.id) AS inventory_item_count,
  (SELECT SUM(total_volume_m3) FROM offer_inventory_items WHERE offer_id = o.id) AS inventory_total_volume,
  o.created_at,
  o.updated_at
FROM offers o
WHERE o.calculation_data IS NOT NULL;

-- Grant access
GRANT SELECT ON public.offer_moving_details TO authenticated;

COMMENT ON VIEW public.offer_moving_details IS 'Offers with moving calculation data and extracted fields';

-- =====================================================
-- INSERT DEFAULT PRICING PRESET FOR EXISTING COMPANIES
-- =====================================================

INSERT INTO moving_calculation_presets (company_id, name, description, is_default)
SELECT 
  id,
  'Standard Preise',
  'Standardpreise für Umzugskalkulation',
  true
FROM companies
WHERE id NOT IN (SELECT company_id FROM moving_calculation_presets)
ON CONFLICT (company_id, name) DO NOTHING;
