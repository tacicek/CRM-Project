-- =====================================================
-- Add lead sharing preference to companies
-- =====================================================
-- Companies can choose which type of leads they want to receive:
-- 'only_3' = Only leads shared with 3 companies (premium/exclusive)
-- 'only_5' = Only leads shared with 5 companies (standard)
-- 'both' = All leads (default)
-- =====================================================

-- Create enum for lead sharing preference
DO $$ BEGIN
  CREATE TYPE public.lead_sharing_preference AS ENUM ('only_3', 'only_5', 'both');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS lead_sharing_preference public.lead_sharing_preference DEFAULT 'both';

-- Add comment for documentation
COMMENT ON COLUMN public.companies.lead_sharing_preference IS 'Company preference for lead sharing: only_3 (exclusive leads), only_5 (standard leads), both (all leads)';


