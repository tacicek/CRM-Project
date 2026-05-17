-- ============================================================
-- Offerio Marketplace Temizliği
--
-- Silinecek: token_packages, token_transactions,
--            manual_import_subscriptions tabloları
-- Kaldırılacak kolonlar: companies.token_balance, stripe_*,
--            subscription_*, leads.token_cost,
--            lead_distributions.token_cost/token_charged,
--            service_catalog.base_token_cost
-- Kaldırılacak RPC: atomic_adjust_token_balance
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Bağımlı fonksiyonları kaldır
-- ────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.atomic_adjust_token_balance(UUID, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.atomic_accept_lead(UUID, UUID) CASCADE;

-- Cron job varsa kaldır (pg_cron)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('subscription-cron-job') ;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Marketplace tabloları sil
-- ────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.token_transactions CASCADE;
DROP TABLE IF EXISTS public.token_packages      CASCADE;
DROP TABLE IF EXISTS public.manual_import_subscriptions CASCADE;

-- ────────────────────────────────────────────────────────────
-- 3. companies — token / stripe / subscription kolonları kaldır
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  DROP COLUMN IF EXISTS token_balance,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_price_id,
  DROP COLUMN IF EXISTS subscription_type,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS subscription_expires_at,
  DROP COLUMN IF EXISTS subscription_started_at,
  DROP COLUMN IF EXISTS subscription_cancelled_at,
  DROP COLUMN IF EXISTS trial_used,
  DROP COLUMN IF EXISTS trial_started_at,
  DROP COLUMN IF EXISTS trial_expires_at,
  DROP COLUMN IF EXISTS manual_import_enabled;

-- ────────────────────────────────────────────────────────────
-- 4. leads — token_cost kolonu kaldır
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS token_cost,
  DROP COLUMN IF EXISTS token_cost_overridden;

-- ────────────────────────────────────────────────────────────
-- 5. lead_distributions — token kolonları kaldır
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.lead_distributions
  DROP COLUMN IF EXISTS token_cost,
  DROP COLUMN IF EXISTS token_charged;

-- ────────────────────────────────────────────────────────────
-- 6. service_catalog — base_token_cost kaldır
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.service_catalog
  DROP COLUMN IF EXISTS base_token_cost,
  DROP COLUMN IF EXISTS min_token_cost,
  DROP COLUMN IF EXISTS max_token_cost;

-- ────────────────────────────────────────────────────────────
-- 7. pricing_rules / company_pricing_configs — token kolonları
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.pricing_rules
  DROP COLUMN IF EXISTS base_token_cost CASCADE;

ALTER TABLE public.company_pricing_configs
  DROP COLUMN IF EXISTS token_cost_override CASCADE;

-- ────────────────────────────────────────────────────────────
-- 8. leads.max_companies (marketplace dağıtım limiti)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS max_companies,
  DROP COLUMN IF EXISTS accepted_count;

-- ────────────────────────────────────────────────────────────
-- 9. Log
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Marketplace kalıntıları temizlendi: token_packages, token_transactions, manual_import_subscriptions silindi; token/stripe/subscription kolonları kaldırıldı.';
END $$;
