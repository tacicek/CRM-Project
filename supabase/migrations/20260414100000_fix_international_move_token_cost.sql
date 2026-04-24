-- Fix: umzug_international base token cost raised from 20 to 40.
-- International moves are more complex than domestic private (25) or business (35) moves.
UPDATE public.service_catalog
SET base_token_cost = 40.00
WHERE service_type = 'umzug_international';
