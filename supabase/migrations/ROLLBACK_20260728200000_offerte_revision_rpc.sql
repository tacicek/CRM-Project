-- =============================================================================
-- ROLLBACK für 20260728200000_offerte_revision_rpc.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach gibt es keinen Weg mehr, eine versendete Offerte zu ändern: die
--    Sperre aus 20260728190000 bleibt, der Ersatz fällt weg. Entweder beide
--    zurückbauen oder keinen von beiden.
--
--    Bereits angelegte Revisionen bleiben unberührt.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.create_offer_revision(UUID, TEXT);

COMMIT;
