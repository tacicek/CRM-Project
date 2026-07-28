-- =============================================================================
-- ROLLBACK für 20260729150000_finanz_rpc.sql — NICHT als Migration ausführen.
--
-- ⚠️ Danach gibt es keinen Weg mehr, aus der Anwendung eine Zahlung zu erfassen
--    oder zu stornieren: die Seite /firma/finanzen läuft in "function does not
--    exist". Das Buch selbst und alles Gebuchte bleiben unberührt.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.open_receivables(UUID,INTEGER,INTEGER);
DROP FUNCTION IF EXISTS public.finance_overview(UUID);
DROP FUNCTION IF EXISTS public.reverse_payment(UUID,TEXT);
DROP FUNCTION IF EXISTS public.record_payment(UUID,NUMERIC,DATE,TEXT,UUID,TEXT,TEXT,JSONB);

COMMIT;
