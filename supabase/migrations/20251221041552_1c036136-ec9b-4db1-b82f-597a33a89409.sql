-- Add Resend configuration fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS resend_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS resend_api_key text,
ADD COLUMN IF NOT EXISTS resend_from_email text,
ADD COLUMN IF NOT EXISTS resend_from_name text;