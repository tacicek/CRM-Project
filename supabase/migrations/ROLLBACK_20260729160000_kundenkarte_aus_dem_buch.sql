-- =============================================================================
-- ROLLBACK für 20260729160000_kundenkarte_aus_dem_buch.sql — NICHT als Migration.
--
-- ⚠️ Setzt customer_summary und search_customers NICHT automatisch auf die alte
--    Fassung zurück — dafür 20260728150000_kunden_lese_rpc.sql erneut ausführen
--    (die Datei ist idempotent, sie enthält nur CREATE OR REPLACE).
--
--    Achtung: die alte Fassung liefert `finanzen.quittungen` statt
--    `finanzen.davon_quittungen`. Das Frontend (useKunde.ts, KundeDetail.tsx)
--    erwartet dann wieder den alten Namen — beides gehört zusammen.
--
--    Diese Datei entfernt nur die Rechnungsautomatik.
-- =============================================================================

BEGIN;

SELECT cron.unschedule('invoice-automations')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-automations');

DROP FUNCTION IF EXISTS public.run_invoice_automations();

COMMIT;
