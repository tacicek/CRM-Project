-- ============================================
-- LANDING PAGES CMS SYSTEM
-- Migration: 20251228200001_landing_pages_system.sql
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Landing Pages Table
CREATE TABLE IF NOT EXISTS public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Page Identity
  slug TEXT UNIQUE NOT NULL,
  service_type TEXT NOT NULL,
  
  -- SEO Settings
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  seo_keywords TEXT[] DEFAULT '{}',
  canonical_url TEXT,
  og_image_url TEXT,
  
  -- Hero Section
  hero_title TEXT NOT NULL,
  hero_subtitle TEXT,
  hero_description TEXT,
  hero_image_url TEXT NOT NULL,
  hero_cta_text TEXT DEFAULT 'Jetzt Anfrage stellen',
  hero_cta_link TEXT DEFAULT '/anfrage',
  
  -- Content Sections (JSONB for flexibility)
  content_sections JSONB DEFAULT '[]'::jsonb,
  
  -- Shared Content References
  use_shared_content BOOLEAN DEFAULT true,
  faq_source TEXT DEFAULT 'global_faq',
  custom_faq JSONB,
  
  -- Side Section Configuration
  side_section_config JSONB DEFAULT '{}'::jsonb,
  
  -- Publishing
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Shared Content Components
CREATE TABLE IF NOT EXISTS public.shared_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  component_type TEXT NOT NULL,
  component_key TEXT UNIQUE NOT NULL,
  
  title TEXT,
  content JSONB NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page Analytics
