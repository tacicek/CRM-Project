-- Migration: Add detailed Reinigung form fields to leads table
-- This migration adds columns to store detailed cleaning form data

-- Add new columns for detailed cleaning form
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS property_type TEXT,
ADD COLUMN IF NOT EXISTS cleaning_windows BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS detailed_form_data JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS form_version INTEGER DEFAULT 1;

-- Add comments for documentation
COMMENT ON COLUMN public.leads.property_type IS 'Type of property: haus, wohnung, wg_zimmer, lager, buero';
COMMENT ON COLUMN public.leads.cleaning_windows IS 'Whether window cleaning is requested';
COMMENT ON COLUMN public.leads.detailed_form_data IS 'Complete form data from detailed wizard as JSON';
COMMENT ON COLUMN public.leads.form_version IS 'Version of the form used to submit (1=basic, 2=detailed wizard)';

-- Create index for faster queries on property type
CREATE INDEX IF NOT EXISTS idx_leads_property_type ON public.leads(property_type);
CREATE INDEX IF NOT EXISTS idx_leads_form_version ON public.leads(form_version);

-- Update existing reinigung leads to form_version 1
UPDATE public.leads 
SET form_version = 1 
WHERE service_type LIKE 'reinigung%' 
AND form_version IS NULL;


