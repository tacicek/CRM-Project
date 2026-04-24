-- Migrate lead_sharing_preference: only_5 → both
-- 
-- Reason: only_5 was removed from the UI. Companies that had selected
-- "Nur Standard-Anfragen (5 Firmen)" are now moved to "Alle Anfragen"
-- so they don't lose any leads. The filter logic in match-lead also
-- treats only_5 as both going forward.

UPDATE public.companies
SET lead_sharing_preference = 'both'
WHERE lead_sharing_preference = 'only_5';
