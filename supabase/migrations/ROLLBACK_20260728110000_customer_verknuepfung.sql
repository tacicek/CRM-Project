-- =============================================================================
-- ROLLBACK für 20260728110000_customer_verknuepfung.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach ist jede Zuordnung Vorgang → Kunde weg. Die Kundenstammdaten selbst
--    bleiben stehen (`customers`), aber die Kundenkarte ist leer: sie lebt
--    ausschliesslich von diesen sieben Spalten. Ein erneuter Backfill kann die
--    Zuordnung wiederherstellen, NICHT aber von Hand korrigierte Zuweisungen.
--
--    Reihenfolge: diese Datei VOR ROLLBACK_20260728100000 ausführen.
--
--    Weniger drastisch, falls nur ein einzelner Fremdschlüssel stört: die
--    betroffene Constraint einzeln droppen und die Spalte stehen lassen.
-- =============================================================================

BEGIN;

ALTER TABLE public.inbound_emails DROP CONSTRAINT IF EXISTS inbound_emails_customer_fk;
ALTER TABLE public.quittungen     DROP CONSTRAINT IF EXISTS quittungen_customer_fk;
ALTER TABLE public.rechnungen     DROP CONSTRAINT IF EXISTS rechnungen_customer_fk;
ALTER TABLE public.appointments   DROP CONSTRAINT IF EXISTS appointments_customer_fk;
ALTER TABLE public.auftraege      DROP CONSTRAINT IF EXISTS auftraege_customer_fk;
ALTER TABLE public.offers         DROP CONSTRAINT IF EXISTS offers_customer_fk;
ALTER TABLE public.leads          DROP CONSTRAINT IF EXISTS leads_customer_fk;

-- Indizes fallen mit den Spalten.
ALTER TABLE public.inbound_emails DROP COLUMN IF EXISTS customer_id;
ALTER TABLE public.quittungen     DROP COLUMN IF EXISTS customer_id;
ALTER TABLE public.rechnungen     DROP COLUMN IF EXISTS customer_id;
ALTER TABLE public.appointments   DROP COLUMN IF EXISTS customer_id;
ALTER TABLE public.auftraege      DROP COLUMN IF EXISTS customer_id;
ALTER TABLE public.offers         DROP COLUMN IF EXISTS customer_id;
ALTER TABLE public.leads          DROP COLUMN IF EXISTS customer_id;

COMMIT;
