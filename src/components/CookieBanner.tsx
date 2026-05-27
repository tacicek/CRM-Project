import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { X, Cookie, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { CookieConsentSettings } from "@/types/websiteSettings";
import { cn } from "@/lib/utils";

interface ConsentCategories {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

const CONSENT_COOKIE_NAME = "crm_cookie_consent";
const VISITOR_ID_COOKIE_NAME = "crm_visitor_id";

function generateVisitorId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getStoredConsent(): ConsentCategories | null {
  const stored = getCookie(CONSENT_COOKIE_NAME);
  if (stored) {
    try {
      return JSON.parse(decodeURIComponent(stored));
    } catch {
      return null;
    }
  }
  return null;
}

export default function CookieBanner() {
  // Don't show cookie banner on the dashboard domain or in firma/admin routes
  const isDashboardRoute = typeof window !== "undefined" &&
    (window.location.hostname.startsWith("dash.") ||
     window.location.pathname.startsWith("/firma") ||
     window.location.pathname.startsWith("/admin"));

  const [settings, setSettings] = useState<CookieConsentSettings | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [consent, setConsent] = useState<ConsentCategories>({
    essential: true, // Always required
    analytics: false,
    marketing: false,
    preferences: false,
  });
  const [loading, setLoading] = useState(true);

  const applyTrackingConsent = useCallback((categories: ConsentCategories) => {
    // Dispatch custom event for tracking scripts to listen to
    window.dispatchEvent(
      new CustomEvent("cookieConsentUpdate", {
        detail: categories,
      })
    );

    // Store in sessionStorage for immediate access by tracking scripts
    sessionStorage.setItem("cookieConsent", JSON.stringify(categories));
  }, []);

  // Fetch cookie settings from database
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("website_settings")
          .select("setting_value")
          .eq("is_active", true)
          .eq("setting_key", "cookie_consent")
          .single();

        if (error) {
          console.error("Error fetching cookie settings:", error);
          setLoading(false);
          return;
        }

        if (data?.setting_value) {
          setSettings(data.setting_value as CookieConsentSettings);
        }
      } catch (err) {
        console.error("Failed to fetch cookie settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Check if user has already consented
  useEffect(() => {
    if (!settings?.enabled || loading) return;

    const storedConsent = getStoredConsent();
    if (storedConsent) {
      setConsent(storedConsent);
      setShowBanner(false);
      // Apply tracking based on consent
      applyTrackingConsent(storedConsent);
    } else {
      setShowBanner(true);
    }
     
  }, [settings, loading, applyTrackingConsent]);

  const saveConsent = useCallback(
    async (categories: ConsentCategories) => {
      if (!settings) return;

      // Get or create visitor ID
      let visitorId = getCookie(VISITOR_ID_COOKIE_NAME);
      if (!visitorId) {
        visitorId = generateVisitorId();
        setCookie(VISITOR_ID_COOKIE_NAME, visitorId, 365 * 2); // 2 years
      }

      // Save consent to cookie
      setCookie(
        CONSENT_COOKIE_NAME,
        encodeURIComponent(JSON.stringify(categories)),
        settings.consent_expiry_days
      );

      // Log consent to database (for compliance)
      try {
        await supabase.from("cookie_consent_log").insert({
          visitor_id: visitorId,
          consent_given: true,
          consent_categories: categories,
          user_agent: navigator.userAgent,
        });
      } catch (err) {
        console.error("Failed to log consent:", err);
      }

      // Apply tracking
      applyTrackingConsent(categories);

      // Hide banner
      setShowBanner(false);
    },
    [settings, applyTrackingConsent]
  );

  const handleAcceptAll = useCallback(() => {
    const allConsent: ConsentCategories = {
      essential: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    setConsent(allConsent);
    saveConsent(allConsent);
  }, [saveConsent]);

  const handleRejectAll = useCallback(() => {
    const minimalConsent: ConsentCategories = {
      essential: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
    setConsent(minimalConsent);
    saveConsent(minimalConsent);
  }, [saveConsent]);

  const handleSavePreferences = useCallback(() => {
    saveConsent(consent);
  }, [consent, saveConsent]);

  // Don't render in dashboard/admin areas or if disabled/already consented
  if (isDashboardRoute || loading || !settings?.enabled || !showBanner) {
    return null;
  }

  const positionClasses: Record<string, string> = {
    bottom: "bottom-0 left-0 right-0",
    top: "top-0 left-0 right-0",
    "bottom-left": "bottom-4 left-4 max-w-md",
    "bottom-right": "bottom-4 right-4 max-w-md",
  };

  const themeClasses = {
    light: "bg-white text-gray-900 border-gray-200",
    dark: "bg-gray-900 text-white border-gray-700",
    auto: "bg-white text-gray-900 border-gray-200",
  };

  return (
      <div
        className={cn(
          "fixed z-[9999] p-4 md:p-6 shadow-2xl border transition-all duration-300 ease-out animate-in",
          settings.position.includes("top") ? "slide-in-from-top" : "slide-in-from-bottom",
          positionClasses[settings.position] || positionClasses.bottom,
          themeClasses[settings.theme] || themeClasses.light,
          settings.layout === "banner" && "rounded-none",
          settings.layout === "popup" && "rounded-xl",
          settings.layout === "modal" && "inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg rounded-xl"
        )}
        role="dialog"
        aria-label={settings.texts.title}
      >
        {/* Close button for popup/modal */}
        {settings.layout !== "banner" && (
          <button
            onClick={handleRejectAll}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 transition"
            aria-label="Schliessen"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Cookie
              className="h-6 w-6 flex-shrink-0 mt-0.5"
              style={{ color: settings.primary_color }}
            />
            <div>
              <h2 className="font-bold text-lg">{settings.texts.title}</h2>
              <p className="text-sm opacity-80 mt-1">{settings.texts.description}</p>
            </div>
          </div>

          {/* Preferences Section */}
            {showPreferences && (
              <div
                className="overflow-hidden transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-2"
              >
                <div className="space-y-3 py-4 border-t border-b border-current/10">
                  {/* Essential - Always enabled */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">
                        {settings.categories.essential.name}
                      </Label>
                      <p className="text-xs opacity-60">
                        {settings.categories.essential.description}
                      </p>
                    </div>
                    <Switch checked disabled className="opacity-50" />
                  </div>

                  {/* Analytics */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">
                        {settings.categories.analytics.name}
                      </Label>
                      <p className="text-xs opacity-60">
                        {settings.categories.analytics.description}
                      </p>
                    </div>
                    <Switch
                      checked={consent.analytics}
                      onCheckedChange={(checked) =>
                        setConsent((prev) => ({ ...prev, analytics: checked }))
                      }
                    />
                  </div>

                  {/* Marketing */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">
                        {settings.categories.marketing.name}
                      </Label>
                      <p className="text-xs opacity-60">
                        {settings.categories.marketing.description}
                      </p>
                    </div>
                    <Switch
                      checked={consent.marketing}
                      onCheckedChange={(checked) =>
                        setConsent((prev) => ({ ...prev, marketing: checked }))
                      }
                    />
                  </div>

                  {/* Preferences */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">
                        {settings.categories.preferences.name}
                      </Label>
                      <p className="text-xs opacity-60">
                        {settings.categories.preferences.description}
                      </p>
                    </div>
                    <Switch
                      checked={consent.preferences}
                      onCheckedChange={(checked) =>
                        setConsent((prev) => ({ ...prev, preferences: checked }))
                      }
                    />
                  </div>
                </div>

                {/* Legal Links */}
                <div className="flex flex-wrap gap-3 text-xs mt-3 opacity-60">
                  {settings.privacy_policy_url && (
                    <a
                      href={settings.privacy_policy_url}
                      className="hover:opacity-100 underline flex items-center gap-1"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Datenschutz <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {settings.cookie_policy_url && (
                    <a
                      href={settings.cookie_policy_url}
                      className="hover:opacity-100 underline flex items-center gap-1"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Cookie-Richtlinie <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {settings.imprint_url && (
                    <a
                      href={settings.imprint_url}
                      className="hover:opacity-100 underline flex items-center gap-1"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Impressum <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

          {/* Buttons */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleAcceptAll}
                style={{ backgroundColor: settings.primary_color }}
                className="text-white hover:opacity-90"
              >
                {settings.texts.accept_all}
              </Button>

              {settings.reject_all_button && (
                <Button
                  variant="outline"
                  onClick={handleRejectAll}
                  className="border-current text-current hover:bg-black/10"
                >
                  {settings.texts.reject_all}
                </Button>
              )}

              {showPreferences && (
                <Button variant="secondary" onClick={handleSavePreferences}>
                  {settings.texts.save_preferences}
                </Button>
              )}
            </div>

            {settings.show_preferences_button && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreferences(!showPreferences)}
                className="gap-1"
              >
                {showPreferences ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Weniger
                  </>
                ) : (
                  <>
                    {settings.texts.manage_preferences}
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
  );
}

// Export utility function to check consent status
export function hasConsentFor(category: keyof ConsentCategories): boolean {
  const stored = getStoredConsent();
  if (!stored) return false;
  return stored[category] === true;
}

// Export function to open cookie settings (for footer link)
export function openCookieSettings(): void {
  // Remove stored consent to show banner again
  document.cookie = `${CONSENT_COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  sessionStorage.removeItem("cookieConsent");
  window.dispatchEvent(
    new CustomEvent("cookieConsentUpdate", {
      detail: {
        essential: true,
        analytics: false,
        marketing: false,
        preferences: false,
      },
    })
  );
  window.location.reload();
}

