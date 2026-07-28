-- =============================================================================
-- ROLLBACK für 20260729130000_quittung_ans_buch.sql — NICHT als Migration.
--
-- ⚠️ Danach steht die Quittung wieder neben dem Zahlungsbuch statt darin. Die
--    zugehörigen `payments`-Zeilen bleiben bestehen, aber niemand weiss mehr,
--    zu welcher Quittung sie gehören — vorher festhalten:
--      \copy (SELECT id, quittung_nr, payment_id FROM public.quittungen
--             WHERE payment_id IS NOT NULL) TO 'quittung_payment.csv' CSV HEADER
--
--    Und: `betrag_noch_offen` lässt sich wieder ohne Buchung auf false setzen.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_quittungen_bezahlt_buchung ON public.quittungen;
DROP FUNCTION IF EXISTS public.guard_quittung_bezahlt_braucht_buchung();
DROP FUNCTION IF EXISTS public.record_quittung_payment(UUID,TEXT,DATE,TEXT,TEXT);

ALTER TABLE public.quittungen DROP CONSTRAINT IF EXISTS quittungen_payment_fk;
ALTER TABLE public.quittungen DROP COLUMN IF EXISTS payment_id;

COMMIT;
