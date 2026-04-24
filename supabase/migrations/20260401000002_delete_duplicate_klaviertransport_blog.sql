-- Delete duplicate Klaviertransport blog posts (keep only 'klaviertransport-kosten')
-- The old post(s) about the same topic have different slugs and will be removed.
DELETE FROM public.blog_posts
WHERE (
    -- Match by target service and different slug
    target_service = 'klaviertransport'
    AND slug != 'klaviertransport-kosten'
  ) OR (
    -- Also catch any title-based duplicates regardless of service tag
    title ILIKE '%klaviertransport%kosten%'
    AND slug != 'klaviertransport-kosten'
  ) OR (
    -- Catch 2026 version or any other year variant
    slug ILIKE 'klaviertransport-kosten-%'
  );
