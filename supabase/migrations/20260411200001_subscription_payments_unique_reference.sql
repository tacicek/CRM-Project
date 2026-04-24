-- =============================================================================
-- BUG-1: CRM abonelik yenileme idempotency
-- subscription_payments.payment_reference üzerinde UNIQUE constraint
-- Stripe retry'ında aynı fatura iki kez işlenmesini engeller
-- =============================================================================

ALTER TABLE public.subscription_payments
  ADD CONSTRAINT uq_subscription_payment_reference
  UNIQUE (payment_reference);

COMMENT ON CONSTRAINT uq_subscription_payment_reference ON public.subscription_payments IS
  'Stripe webhook retry idempotency: aynı payment_reference iki kez işlenemez.';
