-- =============================================================================
-- Auftrag soft-delete (arşivleme)
--
-- Sebep: handleDelete kalıcı DELETE yapıyordu → gerçekleştirilmiş işlerin
-- denetim izi (audit trail) kayboluyordu. Bunun yerine deleted_at ile
-- soft-delete uygulanır. Silinmiş satırlar listede gösterilmez.
--
-- Önemli yan etki: offer_id partial UNIQUE index, soft-delete edilmiş satırı
-- da kapsadığı için aynı offer'a yeni auftrag açılmasını engelliyordu.
-- Index, sadece deleted_at IS NULL satırlarını kapsayacak şekilde yeniden kurulur.
-- =============================================================================

ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.auftraege.deleted_at IS
  'Soft-delete zaman damgası. NULL = aktif. Dolu = arşivlenmiş/silinmiş, listede gizlenir.';

-- Aktif (silinmemiş) auftragları hızlı filtrelemek için kısmi index
CREATE INDEX IF NOT EXISTS idx_auftraege_active
  ON public.auftraege (company_id, scheduled_date)
  WHERE deleted_at IS NULL;

-- offer_id unique index'i yeniden kur: sadece aktif satırları kapsasın
DROP INDEX IF EXISTS public.auftraege_offer_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS auftraege_offer_id_unique
  ON public.auftraege (offer_id)
  WHERE offer_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX public.auftraege_offer_id_unique IS
  'Bir offer en fazla bir AKTİF auftrag ile ilişkilendirilebilir. '
  'Partial index: NULL offer_id (manuel) ve soft-delete edilmiş (deleted_at) satırlar hariç.';
