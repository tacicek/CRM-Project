-- =============================================================================
-- ROLLBACK für 20260731110000_kundenfaelle.sql — NICHT als Migration ausführen.
--
-- ⚠️ Löscht jede Schadens- und Reklamationsakte samt Verlauf. Das ist der
--    einzige Ort, an dem diese Vorgänge geführt werden — es gibt keine zweite
--    Quelle. Offene Fälle verschwinden, ohne dass der Kunde davon erfährt.
--
--    Vorher sichern:
--      \copy (SELECT * FROM public.customer_cases)       TO 'faelle.csv' CSV HEADER
--      \copy (SELECT * FROM public.customer_case_events) TO 'fallverlauf.csv' CSV HEADER
--
--    Die aus Fällen entstandenen Aufgaben in `crm_tasks` bleiben stehen und
--    zeigen dann auf nichts mehr. Wer sie mitentfernen will:
--      DELETE FROM public.crm_tasks WHERE title LIKE 'FA-%';
--
--    `credit_notes_id_company_uniq` bleibt bestehen: der Schlüssel schadet
--    nicht und andere Migrationen könnten inzwischen darauf zeigen.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.portal_report_case(TEXT, TEXT, TEXT, TEXT, UUID);

DROP TRIGGER IF EXISTS trigger_customer_cases_aufgabe ON public.customer_cases;
DROP TRIGGER IF EXISTS trigger_customer_cases_verlauf ON public.customer_cases;
DROP TRIGGER IF EXISTS customer_cases_set_nr ON public.customer_cases;

DROP FUNCTION IF EXISTS public.customer_cases_aufgabe_anlegen();
DROP FUNCTION IF EXISTS public.customer_cases_verlauf_schreiben();
DROP FUNCTION IF EXISTS public.guard_case_events_append_only();
DROP FUNCTION IF EXISTS public.generate_fall_nr();

DROP TABLE IF EXISTS public.customer_case_events;
DROP TABLE IF EXISTS public.customer_cases;
DROP TABLE IF EXISTS public.fall_nr_counter;

COMMIT;
