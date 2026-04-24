-- Migration: Add Umzug-specific columns to leads table
-- Created: 2025-12-30

-- Add columns for Auszug (FROM property) details
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS from_rooms DECIMAL(3,1);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS from_living_space_m2 INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS from_floor INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS from_has_lift BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS from_lift_type TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS from_distance_to_parking INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS from_steps_to_entrance TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS from_path_obstruction BOOLEAN DEFAULT false;

-- Add columns for Einzug (TO property) details
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_plz TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_city TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_street TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_house_number TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_rooms DECIMAL(3,1);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_living_space_m2 INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_floor INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_has_lift BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_lift_type TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_distance_to_parking INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_steps_to_entrance TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS to_path_obstruction BOOLEAN DEFAULT false;

-- Add columns for moving details
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS moving_date DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS moving_flexibility TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS moving_start_time TEXT;

-- Add columns for inventory
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS inventory_items JSONB DEFAULT '[]';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS additional_services_umzug JSONB DEFAULT '{}';

-- Add columns for contact preferences
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS customer_salutation TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS customer_contact_time TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_to_plz ON public.leads(to_plz);
CREATE INDEX IF NOT EXISTS idx_leads_moving_date ON public.leads(moving_date);

-- Comment on new columns
COMMENT ON COLUMN public.leads.from_rooms IS 'Number of rooms in the from (auszug) property';
COMMENT ON COLUMN public.leads.from_living_space_m2 IS 'Living space in m2 of from property';
COMMENT ON COLUMN public.leads.from_has_lift IS 'Whether from property has elevator';
COMMENT ON COLUMN public.leads.to_plz IS 'Postal code of destination (einzug) property';
COMMENT ON COLUMN public.leads.to_city IS 'City of destination property';
COMMENT ON COLUMN public.leads.to_has_lift IS 'Whether destination property has elevator';
COMMENT ON COLUMN public.leads.moving_date IS 'Preferred moving date';
COMMENT ON COLUMN public.leads.moving_flexibility IS 'Flexibility for moving date (fixed, flex_3_days, flex_1_week, flex_2_weeks)';
COMMENT ON COLUMN public.leads.inventory_items IS 'JSON array of inventory items with counts';
COMMENT ON COLUMN public.leads.additional_services_umzug IS 'JSON object with additional service selections';


