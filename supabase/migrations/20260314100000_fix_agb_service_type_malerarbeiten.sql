-- Fix: agb_sections stored under 'malerarbeiten' (plural) but leads use 'malerarbeit' (singular)
-- This migration renames existing AGB sections to match the actual lead service_type.

UPDATE public.agb_sections
SET service_type = 'malerarbeit'
WHERE service_type = 'malerarbeiten';
