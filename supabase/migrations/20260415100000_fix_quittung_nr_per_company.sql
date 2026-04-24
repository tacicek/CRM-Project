-- ============================================================
-- Fix: Quittung numbers must be per-company, not global
-- Previously used a single shared sequence → numbers interleaved across firms
-- Now each company gets its own sequential counter per year: QU-2026-0001
-- ============================================================

-- Drop the old global sequence (no longer needed)
DROP SEQUENCE IF EXISTS quittung_nr_seq CASCADE;

-- Replace the trigger function with per-company counting
CREATE OR REPLACE FUNCTION generate_quittung_nr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_nr  INTEGER;
  year_str TEXT;
BEGIN
  IF NEW.quittung_nr IS NULL THEN
    year_str := to_char(NOW(), 'YYYY');

    -- Count how many quittungen this company already has in the current year
    -- and take the next number (MAX existing + 1)
    SELECT COALESCE(
      MAX(
        CASE
          WHEN quittung_nr ~ ('^QU-' || year_str || '-[0-9]+$')
          THEN CAST(SPLIT_PART(quittung_nr, '-', 3) AS INTEGER)
          ELSE 0
        END
      ), 0
    ) + 1
    INTO next_nr
    FROM quittungen
    WHERE company_id = NEW.company_id;

    NEW.quittung_nr := 'QU-' || year_str || '-' || LPAD(next_nr::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
