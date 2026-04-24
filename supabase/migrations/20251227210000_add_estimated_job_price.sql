-- Add estimated job price fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS estimated_job_price_min NUMERIC NULL,
ADD COLUMN IF NOT EXISTS estimated_job_price_max NUMERIC NULL,
ADD COLUMN IF NOT EXISTS estimated_job_price_confidence VARCHAR(20) NULL;

-- Comment on the columns
COMMENT ON COLUMN public.leads.estimated_job_price_min IS 'Minimum estimated job price in CHF for the company';
COMMENT ON COLUMN public.leads.estimated_job_price_max IS 'Maximum estimated job price in CHF for the company';
COMMENT ON COLUMN public.leads.estimated_job_price_confidence IS 'Confidence level: high, medium, low';

