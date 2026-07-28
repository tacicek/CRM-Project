-- =============================================================================
-- ROLLBACK für 20260729110000_rechnung_offener_betrag.sql — NICHT als Migration.
--
-- ⚠️ Danach ist `rechnungen.status` wieder ein freies Feld: 'bezahlt' lässt sich
--    ohne jede Deckung setzen. Der offene Betrag verschwindet, Teilzahlungen
--    sind nicht mehr darstellbar. Das Zahlungsbuch bleibt bestehen, wirkt aber
--    auf nichts mehr — die Rechnungsliste zeigt wieder den Haken.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_rechnungen_bezahlt_deckung ON public.rechnungen;
DROP TRIGGER IF EXISTS trigger_allocation_rechnung_fortschreiben ON public.payment_allocations;

DROP FUNCTION IF EXISTS public.guard_rechnung_bezahlt_braucht_deckung();
DROP FUNCTION IF EXISTS public.rechnung_zahlungsstand_fortschreiben();

ALTER TABLE public.rechnungen
  DROP COLUMN IF EXISTS open_amount,
  DROP COLUMN IF EXISTS credited_total,
  DROP COLUMN IF EXISTS paid_total,
  DROP COLUMN IF EXISTS invoice_type;

COMMIT;
