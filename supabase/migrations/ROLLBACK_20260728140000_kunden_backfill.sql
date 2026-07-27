-- =============================================================================
-- ROLLBACK für 20260728140000_kunden_backfill.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- Diese Datei hat ZWEI Teile. Der obere nimmt die DATEN zurück, der untere die
-- Funktionen. Meistens will man nur den oberen.
--
-- ⚠️ Teil 1 löscht alle Kunden, die der Backfill angelegt hat, und leert deren
--    Verknüpfungen. Was ein Bediener seither an diesen Kunden gepflegt hat
--    (Anrede, Notizen, korrigierte Namen) ist damit weg — die Zeilen werden
--    gelöscht, nicht zurückgesetzt. Von Hand angelegte Kunden
--    (created_via <> 'backfill') bleiben unangetastet, ebenso alles, was seither
--    über die Trigger entstanden ist (created_via = 'resolve_rpc').
--
--    Ein erneuter Lauf von run_customer_backfill() stellt die Zuordnung wieder
--    her — nicht aber die Handarbeit.
-- =============================================================================

BEGIN;

-- ---------- Teil 1: Daten ----------

UPDATE public.inbound_emails SET customer_id = NULL
WHERE customer_id IN (SELECT id FROM public.customers WHERE created_via = 'backfill');
UPDATE public.quittungen SET customer_id = NULL
WHERE customer_id IN (SELECT id FROM public.customers WHERE created_via = 'backfill');
UPDATE public.rechnungen SET customer_id = NULL
WHERE customer_id IN (SELECT id FROM public.customers WHERE created_via = 'backfill');
UPDATE public.appointments SET customer_id = NULL
WHERE customer_id IN (SELECT id FROM public.customers WHERE created_via = 'backfill');
UPDATE public.auftraege SET customer_id = NULL
WHERE customer_id IN (SELECT id FROM public.customers WHERE created_via = 'backfill');
UPDATE public.offers SET customer_id = NULL
WHERE customer_id IN (SELECT id FROM public.customers WHERE created_via = 'backfill');
UPDATE public.leads SET customer_id = NULL
WHERE customer_id IN (SELECT id FROM public.customers WHERE created_via = 'backfill');

-- Zusammengeführte Kunden zuerst lösen, sonst hält der Selbstbezug dagegen.
UPDATE public.customers SET merged_into_customer_id = NULL, merged_at = NULL
WHERE merged_into_customer_id IN (SELECT id FROM public.customers WHERE created_via = 'backfill');

DELETE FROM public.customers WHERE created_via = 'backfill';

-- ---------- Teil 2: Funktionen (nur nötig, wenn der Backfill ganz weg soll) ----------
-- DROP FUNCTION IF EXISTS public.run_customer_backfill(UUID);
-- DROP FUNCTION IF EXISTS public.preview_customer_backfill(UUID);
-- DROP FUNCTION IF EXISTS public.customer_backfill_quellen(UUID);

COMMIT;
