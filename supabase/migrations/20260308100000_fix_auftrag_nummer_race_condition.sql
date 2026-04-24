BEGIN;

-- Fix race condition in generate_auftrag_nummer trigger function.
-- The old MAX()-based approach could generate duplicate auftrag_nummer values
-- when two inserts happened concurrently, causing a UNIQUE(company_id, auftrag_nummer) violation (409).
-- Fix: use pg_advisory_xact_lock to serialize number generation per company.

CREATE OR REPLACE FUNCTION public.generate_auftrag_nummer()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_number INTEGER;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Acquire an advisory lock per company to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('auftrag_nummer_' || NEW.company_id::text));

  SELECT COALESCE(MAX(CAST(SUBSTRING(auftrag_nummer FROM 6) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.auftraege
  WHERE company_id = NEW.company_id
    AND auftrag_nummer LIKE year_prefix || '-%';

  NEW.auftrag_nummer := year_prefix || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
