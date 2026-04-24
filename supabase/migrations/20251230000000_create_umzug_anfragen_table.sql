-- Migration: Create umzug_anfragen table for detailed Umzug wizard form
-- Created: 2025-12-30

-- Create sequence for Umzug anfrage numbers
CREATE SEQUENCE IF NOT EXISTS umzug_anfrage_seq START 1;

-- Create the umzug_anfragen table
CREATE TABLE IF NOT EXISTS public.umzug_anfragen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anfrage_nummer TEXT UNIQUE,
  
  -- Service Type
  service_type TEXT NOT NULL DEFAULT 'umzug',
  
  -- ===== AUSZUG (Current/FROM Property) =====
  -- Basic Info
  from_property_type TEXT, -- 'apartment', 'house', 'shared_room', 'storage', 'office'
  from_rooms DECIMAL(3,1), -- 1, 1.5, 2, 2.5, etc.
  from_floors INTEGER DEFAULT 1, -- Number of floors (e.g., maisonette)
  from_living_space_m2 INTEGER,
  
  -- Address
  from_country TEXT DEFAULT 'CH',
  from_street TEXT,
  from_house_number TEXT,
  from_plz TEXT,
  from_city TEXT,
  from_canton TEXT,
  
  -- Floor Level
  from_floor TEXT, -- 'basement', 'ground_floor', 'raised_ground', 'floor_1', etc.
  
  -- Lift Information
  from_has_lift BOOLEAN DEFAULT false,
  from_lift_type TEXT, -- 'small_elevator', 'large_elevator', 'cargo_elevator'
  from_lift_capacity_persons INTEGER,
  from_lift_capacity_kg INTEGER,
  from_lift_width_cm INTEGER,
  from_lift_depth_cm INTEGER,
  from_lift_height_cm INTEGER,
  
  -- Parking & Access
  from_distance_to_parking INTEGER DEFAULT 0, -- meters
  from_steps_to_entrance TEXT, -- 'steps_0_10', 'steps_11_30', etc.
  from_path_obstruction BOOLEAN DEFAULT false,
  from_path_obstruction_details TEXT,
  
  -- Additional (conditional based on property type)
  from_extras JSONB DEFAULT '{}', -- garage, garden, cellar, attic, etc.
  
  -- ===== EINZUG (New/TO Property) =====
  -- Basic Info
  to_property_type TEXT,
  to_rooms DECIMAL(3,1),
  to_floors INTEGER DEFAULT 1,
  to_living_space_m2 INTEGER,
  
  -- Address
  to_country TEXT DEFAULT 'CH',
  to_street TEXT,
  to_house_number TEXT,
  to_plz TEXT,
  to_city TEXT,
  to_canton TEXT,
  
  -- Floor Level
  to_floor TEXT,
  
  -- Lift Information
  to_has_lift BOOLEAN DEFAULT false,
  to_lift_type TEXT,
  to_lift_capacity_persons INTEGER,
  to_lift_capacity_kg INTEGER,
  to_lift_width_cm INTEGER,
  to_lift_depth_cm INTEGER,
  to_lift_height_cm INTEGER,
  
  -- Parking & Access
  to_distance_to_parking INTEGER DEFAULT 0,
  to_steps_to_entrance TEXT,
  to_path_obstruction BOOLEAN DEFAULT false,
  to_path_obstruction_details TEXT,
  
  -- Additional
  to_extras JSONB DEFAULT '{}',
  
  -- ===== MOVING DETAILS =====
  moving_date DATE,
  moving_flexibility TEXT, -- 'fixed', 'flex_3_days', 'flex_1_week', 'flex_2_weeks'
  moving_start_time TEXT, -- '07:00', '08:00', etc. or 'flexible'
  
  -- ===== INVENTORY =====
  inventory_items JSONB DEFAULT '[]', -- Array of {category, name, count, weight_kg, special, extra_cost}
  estimated_boxes INTEGER DEFAULT 0,
  heavy_items JSONB DEFAULT '[]', -- Piano, safe, aquarium, etc.
  
  -- ===== ADDITIONAL SERVICES =====
  additional_services_umzug JSONB DEFAULT '{}',
  -- Structure:
  -- {
  --   packing: { active: bool, scope: 'all' | 'fragile_only' },
  --   unpacking: bool,
  --   furniture_assembly: bool,
  --   disposal: { active: bool, volume_m3: number },
  --   end_cleaning: bool,
  --   storage: { active: bool, weeks: number },
  --   furniture_lift: { active: bool, location: 'from' | 'to' | 'both' }
  -- }
  
  -- ===== CONTACT INFORMATION =====
  customer_salutation TEXT, -- 'herr', 'frau', 'divers'
  customer_first_name TEXT NOT NULL,
  customer_last_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_contact_time TEXT, -- Preferred contact time
  
  -- ===== NOTES =====
  customer_remarks TEXT,
  
  -- ===== CALCULATED VALUES (backend) =====
  estimated_duration_hours DECIMAL(4,1),
  estimated_price_chf DECIMAL(10,2),
  distance_km DECIMAL(6,1),
  
  -- ===== META =====
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pending_verification', 'verified', 'in_progress', 'offers_sent', 'completed', 'cancelled')),
  form_version INTEGER DEFAULT 2,
  max_companies INTEGER DEFAULT 3,
  token_cost DECIMAL(10,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_umzug_anfragen_status ON public.umzug_anfragen(status);
CREATE INDEX IF NOT EXISTS idx_umzug_anfragen_moving_date ON public.umzug_anfragen(moving_date);
CREATE INDEX IF NOT EXISTS idx_umzug_anfragen_created ON public.umzug_anfragen(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_umzug_anfragen_from_plz ON public.umzug_anfragen(from_plz);
CREATE INDEX IF NOT EXISTS idx_umzug_anfragen_to_plz ON public.umzug_anfragen(to_plz);
CREATE INDEX IF NOT EXISTS idx_umzug_anfragen_email ON public.umzug_anfragen(customer_email);

-- Function to generate Umzug anfrage number
CREATE OR REPLACE FUNCTION generate_umzug_nummer()
RETURNS TRIGGER AS $$
BEGIN
  NEW.anfrage_nummer := 'UMZ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('umzug_anfrage_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate anfrage_nummer
DROP TRIGGER IF EXISTS set_umzug_nummer ON public.umzug_anfragen;
CREATE TRIGGER set_umzug_nummer
  BEFORE INSERT ON public.umzug_anfragen
  FOR EACH ROW
  EXECUTE FUNCTION generate_umzug_nummer();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_umzug_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS umzug_updated_at ON public.umzug_anfragen;
CREATE TRIGGER umzug_updated_at
  BEFORE UPDATE ON public.umzug_anfragen
  FOR EACH ROW
  EXECUTE FUNCTION update_umzug_updated_at();

-- Enable Row Level Security
ALTER TABLE public.umzug_anfragen ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public insert (for form submissions)
DROP POLICY IF EXISTS "Anyone can submit umzug anfragen" ON public.umzug_anfragen;
CREATE POLICY "Anyone can submit umzug anfragen"
  ON public.umzug_anfragen
  FOR INSERT
  TO public
  WITH CHECK (true);

-- RLS Policy: Allow read access for authenticated users (admin/moderator/company)
DROP POLICY IF EXISTS "Authenticated users can read umzug anfragen" ON public.umzug_anfragen;
CREATE POLICY "Authenticated users can read umzug anfragen"
  ON public.umzug_anfragen
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Allow update for admins/moderators
DROP POLICY IF EXISTS "Admins can update umzug anfragen" ON public.umzug_anfragen;
CREATE POLICY "Admins can update umzug anfragen"
  ON public.umzug_anfragen
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- Grant permissions
GRANT ALL ON public.umzug_anfragen TO authenticated;
GRANT INSERT, SELECT ON public.umzug_anfragen TO anon;
GRANT USAGE, SELECT ON SEQUENCE umzug_anfrage_seq TO anon, authenticated;

-- Comment on table
COMMENT ON TABLE public.umzug_anfragen IS 'Detailed Umzug (Moving) inquiries from the multi-step wizard form';


