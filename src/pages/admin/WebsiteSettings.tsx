import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  BarChart3,
  Target,
  Share2,
  Cookie,
  Save,
  RefreshCw,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Sanitize text input to prevent XSS
 */
function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

/**
 * Sanitize robots.txt content - allow newlines but prevent script injection
 */
function sanitizeRobotsTxt(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  if (!url) return true; // Empty is valid (optional)
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate hex color format
 */
function isValidHexColor(color: string): boolean {
  if (!color) return false;
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Safely parse integer with bounds
 */
function safeParseInt(value: string, fallback: number, min = 0, max = Infinity): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || !isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Parse comma-separated string to array, filtering empty values
 */
function parseCommaSeparated(value: string): string[] {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Validate GA4 Measurement ID format
 */
function isValidGA4Id(id: string): boolean {
  if (!id) return true; // Empty is valid
  return /^G-[A-Z0-9]+$/i.test(id);
}

/**
 * Validate GTM Container ID format
 */
function isValidGTMId(id: string): boolean {
  if (!id) return true; // Empty is valid
  return /^GTM-[A-Z0-9]+$/i.test(id);
}

/**
 * Type guard for setting value
 */
function isValidSettingValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * User-friendly error messages
 */
function getUserFriendlyError(error: unknown): string {
  if (!error) return 'Ein unbekannter Fehler ist aufgetreten.';
  
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.';
  }
  if (message.includes('permission') || message.includes('policy')) {
    return 'Sie haben keine Berechtigung für diese Aktion.';
  }
  if (message.includes('duplicate') || message.includes('unique')) {
    return 'Diese Einstellung existiert bereits.';
  }
  
  return 'Fehler beim Speichern. Bitte versuchen Sie es erneut.';
}
import type {
  SEOGlobalSettings,
  SEOSocialSettings,
  GoogleAnalyticsSettings,
  GoogleAdsSettings,
  MetaAdsSettings,
  LinkedInAdsSettings,
  TikTokAdsSettings,
  CookieConsentSettings,
} from "@/types/websiteSettings";

// Default values inline to avoid circular import
const defaultSeoGlobal: SEOGlobalSettings = {
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

const defaultSeoSocial: SEOSocialSettings = {
  og_site_name: "Offerio.ch",
  og_type: "website",
  og_image: "",
  og_image_width: 1200,
  og_image_height: 630,
  twitter_card: "summary_large_image",
  twitter_site: "",
  twitter_creator: "",
};

const defaultAnalytics: GoogleAnalyticsSettings = {
  ga4_measurement_id: "",
  gtm_container_id: "",
  enable_ga4: false,
  enable_gtm: false,
  anonymize_ip: true,
  enable_enhanced_measurement: true,
  debug_mode: false,
};

const defaultGoogleAds: GoogleAdsSettings = {
  conversion_id: "",
  conversion_label_lead: "",
  conversion_label_signup: "",
  enable_remarketing: false,
  remarketing_tag_id: "",
  enable_enhanced_conversions: false,
  enhanced_conversions_fields: ["email", "phone"],
};

const defaultMetaAds: MetaAdsSettings = {
  pixel_id: "",
  enable_pixel: false,
  enable_advanced_matching: true,
  track_page_view: true,
  track_lead: true,
  track_complete_registration: true,
  conversions_api_token: "",
};

const defaultLinkedInAds: LinkedInAdsSettings = {
  partner_id: "",
  enable_insight_tag: false,
  conversion_ids: { lead: "", signup: "" },
};

const defaultTikTokAds: TikTokAdsSettings = {
  pixel_id: "",
  enable_pixel: false,
  events_api_access_token: "",
};

const defaultCookieConsent: CookieConsentSettings = {
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

export default function WebsiteSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("seo");
  const [showSecrets, setShowSecrets] = useState(false);

  // Settings state
  const [seoGlobal, setSeoGlobal] = useState<SEOGlobalSettings>(defaultSeoGlobal);
  const [seoSocial, setSeoSocial] = useState<SEOSocialSettings>(defaultSeoSocial);
  const [analytics, setAnalytics] = useState<GoogleAnalyticsSettings>(defaultAnalytics);
  const [googleAds, setGoogleAds] = useState<GoogleAdsSettings>(defaultGoogleAds);
  const [metaAds, setMetaAds] = useState<MetaAdsSettings>(defaultMetaAds);
  const [linkedInAds, setLinkedInAds] = useState<LinkedInAdsSettings>(defaultLinkedInAds);
  const [tikTokAds, setTikTokAds] = useState<TikTokAdsSettings>(defaultTikTokAds);
  const [cookieConsent, setCookieConsent] = useState<CookieConsentSettings>(defaultCookieConsent);
  
  // Track original values for unsaved changes detection
  const [originalSettings, setOriginalSettings] = useState<string>('');
  
  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Refs for async safety
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);
  
  // Compute current settings hash for comparison
  const currentSettingsHash = useMemo(() => {
    return JSON.stringify({
      seoGlobal, seoSocial, analytics, googleAds, metaAds, linkedInAds, tikTokAds, cookieConsent
    });
  }, [seoGlobal, seoSocial, analytics, googleAds, metaAds, linkedInAds, tikTokAds, cookieConsent]);
  
  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return originalSettings !== '' && originalSettings !== currentSettingsHash;
  }, [originalSettings, currentSettingsHash]);
  
  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchSettings = useCallback(async () => {
    // Cancel any previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setValidationErrors({});
      
      const { data, error } = await supabase
        .from("website_settings")
        .select("*")
        .eq("is_active", true);

      if (!isMountedRef.current) return;
      if (error) throw error;

      if (data && Array.isArray(data)) {
        const loaded = {
          seoGlobal: { ...defaultSeoGlobal },
          seoSocial: { ...defaultSeoSocial },
          analytics: { ...defaultAnalytics },
          googleAds: { ...defaultGoogleAds },
          metaAds: { ...defaultMetaAds },
          linkedInAds: { ...defaultLinkedInAds },
          tikTokAds: { ...defaultTikTokAds },
          cookieConsent: { ...defaultCookieConsent },
        };

        data.forEach((setting) => {
          // Type-safe validation of setting value
          const value = setting.setting_value;
          if (!isValidSettingValue(value)) {
            return; // Skip invalid settings
          }
          
          switch (setting.setting_key) {
            case "seo_global":
              loaded.seoGlobal = { ...loaded.seoGlobal, ...value };
              break;
            case "seo_social":
              loaded.seoSocial = { ...loaded.seoSocial, ...value };
              break;
            case "analytics_google":
              loaded.analytics = { ...loaded.analytics, ...value };
              break;
            case "google_ads":
              loaded.googleAds = { ...loaded.googleAds, ...value };
              break;
            case "social_ads_meta":
              loaded.metaAds = { ...loaded.metaAds, ...value };
              break;
            case "social_ads_linkedin":
              loaded.linkedInAds = { ...loaded.linkedInAds, ...value };
              break;
            case "social_ads_tiktok":
              loaded.tikTokAds = { ...loaded.tikTokAds, ...value };
              break;
            case "cookie_consent":
              loaded.cookieConsent = { ...loaded.cookieConsent, ...value };
              break;
          }
        });

        setSeoGlobal(loaded.seoGlobal);
        setSeoSocial(loaded.seoSocial);
        setAnalytics(loaded.analytics);
        setGoogleAds(loaded.googleAds);
        setMetaAds(loaded.metaAds);
        setLinkedInAds(loaded.linkedInAds);
        setTikTokAds(loaded.tikTokAds);
        setCookieConsent(loaded.cookieConsent);
        setOriginalSettings(JSON.stringify(loaded));
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      // Don't show error for aborted requests
      if (error instanceof Error && error.name === 'AbortError') return;
      
      toast.error(getUserFriendlyError(error));
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchSettings();
     
  }, [fetchSettings]); // Only run on mount

  /**
   * Validate all settings before saving
   */
  const validateSettings = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    
    // URL validations
    if (seoGlobal.canonical_base_url && !isValidUrl(seoGlobal.canonical_base_url)) {
      errors.canonical_base_url = 'Ungültige URL';
    }
    if (seoSocial.og_image && !isValidUrl(seoSocial.og_image)) {
      errors.og_image = 'Ungültige Bild-URL';
    }
    if (seoGlobal.structured_data_org.logo && !isValidUrl(seoGlobal.structured_data_org.logo)) {
      errors.logo = 'Ungültige Logo-URL';
    }
    
    // GA4/GTM ID validations
    if (analytics.enable_ga4 && analytics.ga4_measurement_id && !isValidGA4Id(analytics.ga4_measurement_id)) {
      errors.ga4_measurement_id = 'Ungültiges Format (G-XXXXXXXXXX)';
    }
    if (analytics.enable_gtm && analytics.gtm_container_id && !isValidGTMId(analytics.gtm_container_id)) {
      errors.gtm_container_id = 'Ungültiges Format (GTM-XXXXXXX)';
    }
    
    // Hex color validation
    if (cookieConsent.primary_color && !isValidHexColor(cookieConsent.primary_color)) {
      errors.primary_color = 'Ungültiges Farbformat (#XXXXXX)';
    }
    
    // Cookie consent expiry validation
    if (cookieConsent.consent_expiry_days < 1 || cookieConsent.consent_expiry_days > 730) {
      errors.consent_expiry_days = 'Muss zwischen 1 und 730 Tagen liegen';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [seoGlobal, seoSocial, analytics, cookieConsent]);

  const saveSetting = async (key: string, value: Record<string, unknown>, type: string): Promise<void> => {
    const { error } = await supabase
      .from("website_settings")
      .upsert(
        {
          setting_key: key,
          setting_value: value,
          setting_type: type,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_key" }
      );

    if (error) throw error;
  };

  const handleSave = useCallback(async () => {
    // Prevent double save
    if (saving) return;
    
    // Validate before saving
    if (!validateSettings()) {
      toast.error("Bitte korrigieren Sie die Validierungsfehler");
      return;
    }
    
    setSaving(true);
    
    // Prepare sanitized data
    const settingsToSave = [
      { 
        key: "seo_global", 
        value: {
          ...seoGlobal,
          default_title_suffix: sanitizeText(seoGlobal.default_title_suffix),
          default_description: sanitizeText(seoGlobal.default_description),
          robots_txt: sanitizeRobotsTxt(seoGlobal.robots_txt),
          canonical_base_url: seoGlobal.canonical_base_url.trim(),
          default_keywords: seoGlobal.default_keywords.filter(k => k.trim().length > 0),
          structured_data_org: {
            ...seoGlobal.structured_data_org,
            name: sanitizeText(seoGlobal.structured_data_org.name),
            sameAs: seoGlobal.structured_data_org.sameAs.filter(s => s.trim().length > 0),
          }
        } as unknown as Record<string, unknown>, 
        type: "seo" 
      },
      { key: "seo_social", value: seoSocial as unknown as Record<string, unknown>, type: "seo" },
      { key: "analytics_google", value: analytics as unknown as Record<string, unknown>, type: "analytics" },
      { key: "google_ads", value: googleAds as unknown as Record<string, unknown>, type: "google_ads" },
      { key: "social_ads_meta", value: metaAds as unknown as Record<string, unknown>, type: "social_ads" },
      { key: "social_ads_linkedin", value: linkedInAds as unknown as Record<string, unknown>, type: "social_ads" },
      { key: "social_ads_tiktok", value: tikTokAds as unknown as Record<string, unknown>, type: "social_ads" },
      { key: "cookie_consent", value: cookieConsent as unknown as Record<string, unknown>, type: "cookie_consent" },
    ];
    
    // Save sequentially to allow for partial success tracking
    const failedSettings: string[] = [];
    
    try {
      for (const setting of settingsToSave) {
        try {
          await saveSetting(setting.key, setting.value, setting.type);
        } catch (_err) {
          failedSettings.push(setting.key);
        }
      }
      
      if (!isMountedRef.current) return;
      
      if (failedSettings.length === 0) {
        toast.success("Einstellungen erfolgreich gespeichert!");
        // Update original settings hash
        setOriginalSettings(currentSettingsHash);
      } else if (failedSettings.length < settingsToSave.length) {
        toast.warning(`Teilweise gespeichert. Fehler bei: ${failedSettings.join(', ')}`);
      } else {
        toast.error("Fehler beim Speichern aller Einstellungen");
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error(getUserFriendlyError(error));
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }, [saving, validateSettings, seoGlobal, seoSocial, analytics, googleAds, metaAds, linkedInAds, tikTokAds, cookieConsent, currentSettingsHash]);

  const getStatusBadge = (isActive: boolean, label: string) => (
    <Badge variant={isActive ? "default" : "secondary"} className="gap-1">
      {isActive ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </Badge>
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Helmet>
        <title>Website Einstellungen | Admin</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Website Einstellungen</h1>
            <p className="text-muted-foreground mt-1">
              SEO, Analytics, Werbung und Cookie-Einstellungen verwalten
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Unsaved changes indicator */}
            {hasUnsavedChanges && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Ungespeichert
              </Badge>
            )}
            
            <Button 
              variant="outline" 
              onClick={fetchSettings} 
              disabled={loading}
              aria-label="Einstellungen aktualisieren"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !hasUnsavedChanges}
              aria-busy={saving}
              aria-label="Einstellungen speichern"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
          </div>
        </div>
        
        {/* Validation Errors Alert */}
        {Object.keys(validationErrors).length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Es gibt {Object.keys(validationErrors).length} Validierungsfehler. 
              Bitte korrigieren Sie diese vor dem Speichern.
            </AlertDescription>
          </Alert>
        )}

        {/* Status Overview */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4">
              {getStatusBadge(analytics.enable_ga4 || analytics.enable_gtm, "Analytics")}
              {getStatusBadge(!!googleAds.conversion_id, "Google Ads")}
              {getStatusBadge(metaAds.enable_pixel, "Meta Pixel")}
              {getStatusBadge(linkedInAds.enable_insight_tag, "LinkedIn")}
              {getStatusBadge(tikTokAds.enable_pixel, "TikTok")}
              {getStatusBadge(cookieConsent.enabled, "Cookie Banner")}
            </div>
          </CardContent>
        </Card>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="seo" className="gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">SEO</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="google-ads" className="gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Google Ads</span>
            </TabsTrigger>
            <TabsTrigger value="social-ads" className="gap-2">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Social Ads</span>
            </TabsTrigger>
            <TabsTrigger value="cookies" className="gap-2">
              <Cookie className="h-4 w-4" />
              <span className="hidden sm:inline">Cookies</span>
            </TabsTrigger>
          </TabsList>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-6">
            {/* Global SEO Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Globale SEO-Einstellungen
                </CardTitle>
                <CardDescription>
                  Standard Meta-Tags und Basis-Konfiguration für alle Seiten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Standard Titel-Suffix</Label>
                    <Input
                      value={seoGlobal.default_title_suffix}
                      onChange={(e) =>
                        setSeoGlobal({ ...seoGlobal, default_title_suffix: e.target.value })
                      }
                      placeholder=" | Offerio.ch"
                    />
                    <p className="text-xs text-muted-foreground">
                      Wird an jeden Seitentitel angehängt
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Standard Meta-Beschreibung</Label>
                    <Textarea
                      value={seoGlobal.default_description}
                      onChange={(e) =>
                        setSeoGlobal({ ...seoGlobal, default_description: e.target.value })
                      }
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      {seoGlobal.default_description.length}/160 Zeichen
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default-keywords">Standard Keywords</Label>
                    <Input
                      id="default-keywords"
                      value={seoGlobal.default_keywords.join(", ")}
                      onChange={(e) =>
                        setSeoGlobal({
                          ...seoGlobal,
                          default_keywords: parseCommaSeparated(e.target.value.length > 0 ? e.target.value : ''),
                        })
                      }
                      placeholder="Offerten, Schweiz, vergleichen"
                      aria-describedby="keywords-hint"
                    />
                    <p id="keywords-hint" className="text-xs text-muted-foreground">
                      Kommagetrennte Liste von Keywords
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="canonical-url">Kanonische Basis-URL</Label>
                    <Input
                      id="canonical-url"
                      value={seoGlobal.canonical_base_url}
                      onChange={(e) =>
                        setSeoGlobal({ ...seoGlobal, canonical_base_url: e.target.value })
                      }
                      placeholder="https://offerio.ch"
                      aria-invalid={!!validationErrors.canonical_base_url}
                      aria-describedby={validationErrors.canonical_base_url ? "canonical-url-error" : undefined}
                    />
                    {validationErrors.canonical_base_url && (
                      <p id="canonical-url-error" className="text-sm text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {validationErrors.canonical_base_url}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>robots.txt Inhalt</Label>
                  <Textarea
                    value={seoGlobal.robots_txt}
                    onChange={(e) =>
                      setSeoGlobal({ ...seoGlobal, robots_txt: e.target.value })
                    }
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Strukturierte Daten (Schema.org)</Label>
                    <p className="text-sm text-muted-foreground">
                      JSON-LD für bessere Suchergebnisse aktivieren
                    </p>
                  </div>
                  <Switch
                    checked={seoGlobal.enable_structured_data}
                    onCheckedChange={(checked) =>
                      setSeoGlobal({ ...seoGlobal, enable_structured_data: checked })
                    }
                  />
                </div>

                {seoGlobal.enable_structured_data && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="org-data">
                      <AccordionTrigger>Organisation Schema bearbeiten</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Unternehmensname</Label>
                            <Input
                              value={seoGlobal.structured_data_org.name}
                              onChange={(e) =>
                                setSeoGlobal({
                                  ...seoGlobal,
                                  structured_data_org: {
                                    ...seoGlobal.structured_data_org,
                                    name: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Telefonnummer</Label>
                            <Input
                              value={seoGlobal.structured_data_org.contactPoint.telephone}
                              onChange={(e) =>
                                setSeoGlobal({
                                  ...seoGlobal,
                                  structured_data_org: {
                                    ...seoGlobal.structured_data_org,
                                    contactPoint: {
                                      ...seoGlobal.structured_data_org.contactPoint,
                                      telephone: e.target.value,
                                    },
                                  },
                                })
                              }
                              placeholder="+41 XX XXX XX XX"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Logo URL</Label>
                            <Input
                              value={seoGlobal.structured_data_org.logo}
                              onChange={(e) =>
                                setSeoGlobal({
                                  ...seoGlobal,
                                  structured_data_org: {
                                    ...seoGlobal.structured_data_org,
                                    logo: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="social-links">Social Media Links</Label>
                            <Input
                              id="social-links"
                              value={seoGlobal.structured_data_org.sameAs.join(", ")}
                              onChange={(e) =>
                                setSeoGlobal({
                                  ...seoGlobal,
                                  structured_data_org: {
                                    ...seoGlobal.structured_data_org,
                                    sameAs: parseCommaSeparated(e.target.value),
                                  },
                                })
                              }
                              placeholder="https://facebook.com/..., https://linkedin.com/..."
                              aria-describedby="social-links-hint"
                            />
                            <p id="social-links-hint" className="text-xs text-muted-foreground">
                              Kommagetrennte Liste von URLs
                            </p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </CardContent>
            </Card>

            {/* Social Meta Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Social Media Meta-Tags
                </CardTitle>
                <CardDescription>
                  Open Graph und Twitter Card Einstellungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Site Name (og:site_name)</Label>
                    <Input
                      value={seoSocial.og_site_name}
                      onChange={(e) =>
                        setSeoSocial({ ...seoSocial, og_site_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type (og:type)</Label>
                    <Select
                      value={seoSocial.og_type}
                      onValueChange={(value) =>
                        setSeoSocial({ ...seoSocial, og_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="website">website</SelectItem>
                        <SelectItem value="article">article</SelectItem>
                        <SelectItem value="business.business">business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Standard Social Image URL</Label>
                    <Input
                      value={seoSocial.og_image}
                      onChange={(e) =>
                        setSeoSocial({ ...seoSocial, og_image: e.target.value })
                      }
                      placeholder="https://offerio.ch/og-image.jpg"
                    />
                    <p className="text-xs text-muted-foreground">
                      Empfohlen: 1200x630 Pixel
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Twitter Card Type</Label>
                    <Select
                      value={seoSocial.twitter_card}
                      onValueChange={(value) =>
                        setSeoSocial({ ...seoSocial, twitter_card: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="summary">summary</SelectItem>
                        <SelectItem value="summary_large_image">summary_large_image</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Twitter @username</Label>
                    <Input
                      value={seoSocial.twitter_site}
                      onChange={(e) =>
                        setSeoSocial({ ...seoSocial, twitter_site: e.target.value })
                      }
                      placeholder="@offerio"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Google Analytics & Tag Manager
                    </CardTitle>
                    <CardDescription>
                      Traffic-Analyse und Event-Tracking konfigurieren
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSecrets(!showSecrets)}
                  >
                    {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* GA4 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Google Analytics 4</Label>
                      <p className="text-sm text-muted-foreground">
                        Website-Traffic und Nutzerverhalten analysieren
                      </p>
                    </div>
                    <Switch
                      checked={analytics.enable_ga4}
                      onCheckedChange={(checked) =>
                        setAnalytics({ ...analytics, enable_ga4: checked })
                      }
                    />
                  </div>

                  {analytics.enable_ga4 && (
                    <div className="ml-4 space-y-4 border-l-2 pl-4">
                      <div className="space-y-2">
                        <Label htmlFor="ga4-id">Measurement ID</Label>
                        <Input
                          id="ga4-id"
                          type={showSecrets ? "text" : "password"}
                          value={analytics.ga4_measurement_id}
                          onChange={(e) =>
                            setAnalytics({ ...analytics, ga4_measurement_id: e.target.value.toUpperCase() })
                          }
                          placeholder="G-XXXXXXXXXX"
                          aria-invalid={!!validationErrors.ga4_measurement_id}
                          aria-describedby={validationErrors.ga4_measurement_id ? "ga4-id-error" : "ga4-id-hint"}
                        />
                        {validationErrors.ga4_measurement_id ? (
                          <p id="ga4-id-error" className="text-sm text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {validationErrors.ga4_measurement_id}
                          </p>
                        ) : (
                          <p id="ga4-id-hint" className="text-xs text-muted-foreground">
                            Format: G-XXXXXXXXXX
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>IP-Anonymisierung</Label>
                        <Switch
                          checked={analytics.anonymize_ip}
                          onCheckedChange={(checked) =>
                            setAnalytics({ ...analytics, anonymize_ip: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Erweiterte Messung</Label>
                        <Switch
                          checked={analytics.enable_enhanced_measurement}
                          onCheckedChange={(checked) =>
                            setAnalytics({ ...analytics, enable_enhanced_measurement: checked })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* GTM */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Google Tag Manager</Label>
                      <p className="text-sm text-muted-foreground">
                        Zentrale Tag-Verwaltung für alle Tracking-Codes
                      </p>
                    </div>
                    <Switch
                      checked={analytics.enable_gtm}
                      onCheckedChange={(checked) =>
                        setAnalytics({ ...analytics, enable_gtm: checked })
                      }
                    />
                  </div>

                  {analytics.enable_gtm && (
                    <div className="ml-4 space-y-4 border-l-2 pl-4">
                      <div className="space-y-2">
                        <Label htmlFor="gtm-id">Container ID</Label>
                        <Input
                          id="gtm-id"
                          type={showSecrets ? "text" : "password"}
                          value={analytics.gtm_container_id}
                          onChange={(e) =>
                            setAnalytics({ ...analytics, gtm_container_id: e.target.value.toUpperCase() })
                          }
                          placeholder="GTM-XXXXXXX"
                          aria-invalid={!!validationErrors.gtm_container_id}
                          aria-describedby={validationErrors.gtm_container_id ? "gtm-id-error" : "gtm-id-hint"}
                        />
                        {validationErrors.gtm_container_id ? (
                          <p id="gtm-id-error" className="text-sm text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {validationErrors.gtm_container_id}
                          </p>
                        ) : (
                          <p id="gtm-id-hint" className="text-xs text-muted-foreground">
                            Format: GTM-XXXXXXX
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Debug-Modus</Label>
                    <p className="text-sm text-muted-foreground">
                      Console-Logging für Entwicklung aktivieren
                    </p>
                  </div>
                  <Switch
                    checked={analytics.debug_mode}
                    onCheckedChange={(checked) =>
                      setAnalytics({ ...analytics, debug_mode: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Google Ads Tab */}
          <TabsContent value="google-ads" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Google Ads Conversion Tracking
                    </CardTitle>
                    <CardDescription>
                      Conversions für Google Ads Kampagnen messen
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSecrets(!showSecrets)}
                  >
                    {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Conversion ID</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={googleAds.conversion_id}
                      onChange={(e) =>
                        setGoogleAds({ ...googleAds, conversion_id: e.target.value })
                      }
                      placeholder="AW-XXXXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conversion Label (Lead)</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={googleAds.conversion_label_lead}
                      onChange={(e) =>
                        setGoogleAds({ ...googleAds, conversion_label_lead: e.target.value })
                      }
                      placeholder="XXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conversion Label (Signup)</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={googleAds.conversion_label_signup}
                      onChange={(e) =>
                        setGoogleAds({ ...googleAds, conversion_label_signup: e.target.value })
                      }
                      placeholder="XXXXXXX"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Remarketing</Label>
                      <p className="text-sm text-muted-foreground">
                        Remarketing-Tags für Zielgruppen aktivieren
                      </p>
                    </div>
                    <Switch
                      checked={googleAds.enable_remarketing}
                      onCheckedChange={(checked) =>
                        setGoogleAds({ ...googleAds, enable_remarketing: checked })
                      }
                    />
                  </div>

                  {googleAds.enable_remarketing && (
                    <div className="ml-4 space-y-4 border-l-2 pl-4">
                      <div className="space-y-2">
                        <Label>Remarketing Tag ID</Label>
                        <Input
                          type={showSecrets ? "text" : "password"}
                          value={googleAds.remarketing_tag_id}
                          onChange={(e) =>
                            setGoogleAds({ ...googleAds, remarketing_tag_id: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enhanced Conversions</Label>
                    <p className="text-sm text-muted-foreground">
                      Verbesserte Conversion-Messung mit gehashten Nutzerdaten
                    </p>
                  </div>
                  <Switch
                    checked={googleAds.enable_enhanced_conversions}
                    onCheckedChange={(checked) =>
                      setGoogleAds({ ...googleAds, enable_enhanced_conversions: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Ads Tab */}
          <TabsContent value="social-ads" className="space-y-6">
            {/* Meta/Facebook */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Meta (Facebook & Instagram)
                </CardTitle>
                <CardDescription>
                  Facebook Pixel und Conversions API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Meta Pixel aktivieren</Label>
                    <p className="text-sm text-muted-foreground">
                      Tracking für Facebook und Instagram Ads
                    </p>
                  </div>
                  <Switch
                    checked={metaAds.enable_pixel}
                    onCheckedChange={(checked) =>
                      setMetaAds({ ...metaAds, enable_pixel: checked })
                    }
                  />
                </div>

                {metaAds.enable_pixel && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Pixel ID</Label>
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={metaAds.pixel_id}
                        onChange={(e) =>
                          setMetaAds({ ...metaAds, pixel_id: e.target.value })
                        }
                        placeholder="XXXXXXXXXXXXXXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Conversions API Access Token (optional)</Label>
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={metaAds.conversions_api_token}
                        onChange={(e) =>
                          setMetaAds({ ...metaAds, conversions_api_token: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between">
                        <Label>Advanced Matching</Label>
                        <Switch
                          checked={metaAds.enable_advanced_matching}
                          onCheckedChange={(checked) =>
                            setMetaAds({ ...metaAds, enable_advanced_matching: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>PageView tracken</Label>
                        <Switch
                          checked={metaAds.track_page_view}
                          onCheckedChange={(checked) =>
                            setMetaAds({ ...metaAds, track_page_view: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Lead tracken</Label>
                        <Switch
                          checked={metaAds.track_lead}
                          onCheckedChange={(checked) =>
                            setMetaAds({ ...metaAds, track_lead: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Registration tracken</Label>
                        <Switch
                          checked={metaAds.track_complete_registration}
                          onCheckedChange={(checked) =>
                            setMetaAds({ ...metaAds, track_complete_registration: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* LinkedIn */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  LinkedIn
                </CardTitle>
                <CardDescription>
                  LinkedIn Insight Tag für B2B-Marketing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">LinkedIn Insight Tag aktivieren</Label>
                    <p className="text-sm text-muted-foreground">
                      Tracking für LinkedIn Ads Kampagnen
                    </p>
                  </div>
                  <Switch
                    checked={linkedInAds.enable_insight_tag}
                    onCheckedChange={(checked) =>
                      setLinkedInAds({ ...linkedInAds, enable_insight_tag: checked })
                    }
                  />
                </div>

                {linkedInAds.enable_insight_tag && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Partner ID</Label>
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={linkedInAds.partner_id}
                        onChange={(e) =>
                          setLinkedInAds({ ...linkedInAds, partner_id: e.target.value })
                        }
                        placeholder="XXXXXXX"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Conversion ID (Lead)</Label>
                        <Input
                          type={showSecrets ? "text" : "password"}
                          value={linkedInAds.conversion_ids.lead}
                          onChange={(e) =>
                            setLinkedInAds({
                              ...linkedInAds,
                              conversion_ids: { ...linkedInAds.conversion_ids, lead: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Conversion ID (Signup)</Label>
                        <Input
                          type={showSecrets ? "text" : "password"}
                          value={linkedInAds.conversion_ids.signup}
                          onChange={(e) =>
                            setLinkedInAds({
                              ...linkedInAds,
                              conversion_ids: { ...linkedInAds.conversion_ids, signup: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* TikTok */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                  TikTok
                </CardTitle>
                <CardDescription>
                  TikTok Pixel für Gen-Z Marketing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">TikTok Pixel aktivieren</Label>
                    <p className="text-sm text-muted-foreground">
                      Tracking für TikTok Ads Kampagnen
                    </p>
                  </div>
                  <Switch
                    checked={tikTokAds.enable_pixel}
                    onCheckedChange={(checked) =>
                      setTikTokAds({ ...tikTokAds, enable_pixel: checked })
                    }
                  />
                </div>

                {tikTokAds.enable_pixel && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Pixel ID</Label>
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={tikTokAds.pixel_id}
                        onChange={(e) =>
                          setTikTokAds({ ...tikTokAds, pixel_id: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Events API Access Token (optional)</Label>
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={tikTokAds.events_api_access_token}
                        onChange={(e) =>
                          setTikTokAds({ ...tikTokAds, events_api_access_token: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cookie Consent Tab */}
          <TabsContent value="cookies" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cookie className="h-5 w-5" />
                  Cookie Banner Einstellungen
                </CardTitle>
                <CardDescription>
                  DSGVO/DSG-konforme Cookie-Einwilligung verwalten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Cookie Banner aktivieren</Label>
                    <p className="text-sm text-muted-foreground">
                      Zeigt den Cookie-Hinweis für neue Besucher
                    </p>
                  </div>
                  <Switch
                    checked={cookieConsent.enabled}
                    onCheckedChange={(checked) =>
                      setCookieConsent({ ...cookieConsent, enabled: checked })
                    }
                  />
                </div>

                {cookieConsent.enabled && (
                  <>
                    <Separator />

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Position</Label>
                        <Select
                          value={cookieConsent.position}
                          onValueChange={(value: "bottom" | "top" | "bottom-left" | "bottom-right") =>
                            setCookieConsent({ ...cookieConsent, position: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bottom">Unten (Banner)</SelectItem>
                            <SelectItem value="top">Oben (Banner)</SelectItem>
                            <SelectItem value="bottom-left">Unten links (Popup)</SelectItem>
                            <SelectItem value="bottom-right">Unten rechts (Popup)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Layout</Label>
                        <Select
                          value={cookieConsent.layout}
                          onValueChange={(value: "banner" | "modal" | "popup") =>
                            setCookieConsent({ ...cookieConsent, layout: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="banner">Banner</SelectItem>
                            <SelectItem value="modal">Modal</SelectItem>
                            <SelectItem value="popup">Popup</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Theme</Label>
                        <Select
                          value={cookieConsent.theme}
                          onValueChange={(value: "light" | "dark" | "auto") =>
                            setCookieConsent({ ...cookieConsent, theme: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Hell</SelectItem>
                            <SelectItem value="dark">Dunkel</SelectItem>
                            <SelectItem value="auto">Automatisch</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="primary-color">Primärfarbe</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={cookieConsent.primary_color}
                            onChange={(e) =>
                              setCookieConsent({ ...cookieConsent, primary_color: e.target.value })
                            }
                            className="w-12 h-10 p-1"
                            aria-label="Farbwähler"
                          />
                          <Input
                            id="primary-color"
                            value={cookieConsent.primary_color}
                            onChange={(e) => {
                              // Only accept valid hex format or partial input
                              const value = e.target.value;
                              if (value === '' || /^#[A-Fa-f0-9]{0,6}$/.test(value)) {
                                setCookieConsent({ ...cookieConsent, primary_color: value });
                              }
                            }}
                            placeholder="#2563eb"
                            maxLength={7}
                            aria-invalid={!!validationErrors.primary_color}
                            aria-describedby={validationErrors.primary_color ? "color-error" : undefined}
                          />
                        </div>
                        {validationErrors.primary_color && (
                          <p id="color-error" className="text-sm text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {validationErrors.primary_color}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="consent-expiry">Einwilligung gültig (Tage)</Label>
                        <Input
                          id="consent-expiry"
                          type="number"
                          value={cookieConsent.consent_expiry_days}
                          onChange={(e) =>
                            setCookieConsent({
                              ...cookieConsent,
                              consent_expiry_days: safeParseInt(e.target.value, 365, 1, 730),
                            })
                          }
                          min={1}
                          max={730}
                          aria-invalid={!!validationErrors.consent_expiry_days}
                          aria-describedby={validationErrors.consent_expiry_days ? "expiry-error" : "expiry-hint"}
                        />
                        {validationErrors.consent_expiry_days ? (
                          <p id="expiry-error" className="text-sm text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {validationErrors.consent_expiry_days}
                          </p>
                        ) : (
                          <p id="expiry-hint" className="text-xs text-muted-foreground">
                            Empfohlen: 365 Tage (1 Jahr)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between">
                        <Label>Einstellungen-Button anzeigen</Label>
                        <Switch
                          checked={cookieConsent.show_preferences_button}
                          onCheckedChange={(checked) =>
                            setCookieConsent({ ...cookieConsent, show_preferences_button: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>"Alle ablehnen" Button anzeigen</Label>
                        <Switch
                          checked={cookieConsent.reject_all_button}
                          onCheckedChange={(checked) =>
                            setCookieConsent({ ...cookieConsent, reject_all_button: checked })
                          }
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label className="text-base">Links</Label>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Datenschutzerklärung</Label>
                          <Input
                            value={cookieConsent.privacy_policy_url}
                            onChange={(e) =>
                              setCookieConsent({ ...cookieConsent, privacy_policy_url: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cookie-Richtlinie</Label>
                          <Input
                            value={cookieConsent.cookie_policy_url}
                            onChange={(e) =>
                              setCookieConsent({ ...cookieConsent, cookie_policy_url: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Impressum</Label>
                          <Input
                            value={cookieConsent.imprint_url}
                            onChange={(e) =>
                              setCookieConsent({ ...cookieConsent, imprint_url: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <Accordion type="single" collapsible>
                      <AccordionItem value="texts">
                        <AccordionTrigger>Banner-Texte bearbeiten</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label>Titel</Label>
                            <Input
                              value={cookieConsent.texts.title}
                              onChange={(e) =>
                                setCookieConsent({
                                  ...cookieConsent,
                                  texts: { ...cookieConsent.texts, title: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Beschreibung</Label>
                            <Textarea
                              value={cookieConsent.texts.description}
                              onChange={(e) =>
                                setCookieConsent({
                                  ...cookieConsent,
                                  texts: { ...cookieConsent.texts, description: e.target.value },
                                })
                              }
                              rows={3}
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Button: Alle akzeptieren</Label>
                              <Input
                                value={cookieConsent.texts.accept_all}
                                onChange={(e) =>
                                  setCookieConsent({
                                    ...cookieConsent,
                                    texts: { ...cookieConsent.texts, accept_all: e.target.value },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Button: Alle ablehnen</Label>
                              <Input
                                value={cookieConsent.texts.reject_all}
                                onChange={(e) =>
                                  setCookieConsent({
                                    ...cookieConsent,
                                    texts: { ...cookieConsent.texts, reject_all: e.target.value },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Button: Auswahl speichern</Label>
                              <Input
                                value={cookieConsent.texts.save_preferences}
                                onChange={(e) =>
                                  setCookieConsent({
                                    ...cookieConsent,
                                    texts: { ...cookieConsent.texts, save_preferences: e.target.value },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Button: Einstellungen</Label>
                              <Input
                                value={cookieConsent.texts.manage_preferences}
                                onChange={(e) =>
                                  setCookieConsent({
                                    ...cookieConsent,
                                    texts: { ...cookieConsent.texts, manage_preferences: e.target.value },
                                  })
                                }
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="categories">
                        <AccordionTrigger>Cookie-Kategorien bearbeiten</AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4">
                          {(["essential", "analytics", "marketing", "preferences"] as const).map(
                            (category) => (
                              <div key={category} className="space-y-3 p-4 border rounded-lg">
                                <div className="flex items-center justify-between">
                                  <Label className="text-base font-medium">
                                    {cookieConsent.categories[category].name}
                                    {category === "essential" && (
                                      <Badge variant="secondary" className="ml-2">
                                        Pflicht
                                      </Badge>
                                    )}
                                  </Label>
                                </div>
                                <div className="space-y-2">
                                  <Label>Kategorie-Name</Label>
                                  <Input
                                    value={cookieConsent.categories[category].name}
                                    onChange={(e) =>
                                      setCookieConsent({
                                        ...cookieConsent,
                                        categories: {
                                          ...cookieConsent.categories,
                                          [category]: {
                                            ...cookieConsent.categories[category],
                                            name: e.target.value,
                                          },
                                        },
                                      })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Beschreibung</Label>
                                  <Textarea
                                    value={cookieConsent.categories[category].description}
                                    onChange={(e) =>
                                      setCookieConsent({
                                        ...cookieConsent,
                                        categories: {
                                          ...cookieConsent.categories,
                                          [category]: {
                                            ...cookieConsent.categories[category],
                                            description: e.target.value,
                                          },
                                        },
                                      })
                                    }
                                    rows={2}
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            {cookieConsent.enabled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Vorschau
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="p-6 rounded-lg border-2"
                    style={{ backgroundColor: cookieConsent.theme === "dark" ? "#1f2937" : "#ffffff" }}
                  >
                    <div
                      className={`text-${cookieConsent.theme === "dark" ? "white" : "gray-900"}`}
                    >
                      <h3 className="font-bold text-lg mb-2">{cookieConsent.texts.title}</h3>
                      <p className="text-sm mb-4 opacity-80">{cookieConsent.texts.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          style={{ backgroundColor: cookieConsent.primary_color }}
                        >
                          {cookieConsent.texts.accept_all}
                        </Button>
                        {cookieConsent.reject_all_button && (
                          <Button size="sm" variant="outline">
                            {cookieConsent.texts.reject_all}
                          </Button>
                        )}
                        {cookieConsent.show_preferences_button && (
                          <Button size="sm" variant="ghost">
                            {cookieConsent.texts.manage_preferences}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

