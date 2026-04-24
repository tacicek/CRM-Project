-- Add AGB acceptance tracking fields to offers table
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS agb_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS agb_version TEXT,
ADD COLUMN IF NOT EXISTS agb_ip_address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.offers.agb_accepted_at IS 'Timestamp when customer accepted the AGB';
COMMENT ON COLUMN public.offers.agb_version IS 'Version/hash of AGB sections at time of acceptance';
COMMENT ON COLUMN public.offers.agb_ip_address IS 'IP address of customer when accepting AGB';