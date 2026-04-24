-- Add payment_terms free-text field to offers table
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;
