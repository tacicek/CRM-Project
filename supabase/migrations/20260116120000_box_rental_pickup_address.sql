-- Add pickup address fields to umzugsbox_rentals table
-- Pickup address is where boxes will be collected from (usually the NEW home after moving)
-- Delivery address is where boxes are delivered to (usually the OLD home before moving)

ALTER TABLE public.umzugsbox_rentals 
ADD COLUMN IF NOT EXISTS pickup_address TEXT,
ADD COLUMN IF NOT EXISTS pickup_plz VARCHAR(10),
ADD COLUMN IF NOT EXISTS pickup_city VARCHAR(100);

-- Add comments for documentation
COMMENT ON COLUMN public.umzugsbox_rentals.pickup_address IS 'Address where boxes will be picked up from (usually new home after moving)';
COMMENT ON COLUMN public.umzugsbox_rentals.pickup_plz IS 'PLZ of pickup location';
COMMENT ON COLUMN public.umzugsbox_rentals.pickup_city IS 'City of pickup location';
COMMENT ON COLUMN public.umzugsbox_rentals.delivery_address IS 'Address where boxes are delivered to (usually old home before moving)';
