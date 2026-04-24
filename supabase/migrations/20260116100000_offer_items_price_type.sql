-- =============================================
-- Add price_type and is_highlighted to offer_items
-- =============================================

-- Add price_type column for different pricing models
-- Values: 'pauschale', 'per_unit', 'per_hour', 'inkl', 'optional'
ALTER TABLE public.offer_items
ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) DEFAULT 'pauschale';

-- Add is_highlighted column for visually emphasizing items
ALTER TABLE public.offer_items
ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE;

-- Add is_optional column for optional items
ALTER TABLE public.offer_items
ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT FALSE;

-- Update existing items based on their current unit values
UPDATE public.offer_items
SET price_type = 'inkl'
WHERE unit = 'inkl.' OR (unit_price = 0 AND quantity = 0);

UPDATE public.offer_items
SET price_type = 'per_hour'
WHERE unit IN ('Stunden', 'Stunde', 'Std.', 'h');

-- Comment for documentation
COMMENT ON COLUMN public.offer_items.price_type IS 'Pricing model: pauschale (flat rate), per_unit (per piece), per_hour (hourly), inkl (included), optional';
COMMENT ON COLUMN public.offer_items.is_highlighted IS 'Whether this item should be visually highlighted in the offer';
COMMENT ON COLUMN public.offer_items.is_optional IS 'Whether this item is optional (not included in total calculation)';
