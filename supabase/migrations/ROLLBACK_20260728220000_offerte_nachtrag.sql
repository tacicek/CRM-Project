-- =============================================================================
-- ROLLBACK für 20260728220000_offerte_nachtrag.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Dieser Rückbau LÖSCHT alle Nachträge samt ihrer Positionen — und damit den
--    Nachweis, dass ein Kunde einer Zusatzleistung zugestimmt hat. Bereits in
--    den Auftrag fortgeschriebene Beträge und Positionen BLEIBEN dort stehen;
--    danach lässt sich nicht mehr nachvollziehen, woher sie kamen.
--
--    Zuerst 20260728230000 zurückbauen (die Funktionen), dann diese Datei.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_offer_amendments_guard      ON public.offer_amendments;
DROP TRIGGER IF EXISTS trigger_offer_amendments_updated_at ON public.offer_amendments;
DROP TRIGGER IF EXISTS trigger_offer_amendments_inherit    ON public.offer_amendments;
DROP FUNCTION IF EXISTS public.guard_amendment_after_send();
DROP FUNCTION IF EXISTS public.offer_amendments_inherit();

DROP TABLE IF EXISTS public.offer_amendment_items;
DROP TABLE IF EXISTS public.offer_amendments;

COMMIT;
