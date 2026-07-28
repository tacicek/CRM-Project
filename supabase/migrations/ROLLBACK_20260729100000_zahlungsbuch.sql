-- =============================================================================
-- ROLLBACK für 20260729100000_zahlungsbuch.sql — NICHT als Migration ausführen.
--
-- ⚠️ Löscht das gesamte Zahlungsbuch. Jeder erfasste Eingang, jede Anrechnung
--    und jeder Storno sind danach weg — es gibt keine zweite Quelle dafür.
--    Was aus dem Backfill stammt, liesse sich neu erzeugen; alles, was seither
--    von Hand erfasst wurde, NICHT.
--
--    Vorher sichern:
--      \copy (SELECT * FROM public.payments)            TO 'payments.csv' CSV HEADER
--      \copy (SELECT * FROM public.payment_allocations) TO 'allocations.csv' CSV HEADER
--
--    Reihenfolge: erst 20260729160000, 150000, 140000, 130000, 120000, 110000,
--    dann diese Datei. Die späteren Migrationen zeigen hierher.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_allocation_within_payment ON public.payment_allocations;
DROP TRIGGER IF EXISTS trigger_allocation_immutable      ON public.payment_allocations;
DROP TRIGGER IF EXISTS trigger_payments_append_only      ON public.payments;

DROP FUNCTION IF EXISTS public.guard_allocation_within_payment();
DROP FUNCTION IF EXISTS public.guard_allocation_immutable();
DROP FUNCTION IF EXISTS public.guard_payment_append_only();

DROP TABLE IF EXISTS public.payment_allocations;
DROP TABLE IF EXISTS public.payments;

ALTER TABLE public.rechnungen DROP CONSTRAINT IF EXISTS rechnungen_id_company_uniq;

COMMIT;
