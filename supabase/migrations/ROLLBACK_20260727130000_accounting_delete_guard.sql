-- =============================================================================
-- ROLLBACK für 20260727130000_accounting_delete_guard.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach sind bezahlte und versendete Rechnungen sowie unterschriebene
--    Quittungen wieder frei löschbar. Bei Rechnungen kommt hinzu, dass die
--    Nummernvergabe (MAX+1 pro Firma) nach dem Löschen der höchsten Rechnung
--    dieselbe Nummer erneut vergibt.
--
--    Vor diesem Rückbau prüfen, ob nicht eine gezieltere Lockerung genügt:
--      • Einzelfall über direkten DB-Zugang (psql als postgres) — der ist von
--        den Triggern ohnehin ausgenommen.
--      • Nur den Status-Rückschritt erlauben, die Löschsperre behalten.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_rechnungen_guard_delete ON public.rechnungen;
DROP TRIGGER IF EXISTS trigger_rechnungen_guard_status ON public.rechnungen;
DROP TRIGGER IF EXISTS trigger_quittungen_guard_delete ON public.quittungen;
DROP TRIGGER IF EXISTS trigger_quittungen_guard_status ON public.quittungen;

DROP FUNCTION IF EXISTS public.guard_rechnung_delete();
DROP FUNCTION IF EXISTS public.guard_rechnung_status_regression();
DROP FUNCTION IF EXISTS public.guard_quittung_delete();
DROP FUNCTION IF EXISTS public.guard_quittung_status_regression();

COMMIT;
