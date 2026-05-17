-- ============================================================
-- Adım 4: company_members tablosu + backfill
--
-- Amaç: Bir kullanıcının birden fazla firmaya üye olabilmesini
-- sağlamak. Mevcut companies.user_id (tekli sahiplik) korunur;
-- bu tablo üyelik katmanını ekler.
--
-- Adım 5'te RLS politikaları bu tabloya geçirilecek.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. company_members tablosu
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'owner'
                          CHECK (role IN ('owner', 'admin', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, user_id)
);

COMMENT ON TABLE public.company_members IS
  'Kullanıcı–firma üyelik köprü tablosu. Bir kullanıcı birden fazla firmaya üye olabilir.';
COMMENT ON COLUMN public.company_members.role IS
  'owner: tam yetki (sahip), admin: yönetim yetkisi, member: salt okuma/standart erişim';

-- ────────────────────────────────────────────────────────────
-- 2. Index'ler
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_company_members_user_id
  ON public.company_members (user_id);

CREATE INDEX IF NOT EXISTS idx_company_members_company_id
  ON public.company_members (company_id);

CREATE INDEX IF NOT EXISTS idx_company_members_company_user
  ON public.company_members (company_id, user_id);

-- ────────────────────────────────────────────────────────────
-- 3. Row Level Security
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi üyeliklerini görebilir
CREATE POLICY "members_select_own"
  ON public.company_members
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admin rolündeki kullanıcılar tüm üyelikleri görebilir
CREATE POLICY "members_select_admin"
  ON public.company_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- Sadece servis rolü (Edge Functions) veya mevcut owner üye ekleyebilir
CREATE POLICY "members_insert_owner_or_service"
  ON public.company_members
  FOR INSERT
  WITH CHECK (
    -- Servis rolü her zaman ekleyebilir
    auth.jwt() ->> 'role' = 'service_role'
    OR
    -- Mevcut company sahibi üye ekleyebilir
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
    OR
    -- companies.user_id sahibi de ekleyebilir (geçiş dönemi)
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_members.company_id
        AND c.user_id = auth.uid()
    )
  );

-- Owner kendi firmasından üye çıkarabilir (kendisi hariç)
CREATE POLICY "members_delete_owner"
  ON public.company_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
    AND user_id != auth.uid()
  );

-- ────────────────────────────────────────────────────────────
-- 4. Backfill: companies.user_id → company_members (owner)
--
--    Her companies kaydı için bir 'owner' satırı oluştur.
--    Zaten varsa atla (ON CONFLICT DO NOTHING).
-- ────────────────────────────────────────────────────────────

INSERT INTO public.company_members (company_id, user_id, role)
SELECT
  c.id        AS company_id,
  c.user_id   AS user_id,
  'owner'     AS role
FROM public.companies c
WHERE c.user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user_id)
ON CONFLICT (company_id, user_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. Helper fonksiyon: kullanıcının bir firmaya üye olup
--    olmadığını hızlıca kontrol eder.
--    Adım 5'te RLS politikalarında kullanılacak.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_company_member(
  _company_id UUID,
  _user_id    UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id
      AND user_id    = _user_id
  );
$$;

COMMENT ON FUNCTION public.is_company_member IS
  'Bir kullanıcının belirli bir firmaya üye olup olmadığını kontrol eder. Adım 5 RLS politikalarında kullanılır.';

-- ────────────────────────────────────────────────────────────
-- 6. Log
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfilled_count FROM public.company_members;
  RAISE NOTICE 'company_members tablosu oluşturuldu. Toplam üyelik satırı: %', backfilled_count;
END $$;
