-- Enable pgcrypto if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Add public access token to offers
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS access_token VARCHAR UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

-- Add customer response fields
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS customer_response_note TEXT;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_offers_access_token ON public.offers(access_token);

-- Update existing offers with tokens
UPDATE public.offers SET access_token = encode(extensions.gen_random_bytes(16), 'hex') WHERE access_token IS NULL;

-- Make access_token NOT NULL after populating
ALTER TABLE public.offers ALTER COLUMN access_token SET NOT NULL;

-- Create RLS policy for public access via token
CREATE POLICY "Public can view offers via access token"
ON public.offers FOR SELECT
USING (true);

-- Allow public to update status (accept/reject)
CREATE POLICY "Public can update offer status via token"
ON public.offers FOR UPDATE
USING (true)
WITH CHECK (true);