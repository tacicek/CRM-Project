-- =============================================================================
-- ROLLBACK für 20260729120000_gutschriften_und_mahnungen.sql — NICHT als Migration.
--
-- ⚠️ Löscht alle Gutschriften und alle Mahnbelege. Eine ausgestellte Gutschrift
--    liegt beim Kunden — sie hier zu löschen heisst, einen Beleg zu verlieren,
--    den die Gegenseite noch hat. Vorher sichern:
--      \copy (SELECT * FROM public.credit_notes)      TO 'gutschriften.csv' CSV HEADER
--      \copy (SELECT * FROM public.invoice_reminders) TO 'mahnungen.csv' CSV HEADER
--
--    `rechnungen.credited_total` bleibt stehen (gehört zu 20260729110000) und
--    behält seinen letzten Wert. Auf 0 setzen, sonst bleibt der offene Betrag
--    um die gelöschten Gutschriften zu niedrig:
--      UPDATE public.rechnungen SET credited_total = 0 WHERE credited_total <> 0;
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_credit_notes_fortschreiben ON public.credit_notes;
DROP TRIGGER IF EXISTS trigger_gutschrift_hoehe           ON public.credit_notes;
DROP TRIGGER IF EXISTS credit_notes_set_nr                ON public.credit_notes;
DROP TRIGGER IF EXISTS credit_notes_erben                 ON public.credit_notes;
DROP TRIGGER IF EXISTS credit_notes_updated_at            ON public.credit_notes;
DROP TRIGGER IF EXISTS invoice_reminders_erben            ON public.invoice_reminders;
DROP TRIGGER IF EXISTS trigger_mahnstufe_reihenfolge      ON public.invoice_reminders;

DROP FUNCTION IF EXISTS public.rechnung_gutschriften_fortschreiben();
DROP FUNCTION IF EXISTS public.guard_gutschrift_hoehe();
DROP FUNCTION IF EXISTS public.credit_notes_von_rechnung_erben();
DROP FUNCTION IF EXISTS public.generate_gutschrift_nr();
DROP FUNCTION IF EXISTS public.invoice_reminders_sprache_erben();
DROP FUNCTION IF EXISTS public.guard_mahnstufe_reihenfolge();

DROP TABLE IF EXISTS public.invoice_reminders;
DROP TABLE IF EXISTS public.credit_notes;
DROP TABLE IF EXISTS public.gutschrift_nr_counter;

COMMIT;
