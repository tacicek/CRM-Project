-- Add signature_url column to companies table
ALTER TABLE public.companies 
ADD COLUMN signature_url text NULL;