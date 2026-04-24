-- =============================================================================
-- B7: leads.max_companies — açıklayıcı COMMENT (kabul kotası, dağıtım limiti değil)
-- =============================================================================

COMMENT ON COLUMN public.leads.max_companies IS
  'Kabul kotası: kaç firmanın bu leadi kabul edebileceğini belirler (dağıtım limiti DEĞİL). '
  'Tüm eşleşen firmalara dağıtılır; atomic_accept_lead bu sayıya ulaşınca '
  'diğer dağıtımları quota_full olarak işaretler. '
  'Yeniden adlandırma önerisi: max_acceptances.';

-- B6: lead_distributions unique constraint — zaten var (20251223021259 migration)
-- match-lead Edge Function'daki graceful 23505 handling için ayrıca düzenlendi.
-- Bu migration'da sadece constraint'in varlığını doğrulama notu:
-- UNIQUE (lead_id, company_id) ON public.lead_distributions — aktif.
