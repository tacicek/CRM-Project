-- Add Reinigung-specific fields
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS property_type character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bathroom_count integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS kitchen_type character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_balcony boolean DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_garage boolean DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_basement boolean DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_attic boolean DEFAULT false;

-- Add Räumung-specific fields
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS clearing_type character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimated_volume character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_heavy_items boolean DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS heavy_items_description text;

-- Add Entsorgung-specific fields
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS disposal_type character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS items_description text;

-- Add Lagerung-specific fields
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS storage_duration character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS storage_volume character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS access_frequency character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS needs_climate_control boolean DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS storage_items_description text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pickup_street character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pickup_house_number character varying;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pickup_floor integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pickup_has_lift boolean DEFAULT false;