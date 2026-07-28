-- =============================================================================
-- ROLLBACK für 20260729140000_zahlungen_backfill.sql — NICHT als Migration.
--
-- Zwei Stufen. Die erste entfernt nur die Funktionen und ist harmlos.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.run_finance_backfill(UUID);
DROP FUNCTION IF EXISTS public.preview_finance_backfill(UUID);

COMMIT;

-- =============================================================================
-- Zweite Stufe — NUR falls auch die übernommenen Daten weg sollen.
--
-- ⚠️ Trifft ausschliesslich Zeilen mit created_via = 'backfill'. Von Hand
--    erfasste Zahlungen bleiben unberührt. Die betroffenen Rechnungen fallen
--    dabei von 'bezahlt' zurück, und die Quittungen werden wieder offen.
--
-- BEGIN;
--   UPDATE public.quittungen q SET payment_id = NULL, betrag_noch_offen = TRUE
--   FROM public.payments p WHERE p.id = q.payment_id AND p.created_via = 'backfill';
--
--   DELETE FROM public.payment_allocations a
--   USING public.payments p WHERE p.id = a.payment_id AND p.created_via = 'backfill';
--
--   -- Der Append-only-Wächter verbietet DELETE. Für den Rückbau muss er
--   -- kurz weichen:
--   ALTER TABLE public.payments DISABLE TRIGGER trigger_payments_append_only;
--   DELETE FROM public.payments WHERE created_via = 'backfill';
--   ALTER TABLE public.payments ENABLE TRIGGER trigger_payments_append_only;
-- COMMIT;
-- =============================================================================
