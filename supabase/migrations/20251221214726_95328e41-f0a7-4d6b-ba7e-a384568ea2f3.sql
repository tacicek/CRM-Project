-- Add distance and duration columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS distance_km numeric NULL,
ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer NULL;