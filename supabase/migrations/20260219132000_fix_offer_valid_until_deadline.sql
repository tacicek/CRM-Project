-- One-time data fix:
-- Ensure existing offers do not have valid_until later than
-- (service_date - 1 day), matching the new acceptance rule.

UPDATE public.offers
SET
  valid_until = (service_date - INTERVAL '1 day')::date,
  updated_at = now()
WHERE service_date IS NOT NULL
  AND valid_until IS NOT NULL
  AND valid_until > (service_date - INTERVAL '1 day')::date
  AND status IN ('draft', 'sent', 'viewed', 'accepted');
