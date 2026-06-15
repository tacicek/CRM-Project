-- =============================================================================
-- auftraege.offer_id üzerinde partial UNIQUE index
--
-- Aynı offer için birden fazla auftrag oluşmasını engeller.
-- NULL offer_id'ler (manuel oluşturulan auftraglar) etkilenmez.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS auftraege_offer_id_unique
  ON public.auftraege (offer_id)
  WHERE offer_id IS NOT NULL;

COMMENT ON INDEX public.auftraege_offer_id_unique IS
  'Bir offer en fazla bir auftrag ile ilişkilendirilebilir. '
  'Partial index: NULL offer_id (manuel auftrag) birden fazla satırda olabilir.';
