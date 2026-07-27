-- =============================================================================
-- ROLLBACK für 20260727170000_offer_acceptance_evidence.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach bestimmt wieder der Browser den Annahmezeitpunkt, und als
--    "AGB-Version" wird nur `id:titel` gespeichert — eine Textänderung bleibt
--    damit unsichtbar. Bereits gespeicherte Hashes bleiben erhalten; sie sind
--    Beweismittel und werden nicht angetastet.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_offers_acceptance_evidence ON public.offers;
DROP FUNCTION IF EXISTS public.set_offer_acceptance_evidence();
DROP FUNCTION IF EXISTS public.agb_content_hash(TEXT);

COMMIT;
