-- =============================================================================
-- ROLLBACK für 20260728100000_customers_kern.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Dieser Rückbau LÖSCHT alle Kundenstammdaten und den Nachweis jeder
--    Zusammenführung. Was ein Bediener von Hand am Kunden gepflegt hat — Anrede,
--    Notizen, korrigierte Schreibweisen, manuell zugeordnete Altzeilen — ist
--    danach weg und steht in keiner anderen Tabelle.
--
--    Reihenfolge beachten: erst 20260728110000 zurückbauen (die customer_id-
--    Spalten hängen per Fremdschlüssel an dieser Tabelle), dann diese Datei.
--
--    Vor diesem Schritt prüfen, ob nicht eine gezieltere Rücknahme genügt:
--      • Nur den Backfill zurücknehmen:
--        ROLLBACK_20260728140000_kunden_backfill.sql — lässt manuell gepflegte
--        Kunden stehen.
--      • Nur die Oberfläche abschalten: MODULES.contacts = false in
--        src/config/modules.ts blendet den Menüpunkt aus, ohne Daten anzufassen.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_customer_merges_append_only ON public.customer_merges;
DROP TRIGGER IF EXISTS trigger_customers_guard_merge      ON public.customers;
DROP TRIGGER IF EXISTS trigger_customers_updated_at       ON public.customers;
DROP TRIGGER IF EXISTS trigger_customers_set_display_name ON public.customers;

DROP FUNCTION IF EXISTS public.guard_customer_merges_append_only();
DROP FUNCTION IF EXISTS public.guard_customer_merge_fields();
DROP FUNCTION IF EXISTS public.customers_set_display_name();

DROP TABLE IF EXISTS public.customer_merges;
DROP TABLE IF EXISTS public.customers;

-- Die Normalisierer zuletzt: die generierten Spalten von customers hängen an ihnen.
DROP FUNCTION IF EXISTS public.normalize_customer_phone(TEXT);
DROP FUNCTION IF EXISTS public.normalize_customer_email(TEXT);

COMMIT;
