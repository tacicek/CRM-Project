// Website Settings Types

export type SettingType = 'seo' | 'analytics' | 'google_ads' | 'social_ads' | 'cookie_consent' | 'general';

export interface WebsiteSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  setting_type: SettingType;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== SEO Settings =====
export interface SEOGlobalSettings {
  default_title_suffix: string;
  default_description: string;
  default_keywords: string[];
  robots_txt: string;
  canonical_base_url: string;
  enable_structured_data: boolean;
  structured_data_org: {
    "@type": string;
    name: string;
    description: string;
    url: string;
    logo: string;
    contactPoint: {
      "@type": string;
      telephone: string;
      contactType: string;
      availableLanguage: string[];
    };
    sameAs: string[];
  };
}

export interface SEOSocialSettings {
  og_site_name: string;
  og_type: string;
  og_image: string;
  og_image_width: number;
  og_image_height: number;
  twitter_card: string;
  twitter_site: string;
  twitter_creator: string;
}

// ===== Analytics Settings =====
export interface GoogleAnalyticsSettings {
  ga4_measurement_id: string;
  gtm_container_id: string;
  enable_ga4: boolean;
  enable_gtm: boolean;
  anonymize_ip: boolean;
  enable_enhanced_measurement: boolean;
  debug_mode: boolean;
}

// ===== Google Ads Settings =====
export interface GoogleAdsSettings {
  conversion_id: string;
  conversion_label_lead: string;
  conversion_label_signup: string;
  enable_remarketing: boolean;
  remarketing_tag_id: string;
  enable_enhanced_conversions: boolean;
  enhanced_conversions_fields: string[];
}

// ===== Social Ads Settings =====
export interface MetaAdsSettings {
  pixel_id: string;
  enable_pixel: boolean;
  enable_advanced_matching: boolean;
  track_page_view: boolean;
  track_lead: boolean;
  track_complete_registration: boolean;
  conversions_api_token: string;
}

export interface LinkedInAdsSettings {
  partner_id: string;
  enable_insight_tag: boolean;
  conversion_ids: {
    lead: string;
    signup: string;
  };
}

export interface TikTokAdsSettings {
  pixel_id: string;
  enable_pixel: boolean;
  events_api_access_token: string;
}

// ===== Cookie Consent Settings =====
export interface CookieCategory {
  name: string;
  description: string;
  required: boolean;
}

export interface CookieConsentSettings {
  enabled: boolean;
  position: 'bottom' | 'top' | 'bottom-left' | 'bottom-right';
  layout: 'banner' | 'modal' | 'popup';
  theme: 'light' | 'dark' | 'auto';
  primary_color: string;
  show_preferences_button: boolean;
  reject_all_button: boolean;
  privacy_policy_url: string;
  cookie_policy_url: string;
  imprint_url: string;
  consent_expiry_days: number;
  categories: {
    essential: CookieCategory;
    analytics: CookieCategory;
    marketing: CookieCategory;
    preferences: CookieCategory;
  };
  texts: {
    title: string;
    description: string;
    accept_all: string;
    reject_all: string;
    save_preferences: string;
    manage_preferences: string;
  };
}

// ===== Cookie Consent Log =====
export interface CookieConsentLog {
  id: string;
  visitor_id: string;
  consent_given: boolean;
  consent_categories: {
    essential: boolean;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
  };
  ip_address_hash?: string;
  user_agent?: string;
  consent_timestamp: string;
  withdrawal_timestamp?: string;
  created_at: string;
}

// ===== Form Data Types =====
export interface WebsiteSettingsFormData {
  seo_global: SEOGlobalSettings;
  seo_social: SEOSocialSettings;
  analytics_google: GoogleAnalyticsSettings;
  google_ads: GoogleAdsSettings;
  social_ads_meta: MetaAdsSettings;
  social_ads_linkedin: LinkedInAdsSettings;
  social_ads_tiktok: TikTokAdsSettings;
  cookie_consent: CookieConsentSettings;
}

// Default values
export const DEFAULT_SEO_GLOBAL: SEOGlobalSettings = {
  default_title_suffix: " | Offerio.ch - Offerten vergleichen",
  default_description: "Vergleichen Sie kostenlos Offerten von geprüften Schweizer Partnerfirmen.",
  default_keywords: ["Offerten vergleichen", "Schweiz"],
  robots_txt: "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /firma/",
  canonical_base_url: "https://offerio.ch",
  enable_structured_data: true,
  structured_data_org: {
    "@type": "Organization",
    name: "Offerio.ch",
    description: "Schweizer Offerte-Vergleichsportal",
    url: "https://offerio.ch",
    logo: "https://offerio.ch/logo.png",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "",
      contactType: "customer service",
      availableLanguage: ["German"],
    },
    sameAs: [],
  },
};

export const DEFAULT_COOKIE_CONSENT: CookieConsentSettings = {
  enabled: true,
  position: "bottom",
  layout: "banner",
  theme: "light",
  primary_color: "#2563eb",
  show_preferences_button: true,
  reject_all_button: true,
  privacy_policy_url: "/datenschutz",
  cookie_policy_url: "/cookies",
  imprint_url: "/impressum",
  consent_expiry_days: 365,
  categories: {
    essential: {
      name: "Notwendig",
      description: "Diese Cookies sind für die Grundfunktionen der Website erforderlich.",
      required: true,
    },
    analytics: {
      name: "Statistik",
      description: "Diese Cookies helfen uns zu verstehen, wie Besucher mit der Website interagieren.",
      required: false,
    },
    marketing: {
      name: "Marketing",
      description: "Diese Cookies werden verwendet, um Werbung relevanter zu gestalten.",
      required: false,
    },
    preferences: {
      name: "Präferenzen",
      description: "Diese Cookies ermöglichen erweiterte Funktionen und Personalisierung.",
      required: false,
    },
  },
  texts: {
    title: "Cookie-Einstellungen",
    description: "Wir verwenden Cookies, um Ihnen die bestmögliche Erfahrung zu bieten.",
    accept_all: "Alle akzeptieren",
    reject_all: "Alle ablehnen",
    save_preferences: "Auswahl speichern",
    manage_preferences: "Einstellungen verwalten",
  },
};

