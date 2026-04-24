-- Fix CSS specificity: global `p { color: #374151 }` was overriding hero's inherited white text.
-- Add scoped overrides so hero/cta text stays white.
UPDATE public.blog_posts
SET content = REPLACE(
  content,
  'p { margin-bottom: 18px; color: #374151; }',
  'p { margin-bottom: 18px; color: #374151; }
.hero p, .hero h1, .hero-subtitle, .hero-meta, .hero-meta span { color: #fff; }
.cta-box p { color: rgba(255,255,255,.85); }
.cta-box h2 { color: #fff; }'
),
  updated_at = NOW()
WHERE slug = 'klaviertransport-kosten';
