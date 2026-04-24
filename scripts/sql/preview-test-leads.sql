SELECT id, slug, customer_email, status, description,
       (detailed_form_data @> '{"smoke_test": true}'::jsonb) AS is_smoke_flag
FROM public.leads
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
ORDER BY created_at DESC;
