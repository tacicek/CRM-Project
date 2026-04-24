-- =============================================
-- FIX: Companies user_id Foreign Key Constraint
-- Bu migration orphan kayıtları önler
-- =============================================

-- 1. Önce user_id'yi nullable yap (NOT NULL constraint kaldır)
ALTER TABLE public.companies 
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Orphan kayıtları temizle (auth.users'da olmayan user_id'leri NULL yap)
UPDATE public.companies c
SET user_id = NULL
WHERE c.user_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = c.user_id
  );

-- 3. Foreign Key constraint ekle (ON DELETE SET NULL ile)
-- Önce varsa eski constraint'i kaldır
ALTER TABLE public.companies 
DROP CONSTRAINT IF EXISTS companies_user_id_fkey;

-- Yeni constraint ekle
ALTER TABLE public.companies
ADD CONSTRAINT companies_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- 4. Admin panelinde user_id NULL olan firmaları göstermek için index
CREATE INDEX IF NOT EXISTS idx_companies_user_id_null 
ON public.companies (id) 
WHERE user_id IS NULL;

-- Log
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count 
  FROM public.companies 
  WHERE user_id IS NULL;
  
  RAISE NOTICE 'Migration completed. Companies without user: %', orphan_count;
END $$;

COMMENT ON CONSTRAINT companies_user_id_fkey ON public.companies IS 
'Foreign key to auth.users. ON DELETE SET NULL ensures company record survives when user is deleted.';



