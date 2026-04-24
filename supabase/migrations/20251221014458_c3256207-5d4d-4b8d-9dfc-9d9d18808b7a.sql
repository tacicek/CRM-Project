-- Add primary_color column to companies table for offer branding
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#3b82f6';

-- Add a comment to explain the field
COMMENT ON COLUMN public.companies.primary_color IS 'Primary brand color for offers (hex format e.g. #3b82f6)';