-- =============================================================================
-- ROLLBACK für 20260728130000_kundenaufloesung.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach entsteht kein Kundenbezug mehr. Neue Anfragen, Offerten, Aufträge,
--    Termine und Belege werden mit customer_id = NULL geschrieben; die
--    Kundenkarte zeigt für alles, was ab diesem Zeitpunkt entsteht, nichts an.
--    Bestehende Verknüpfungen bleiben unberührt.
--
--    Der Rückbau ist reparabel: run_customer_backfill() (20260728140000) sammelt
--    liegengebliebene Zeilen nachträglich ein — SOFERN diese Datei nicht auch
--    ausgeführt wurde, denn der Backfill ruft resolve_or_create_customer().
--
--    Weniger drastisch, falls nur EIN Trigger stört (z. B. weil ein Import
--    ungewollt Kunden anlegt): den einzelnen Trigger droppen und die übrigen
--    stehen lassen. Die Funktionen bleiben dabei nutzbar.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_inbound_emails_set_customer ON public.inbound_emails;
DROP TRIGGER IF EXISTS trigger_quittungen_set_customer     ON public.quittungen;
DROP TRIGGER IF EXISTS trigger_rechnungen_set_customer     ON public.rechnungen;
DROP TRIGGER IF EXISTS trigger_appointments_set_customer   ON public.appointments;
DROP TRIGGER IF EXISTS trigger_auftraege_set_customer      ON public.auftraege;
DROP TRIGGER IF EXISTS trigger_offers_set_customer         ON public.offers;
DROP TRIGGER IF EXISTS trigger_leads_set_customer          ON public.leads;

DROP FUNCTION IF EXISTS public.inbound_emails_set_customer();
DROP FUNCTION IF EXISTS public.beleg_set_customer();
DROP FUNCTION IF EXISTS public.appointments_set_customer();
DROP FUNCTION IF EXISTS public.auftraege_set_customer();
DROP FUNCTION IF EXISTS public.offers_set_customer();
DROP FUNCTION IF EXISTS public.leads_set_customer();

DROP FUNCTION IF EXISTS public.duplicate_candidates(UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.merge_customers(UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.customer_merge_preview(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.resolve_or_create_customer(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.find_customer_by_identity(UUID, TEXT, TEXT);

COMMIT;
