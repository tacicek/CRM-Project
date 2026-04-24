-- =============================================
-- Add price_model, hourly_rate, kostendach_max to offers
-- price_model: 'pauschal' | 'stundenansatz' | 'kostendach'
-- =============================================

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS price_model text NOT NULL DEFAULT 'pauschal'
    CHECK (price_model IN ('pauschal', 'stundenansatz', 'kostendach')),
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS kostendach_max numeric(10,2);

COMMENT ON COLUMN public.offers.price_model IS
  'pauschal = fixed total price | stundenansatz = hourly rate only | kostendach = hourly rate with a maximum price ceiling';
COMMENT ON COLUMN public.offers.hourly_rate IS
  'CHF per hour — used when price_model is stundenansatz or kostendach';
COMMENT ON COLUMN public.offers.kostendach_max IS
  'Maximum price ceiling in CHF — used only when price_model is kostendach';

ALTER TABLE public.offers
  ADD CONSTRAINT kostendach_requires_hourly_rate
    CHECK (
      price_model != 'kostendach' OR
      (hourly_rate IS NOT NULL AND kostendach_max IS NOT NULL)
    );
