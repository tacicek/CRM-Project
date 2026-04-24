-- Add default_payment_terms column to companies table
ALTER TABLE public.companies
ADD COLUMN default_payment_terms text;