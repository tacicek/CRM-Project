-- Add default_terms_and_conditions column to companies table
ALTER TABLE public.companies
ADD COLUMN default_terms_and_conditions text;