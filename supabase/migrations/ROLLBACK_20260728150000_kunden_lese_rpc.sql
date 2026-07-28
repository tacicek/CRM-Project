-- =============================================================================
-- ROLLBACK für 20260728150000_kunden_lese_rpc.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach lässt sich die Kundenoberfläche nicht mehr laden: Liste, Kennzahlen
--    und Verlauf holen ihre Daten ausschliesslich über diese drei Funktionen.
--    Daten gehen dabei KEINE verloren — es sind reine Lesezugriffe.
--
--    Vor diesem Schritt: reicht es, den Menüpunkt auszublenden?
--    MODULES.contacts = false in src/config/modules.ts.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.customer_timeline(UUID, INTEGER, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.customer_summary(UUID);

COMMIT;
