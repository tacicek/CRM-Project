-- =============================================================================
-- ROLLBACK für 20260728170000_eigentuemer_ist_immer_mitglied.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach entsteht die owner-Mitgliedschaft nicht mehr mit der Firma. Wer eine
--    Firma anlegt und den zweiten INSERT vergisst, bekommt eine Firma, deren
--    Eigentümer in der Anwendung NICHTS sieht — keine Fehlermeldung, nur leere
--    Seiten. Seit `fetchSingleCompanyForUser` über `company_members` auflöst,
--    ist das kein Schönheitsfehler mehr, sondern ein gesperrtes Konto.
--
--    Die bereits angelegten Mitgliedschaften bleiben stehen; sie zu entfernen
--    wäre der eigentliche Schaden.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_companies_ensure_owner_membership ON public.companies;
DROP FUNCTION IF EXISTS public.companies_ensure_owner_membership();

-- DELETE FROM company_members …  -- absichtlich NICHT, siehe Kopf

COMMIT;
