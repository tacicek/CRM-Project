-- ============================================================
-- company_members RLS sıkılaştırma
--
-- Amaç: Firma sahiplerinin kendi başlarına başka kullanıcıları
--        sisteme üye olarak eklemesini engelle.
--        Üye ekleme/silme sadece service_role (admin edge function)
--        aracılığıyla yapılabilir.
-- ============================================================

-- Mevcut INSERT/DELETE politikalarını kaldır
DROP POLICY IF EXISTS "members_insert_owner_or_service" ON public.company_members;
DROP POLICY IF EXISTS "members_delete_owner"            ON public.company_members;

-- Yalnızca service_role INSERT edebilir (admin edge function)
CREATE POLICY "members_insert_service_only"
  ON public.company_members
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Yalnızca service_role DELETE edebilir
CREATE POLICY "members_delete_service_only"
  ON public.company_members
  FOR DELETE
  TO service_role
  USING (true);

-- SELECT politikaları değişmiyor:
--   members_select_own  → kendi üyeliklerini görür
--   members_select_admin → adminler her şeyi görür

COMMENT ON TABLE public.company_members IS
  'Firma-kullanıcı üyelikleri. INSERT/DELETE yalnızca service_role (admin panel) tarafından yapılabilir.';
