-- =============================================
-- ADD 'only_1' VALUE TO lead_sharing_preference ENUM
-- This allows companies to receive only exclusive leads (1 company)
-- =============================================

-- Add the new enum value 'only_1' to the existing enum type
ALTER TYPE public.lead_sharing_preference ADD VALUE IF NOT EXISTS 'only_1' BEFORE 'only_3';

-- Update the comment to reflect the new option
COMMENT ON COLUMN public.companies.lead_sharing_preference IS 'Company preference for lead sharing: only_1 (exclusive leads - 1 company), only_3 (premium leads - 3 companies), only_5 (standard leads - 5 companies), both (all leads)';



