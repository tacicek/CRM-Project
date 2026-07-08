-- ============================================================
-- Offerte Preismodell — item-level Kostendach (Phase 3, additiv, unabhaengig von Phase 2)
-- ============================================================
-- Eine additive Spalte auf offer_items:
--   kostendach_max: item-/service-level Preisobergrenze (max. CHF) fuer rate-Posten.
--     Im PDF/Read unter dem jeweiligen Service-Block gerendert. NULL = kein Item-Cap →
--     Fallback auf offers.kostendach_max (offer-level), das UNANGETASTET bleibt (Altofferten).
--
-- ⚠ Kein Backfill: alle Bestandszeilen bleiben NULL (offer-level Fallback greift).
-- ⚠ RLS/Policies unveraendert — die neue Spalte erbt die bestehenden offer_items-Policies.
-- ⚠ Generated columns (offer_items.total, offers.total/vat_amount) unangetastet.
-- ============================================================

ALTER TABLE public.offer_items
  ADD COLUMN IF NOT EXISTS kostendach_max numeric(10,2)
    CHECK (kostendach_max IS NULL OR kostendach_max >= 0);

COMMENT ON COLUMN public.offer_items.kostendach_max IS
  'Item-/Service-level Kostendach (max. CHF) fuer rate-Posten; im PDF unter dem Service-Block. '
  'NULL = kein Item-Cap → Fallback auf offers.kostendach_max (offer-level, Altofferten).';
