-- Remove QA / smoke-test leads from production.
-- Criteria (any match):
--   - detailed_form_data.smoke_test = true (smoke-test-lead-validation.mjs)
--   - description contains SMOKE TEST or "bitte ignorieren"
--   - Gmail plus-addressing on tuncaycicek test aliases
--   - obvious typo domain from fake scenario (.como)
--
-- FK prep: email_logs.lead_id has no ON DELETE rule → null out first.

BEGIN;

UPDATE public.email_logs
SET lead_id = NULL
WHERE lead_id IN (
  SELECT id FROM public.leads
  WHERE
    (detailed_form_data IS NOT NULL AND detailed_form_data @> '{"smoke_test": true}'::jsonb)
    OR (
      description IS NOT NULL
      AND (
        description ILIKE '%SMOKE TEST%'
        OR description ILIKE '%bitte ignorieren%'
      )
    )
    OR (customer_email ILIKE 'tuncaycicek+%@gmail.com')
    OR (customer_email ILIKE '%@gmall.como')
);

DELETE FROM public.leads
WHERE
  (detailed_form_data IS NOT NULL AND detailed_form_data @> '{"smoke_test": true}'::jsonb)
  OR (
    description IS NOT NULL
    AND (
      description ILIKE '%SMOKE TEST%'
      OR description ILIKE '%bitte ignorieren%'
    )
  )
  OR (customer_email ILIKE 'tuncaycicek+%@gmail.com')
  OR (customer_email ILIKE '%@gmall.como');

COMMIT;