CREATE TABLE IF NOT EXISTS public.landing_page_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  
  views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  avg_time_on_page INTEGER,
  
  date DATE NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(landing_page_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON public.landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_landing_pages_service ON public.landing_pages(service_type);
CREATE INDEX IF NOT EXISTS idx_landing_pages_published ON public.landing_pages(is_published);
CREATE INDEX IF NOT EXISTS idx_shared_content_type ON public.shared_content(component_type);
CREATE INDEX IF NOT EXISTS idx_shared_content_key ON public.shared_content(component_key);
CREATE INDEX IF NOT EXISTS idx_landing_page_analytics_page ON public.landing_page_analytics(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_analytics_date ON public.landing_page_analytics(date);

-- Enable RLS
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for landing_pages
CREATE POLICY "Public can view published landing pages"
  ON public.landing_pages
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage all landing pages"
  ON public.landing_pages
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies for shared_content
CREATE POLICY "Public can view active shared content"
  ON public.shared_content
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage shared content"
  ON public.shared_content
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies for landing_page_analytics
CREATE POLICY "Admins can view analytics"
  ON public.landing_page_analytics
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role can insert analytics"
  ON public.landing_page_analytics
  FOR INSERT
  WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_landing_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_landing_pages_timestamp
  BEFORE UPDATE ON public.landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_landing_pages_updated_at();

CREATE TRIGGER update_shared_content_timestamp
  BEFORE UPDATE ON public.shared_content
  FOR EACH ROW
  EXECUTE FUNCTION update_landing_pages_updated_at();

-- Insert default shared content (Global FAQ)
INSERT INTO public.shared_content (component_type, component_key, title, content)
VALUES (
  'faq',
  'global_faq',
  'Häufig gestellte Fragen',
  '{
    "items": [
      {
        "question": "Wie funktioniert Offerio.ch?",
        "answer": "<p>Beschreiben Sie Ihr Projekt in unserem Formular. Sie erhalten innerhalb von 24 Stunden bis zu 5 unverbindliche Offerten von geprüften Partnern.</p>",
        "category": "general",
        "order": 1
      },
      {
        "question": "Ist der Service kostenlos?",
        "answer": "<p>Ja, für Kunden ist unser Vergleichsservice komplett kostenlos und unverbindlich. Sie bezahlen nur den Auftrag, den Sie tatsächlich buchen.</p>",
        "category": "pricing",
        "order": 2
      },
      {
        "question": "Wie werden die Partner ausgewählt?",
        "answer": "<p>Alle Partner durchlaufen einen strengen Qualitätsprozess. Wir prüfen Referenzen, Versicherungen und Kundenbewertungen.</p>",
        "category": "quality",
        "order": 3
      },
      {
        "question": "Was passiert nach meiner Anfrage?",
        "answer": "<p>Nach Ihrer Anfrage werden passende Partner benachrichtigt. Diese melden sich direkt bei Ihnen mit individuellen Offerten.</p>",
        "category": "process",
        "order": 4
      },
      {
        "question": "Kann ich die Offerten vergleichen?",
        "answer": "<p>Ja, Sie erhalten alle Offerten übersichtlich und können Preise, Leistungen und Bewertungen direkt vergleichen.</p>",
        "category": "comparison",
        "order": 5
      }
    ]
  }'::jsonb
)
ON CONFLICT (component_key) DO NOTHING;

-- Insert service-specific FAQs
INSERT INTO public.shared_content (component_type, component_key, title, content)
VALUES 
(
  'faq',
  'moving_faq',
  'Häufig gestellte Fragen zum Umzug',
  '{
    "items": [
      {
        "question": "Wie viel kostet ein Umzug?",
        "answer": "<p>Die Kosten hängen von Faktoren wie Wohnungsgrösse, Distanz und gewünschten Leistungen ab. Eine 3-Zimmer-Wohnung kostet durchschnittlich CHF 1''500-3''000.</p>",
        "category": "pricing",
        "order": 1
      },
      {
        "question": "Wie lange dauert ein Umzug?",
        "answer": "<p>Ein durchschnittlicher Umzug einer 3-4 Zimmer Wohnung dauert etwa 4-8 Stunden. Bei grösseren Wohnungen oder langen Distanzen kann es länger dauern.</p>",
        "category": "duration",
        "order": 2
      },
      {
        "question": "Sind die Umzugsfirmen versichert?",
        "answer": "<p>Ja, alle unsere Partner sind vollständig versichert. Die Grundversicherung deckt Schäden bis CHF 20''000 ab.</p>",
        "category": "insurance",
        "order": 3
      },
      {
        "question": "Muss ich selbst packen?",
        "answer": "<p>Das hängt vom gewählten Service ab. Sie können einen Komplettservice buchen, bei dem auch das Verpacken übernommen wird.</p>",
        "category": "service",
        "order": 4
      },
      {
        "question": "Wie früh sollte ich buchen?",
        "answer": "<p>Wir empfehlen, mindestens 4-6 Wochen vor dem Umzugstermin zu buchen. Bei Monatsenden und im Sommer sollten Sie noch früher anfragen.</p>",
        "category": "booking",
        "order": 5
      }
    ]
  }'::jsonb
),
(
  'faq',
  'cleaning_faq',
  'Häufig gestellte Fragen zur Reinigung',
  '{
    "items": [
      {
        "question": "Was kostet eine Endreinigung?",
        "answer": "<p>Die Kosten für eine Endreinigung hängen von der Wohnungsgrösse ab. Rechnen Sie mit ca. CHF 30-50 pro Zimmer.</p>",
        "category": "pricing",
        "order": 1
      },
      {
        "question": "Ist die Abnahmegarantie inbegriffen?",
        "answer": "<p>Ja, alle unsere Partner bieten eine Abnahmegarantie. Falls die Verwaltung Mängel findet, wird kostenlos nachgereinigt.</p>",
        "category": "guarantee",
        "order": 2
      },
      {
        "question": "Was ist in der Endreinigung enthalten?",
        "answer": "<p>Eine vollständige Endreinigung umfasst alle Räume, Fenster, Küche (inkl. Backofen), Bad und alle Böden.</p>",
        "category": "service",
        "order": 3
      }
    ]
  }'::jsonb
),
(
  'faq',
  'renovation_faq',
  'Häufig gestellte Fragen zur Renovation',
  '{
    "items": [
      {
        "question": "Was kostet eine Wohnungsrenovation?",
        "answer": "<p>Die Kosten variieren stark je nach Umfang. Eine einfache Malerarbeit kostet CHF 15-25/m², eine Komplettrenovation CHF 500-1''500/m².</p>",
        "category": "pricing",
        "order": 1
      },
      {
        "question": "Wie lange dauert eine Renovation?",
        "answer": "<p>Eine einfache Malerarbeit dauert 2-5 Tage, eine umfassende Renovation kann 2-8 Wochen in Anspruch nehmen.</p>",
        "category": "duration",
        "order": 2
      }
    ]
  }'::jsonb
)
ON CONFLICT (component_key) DO NOTHING;

-- Insert default CTA section
INSERT INTO public.shared_content (component_type, component_key, title, content)
VALUES (
  'cta_section',
  'default_cta',
  'Jetzt loslegen',
  '{
    "headline": "Bereit für Ihr Projekt?",
    "subheadline": "Kostenlose Offerte in 2 Minuten",
    "cta_text": "Jetzt Anfrage stellen",
    "cta_link": "/anfrage",
    "background_color": "#2563eb"
  }'::jsonb
)
ON CONFLICT (component_key) DO NOTHING;

-- Grant permissions
GRANT ALL ON public.landing_pages TO authenticated;
GRANT ALL ON public.shared_content TO authenticated;
GRANT ALL ON public.landing_page_analytics TO authenticated;
GRANT SELECT ON public.landing_pages TO anon;
GRANT SELECT ON public.shared_content TO anon;

