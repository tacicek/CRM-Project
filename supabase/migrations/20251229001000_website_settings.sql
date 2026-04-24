-- Website Settings Migration
-- SEO, Analytics, Ads, and Cookie Consent Management

-- ============================================
-- WEBSITE SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.website_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  setting_type TEXT NOT NULL CHECK (setting_type IN ('seo', 'analytics', 'google_ads', 'social_ads', 'cookie_consent', 'general')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_website_settings_key ON public.website_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_website_settings_type ON public.website_settings(setting_type);

-- ============================================
-- COOKIE CONSENT LOG TABLE (for compliance)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cookie_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  consent_given BOOLEAN DEFAULT false,
  consent_categories JSONB DEFAULT '{"essential": true, "analytics": false, "marketing": false, "preferences": false}',
  ip_address_hash TEXT, -- Hashed for privacy
  user_agent TEXT,
  consent_timestamp TIMESTAMPTZ DEFAULT NOW(),
  withdrawal_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cookie_consent_visitor ON public.cookie_consent_log(visitor_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_timestamp ON public.cookie_consent_log(consent_timestamp);

-- ============================================
-- INSERT DEFAULT SETTINGS
-- ============================================

-- SEO Default Settings
INSERT INTO public.website_settings (setting_key, setting_value, setting_type, description) VALUES
('seo_global', '{
  "default_title_suffix": " | Offerio.ch - Offerten vergleichen",
  "default_description": "Vergleichen Sie kostenlos Offerten von geprüften Schweizer Partnerfirmen. Umzug, Reinigung, Renovation und mehr - jetzt anfragen!",
  "default_keywords": ["Offerten vergleichen", "Schweiz", "Umzug", "Reinigung", "kostenlos"],
  "robots_txt": "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /firma/\nDisallow: /auth\nSitemap: https://offerio.ch/sitemap.xml",
  "canonical_base_url": "https://offerio.ch",
  "enable_structured_data": true,
  "structured_data_org": {
    "@type": "Organization",
    "name": "Offerio.ch",
    "description": "Schweizer Offerte-Vergleichsportal",
    "url": "https://offerio.ch",
    "logo": "https://offerio.ch/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+41-XX-XXX-XX-XX",
      "contactType": "customer service",
      "availableLanguage": ["German", "French", "Italian"]
    },
    "sameAs": [
      "https://www.facebook.com/offerio.ch",
      "https://www.instagram.com/offerio.ch"
    ]
  }
}', 'seo', 'Global SEO settings and defaults')
ON CONFLICT (setting_key) DO NOTHING;

-- Social Meta Tags
INSERT INTO public.website_settings (setting_key, setting_value, setting_type, description) VALUES
('seo_social', '{
  "og_site_name": "Offerio.ch",
  "og_type": "website",
  "og_image": "https://offerio.ch/og-image.jpg",
  "og_image_width": 1200,
  "og_image_height": 630,
  "twitter_card": "summary_large_image",
  "twitter_site": "@offerio_ch",
  "twitter_creator": "@offerio_ch"
}', 'seo', 'Open Graph and Twitter Card settings')
ON CONFLICT (setting_key) DO NOTHING;

-- Analytics Settings
INSERT INTO public.website_settings (setting_key, setting_value, setting_type, description) VALUES
('analytics_google', '{
  "ga4_measurement_id": "",
  "gtm_container_id": "",
  "enable_ga4": false,
  "enable_gtm": false,
  "anonymize_ip": true,
  "enable_enhanced_measurement": true,
  "debug_mode": false
}', 'analytics', 'Google Analytics 4 and Tag Manager settings')
ON CONFLICT (setting_key) DO NOTHING;

-- Google Ads Settings
INSERT INTO public.website_settings (setting_key, setting_value, setting_type, description) VALUES
('google_ads', '{
  "conversion_id": "",
  "conversion_label_lead": "",
  "conversion_label_signup": "",
  "enable_remarketing": false,
  "remarketing_tag_id": "",
  "enable_enhanced_conversions": false,
  "enhanced_conversions_fields": ["email", "phone"]
}', 'google_ads', 'Google Ads conversion tracking settings')
ON CONFLICT (setting_key) DO NOTHING;

-- Facebook/Meta Ads Settings
INSERT INTO public.website_settings (setting_key, setting_value, setting_type, description) VALUES
('social_ads_meta', '{
  "pixel_id": "",
  "enable_pixel": false,
  "enable_advanced_matching": true,
  "track_page_view": true,
  "track_lead": true,
  "track_complete_registration": true,
  "conversions_api_token": ""
}', 'social_ads', 'Facebook/Meta Pixel and Conversions API settings')
ON CONFLICT (setting_key) DO NOTHING;

-- LinkedIn Ads Settings
INSERT INTO public.website_settings (setting_key, setting_value, setting_type, description) VALUES
('social_ads_linkedin', '{
  "partner_id": "",
  "enable_insight_tag": false,
  "conversion_ids": {
    "lead": "",
    "signup": ""
  }
}', 'social_ads', 'LinkedIn Insight Tag and conversion tracking')
ON CONFLICT (setting_key) DO NOTHING;

-- TikTok Ads Settings
INSERT INTO public.website_settings (setting_key, setting_value, setting_type, description) VALUES
('social_ads_tiktok', '{
  "pixel_id": "",
  "enable_pixel": false,
  "events_api_access_token": ""
}', 'social_ads', 'TikTok Pixel settings')
ON CONFLICT (setting_key) DO NOTHING;

-- Cookie Consent Settings
INSERT INTO public.website_settings (setting_key, setting_value, setting_type, description) VALUES
('cookie_consent', '{
  "enabled": true,
  "position": "bottom",
  "layout": "banner",
  "theme": "light",
  "primary_color": "#2563eb",
  "show_preferences_button": true,
  "reject_all_button": true,
  "privacy_policy_url": "/datenschutz",
  "cookie_policy_url": "/cookies",
  "imprint_url": "/impressum",
  "consent_expiry_days": 365,
  "categories": {
    "essential": {
      "name": "Notwendig",
      "description": "Diese Cookies sind für die Grundfunktionen der Website erforderlich.",
      "required": true
    },
    "analytics": {
      "name": "Statistik",
      "description": "Diese Cookies helfen uns zu verstehen, wie Besucher mit der Website interagieren.",
      "required": false
    },
    "marketing": {
      "name": "Marketing",
      "description": "Diese Cookies werden verwendet, um Werbung relevanter zu gestalten.",
      "required": false
    },
    "preferences": {
      "name": "Präferenzen",
      "description": "Diese Cookies ermöglichen erweiterte Funktionen und Personalisierung.",
      "required": false
    }
  },
  "texts": {
    "title": "Cookie-Einstellungen",
    "description": "Wir verwenden Cookies, um Ihnen die bestmögliche Erfahrung zu bieten. Einige sind notwendig, andere helfen uns, die Website zu verbessern.",
    "accept_all": "Alle akzeptieren",
    "reject_all": "Alle ablehnen",
    "save_preferences": "Auswahl speichern",
    "manage_preferences": "Einstellungen verwalten"
  }
}', 'cookie_consent', 'Cookie banner and consent management settings')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cookie_consent_log ENABLE ROW LEVEL SECURITY;

-- Allow read access for all (settings are public)
CREATE POLICY "website_settings_public_read" ON public.website_settings
  FOR SELECT USING (true);

-- Only admins can modify settings
CREATE POLICY "website_settings_admin_write" ON public.website_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- Cookie consent log - public insert (visitors), admin read
CREATE POLICY "cookie_consent_public_insert" ON public.cookie_consent_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "cookie_consent_admin_read" ON public.cookie_consent_log
  FOR SELECT USING (public.is_admin(auth.uid()));

-- ============================================
-- UPDATE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_website_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER website_settings_updated_at
  BEFORE UPDATE ON public.website_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_website_settings_timestamp();

