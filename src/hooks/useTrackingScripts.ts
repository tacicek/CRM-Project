import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  GoogleAnalyticsSettings,
  GoogleAdsSettings,
  MetaAdsSettings,
  LinkedInAdsSettings,
  TikTokAdsSettings,
} from "@/types/websiteSettings";

interface TrackingSettings {
  analytics: GoogleAnalyticsSettings | null;
  googleAds: GoogleAdsSettings | null;
  metaAds: MetaAdsSettings | null;
  linkedIn: LinkedInAdsSettings | null;
  tikTok: TikTokAdsSettings | null;
}

interface ConsentCategories {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

// Extend Window interface for tracking globals
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    fbq: (...args: unknown[]) => void;
    _fbq: unknown;
    lintrk: (...args: unknown[]) => void;
    _linkedin_data_partner_ids: string[];
    ttq: {
      load: (id: string) => void;
      page: () => void;
      track: (event: string, data?: Record<string, unknown>) => void;
      identify: (data: Record<string, unknown>) => void;
    };
  }
}

function injectScript(id: string, src: string, async = true): HTMLScriptElement | null {
  if (document.getElementById(id)) return null;

  const script = document.createElement("script");
  script.id = id;
  script.src = src;
  script.async = async;
  document.head.appendChild(script);
  return script;
}

function injectInlineScript(id: string, content: string): void {
  if (document.getElementById(id)) return;

  const script = document.createElement("script");
  script.id = id;
  script.textContent = content;
  document.head.appendChild(script);
}

function removeScript(id: string): void {
  const script = document.getElementById(id);
  if (script) script.remove();
}

function getConsentFromSession(): ConsentCategories {
  try {
    const stored = sessionStorage.getItem("cookieConsent");
    if (!stored) {
      return {
        essential: true,
        analytics: false,
        marketing: false,
        preferences: false,
      };
    }
    const parsed = JSON.parse(stored) as Partial<ConsentCategories>;
    return {
      essential: parsed.essential ?? true,
      analytics: parsed.analytics ?? false,
      marketing: parsed.marketing ?? false,
      preferences: parsed.preferences ?? false,
    };
  } catch {
    return {
      essential: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
  }
}

function teardownAnalyticsScripts(): void {
  removeScript("ga4-script");
  removeScript("gtm-script");
  removeScript("gtm-noscript");
}

function teardownMarketingScripts(): void {
  removeScript("gads-script");
  removeScript("fb-pixel-script");
  removeScript("linkedin-script");
  removeScript("tiktok-script");

  // Ensure trackers are not callable after consent withdrawal
  if ("fbq" in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).fbq = undefined;
  }
  if ("_fbq" in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)._fbq = undefined;
  }
  if ("lintrk" in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).lintrk = undefined;
  }
  if ("ttq" in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ttq = undefined;
  }
}

export function useTrackingScripts() {
  const [settings, setSettings] = useState<TrackingSettings>({
    analytics: null,
    googleAds: null,
    metaAds: null,
    linkedIn: null,
    tikTok: null,
  });
  const [consent, setConsent] = useState<ConsentCategories>({
    essential: true,
    analytics: false,
    marketing: false,
    preferences: false,
  });
  const [loaded, setLoaded] = useState(false);

  // Fetch all tracking settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("website_settings")
          .select("setting_key, setting_value")
          .eq("is_active", true)
          .in("setting_key", [
            "analytics_google",
            "google_ads",
            "social_ads_meta",
            "social_ads_linkedin",
            "social_ads_tiktok",
          ]);

        if (error) throw error;

        const newSettings: TrackingSettings = {
          analytics: null,
          googleAds: null,
          metaAds: null,
          linkedIn: null,
          tikTok: null,
        };

        data?.forEach((item) => {
          switch (item.setting_key) {
            case "analytics_google":
              newSettings.analytics = item.setting_value as GoogleAnalyticsSettings;
              break;
            case "google_ads":
              newSettings.googleAds = item.setting_value as GoogleAdsSettings;
              break;
            case "social_ads_meta":
              newSettings.metaAds = item.setting_value as MetaAdsSettings;
              break;
            case "social_ads_linkedin":
              newSettings.linkedIn = item.setting_value as LinkedInAdsSettings;
              break;
            case "social_ads_tiktok":
              newSettings.tikTok = item.setting_value as TikTokAdsSettings;
              break;
          }
        });

        setSettings(newSettings);
        setLoaded(true);
      } catch (err) {
        console.error("Error fetching tracking settings:", err);
        setLoaded(true);
      }
    };

    fetchSettings();
  }, []);

  // Listen for consent updates
  useEffect(() => {
    // Check initial consent from sessionStorage
    const storedConsent = sessionStorage.getItem("cookieConsent");
    if (storedConsent) {
      try {
        setConsent(JSON.parse(storedConsent));
      } catch {
        // Ignore parse errors
      }
    }

    // Listen for consent updates
    const handleConsentUpdate = (event: CustomEvent<ConsentCategories>) => {
      setConsent(event.detail);
    };

    window.addEventListener("cookieConsentUpdate", handleConsentUpdate as EventListener);
    return () => {
      window.removeEventListener("cookieConsentUpdate", handleConsentUpdate as EventListener);
    };
  }, []);

  // Track which services have already been initialized to prevent duplicate config calls
  const [ga4Initialized, setGa4Initialized] = useState(false);
  const [gtmInitialized, setGtmInitialized] = useState(false);

  // Initialize Google Analytics 4
  const initGA4 = useCallback(() => {
    if (!settings.analytics?.enable_ga4 || !settings.analytics.ga4_measurement_id) return;
    if (!consent.analytics) {
      teardownAnalyticsScripts();
      setGa4Initialized(false);
      return;
    }

    if (ga4Initialized) return;

    const measurementId = settings.analytics.ga4_measurement_id;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
    window.gtag("js", new Date());

    const configOptions: Record<string, unknown> = {
      anonymize_ip: settings.analytics.anonymize_ip,
      debug_mode: settings.analytics.debug_mode,
    };

    window.gtag("config", measurementId, configOptions);

    injectScript("ga4-script", `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);

    if (settings.analytics.debug_mode) {
      console.log("[GA4] Initialized with ID:", measurementId);
    }

    setGa4Initialized(true);
  }, [settings.analytics, consent.analytics, ga4Initialized]);

  // Initialize Google Tag Manager
  const initGTM = useCallback(() => {
    if (!settings.analytics?.enable_gtm || !settings.analytics.gtm_container_id) return;
    if (!consent.analytics) {
      teardownAnalyticsScripts();
      setGtmInitialized(false);
      return;
    }

    if (gtmInitialized) return;

    const containerId = settings.analytics.gtm_container_id;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js",
    });

    injectScript("gtm-script", `https://www.googletagmanager.com/gtm.js?id=${containerId}`);

    const noscript = document.createElement("noscript");
    noscript.id = "gtm-noscript";
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    if (!document.getElementById("gtm-noscript")) {
      document.body.insertBefore(noscript, document.body.firstChild);
    }

    if (settings.analytics.debug_mode) {
      console.log("[GTM] Initialized with ID:", containerId);
    }

    setGtmInitialized(true);
  }, [settings.analytics, consent.analytics, gtmInitialized]);

  // Initialize Google Ads
  const initGoogleAds = useCallback(() => {
    if (!settings.googleAds?.conversion_id) return;
    if (!consent.marketing) {
      teardownMarketingScripts();
      return;
    }

    const conversionId = settings.googleAds.conversion_id;

    // Initialize gtag if not already
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };

    window.gtag("config", conversionId);

    // Inject script
    injectScript("gads-script", `https://www.googletagmanager.com/gtag/js?id=${conversionId}`);
  }, [settings.googleAds, consent.marketing]);

  // Initialize Meta/Facebook Pixel
  const initMetaPixel = useCallback(() => {
    if (!settings.metaAds?.enable_pixel || !settings.metaAds.pixel_id) return;
    if (!consent.marketing) {
      teardownMarketingScripts();
      return;
    }

    const pixelId = settings.metaAds.pixel_id;

    // Facebook Pixel base code
    const fbPixelCode = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}'${settings.metaAds.enable_advanced_matching ? ", {}" : ""});
      ${settings.metaAds.track_page_view ? "fbq('track', 'PageView');" : ""}
    `;

    injectInlineScript("fb-pixel-script", fbPixelCode);
  }, [settings.metaAds, consent.marketing]);

  // Initialize LinkedIn Insight Tag
  const initLinkedIn = useCallback(() => {
    if (!settings.linkedIn?.enable_insight_tag || !settings.linkedIn.partner_id) return;
    if (!consent.marketing) {
      teardownMarketingScripts();
      return;
    }

    const partnerId = settings.linkedIn.partner_id;

    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(partnerId);

    const linkedInCode = `
      (function(l) {
        if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
        window.lintrk.q=[]}
        var s = document.getElementsByTagName("script")[0];
        var b = document.createElement("script");
        b.type = "text/javascript";b.async = true;
        b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
        s.parentNode.insertBefore(b, s);})(window.lintrk);
    `;

    injectInlineScript("linkedin-script", linkedInCode);
  }, [settings.linkedIn, consent.marketing]);

  // Initialize TikTok Pixel
  const initTikTok = useCallback(() => {
    if (!settings.tikTok?.enable_pixel || !settings.tikTok.pixel_id) return;
    if (!consent.marketing) {
      teardownMarketingScripts();
      return;
    }

    const pixelId = settings.tikTok.pixel_id;

    const tikTokCode = `
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
        ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
        ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
        ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};
        var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load('${pixelId}');
        ttq.page();
      }(window, document, 'ttq');
    `;

    injectInlineScript("tiktok-script", tikTokCode);
  }, [settings.tikTok, consent.marketing]);

  // Apply tracking scripts based on consent
  useEffect(() => {
    if (!loaded) return;

    // Analytics (requires analytics consent)
    initGA4();
    initGTM();

    // Marketing (requires marketing consent)
    initGoogleAds();
    initMetaPixel();
    initLinkedIn();
    initTikTok();
  }, [loaded, consent, initGA4, initGTM, initGoogleAds, initMetaPixel, initLinkedIn, initTikTok]);

  // Track events
  const trackEvent = useCallback(
    (eventName: string, eventParams?: Record<string, unknown>) => {
      // Google Analytics
      if (consent.analytics && settings.analytics?.enable_ga4 && window.gtag) {
        window.gtag("event", eventName, eventParams);
      }

      // Facebook Pixel
      if (consent.marketing && settings.metaAds?.enable_pixel && window.fbq) {
        window.fbq("trackCustom", eventName, eventParams);
      }

      // TikTok
      if (consent.marketing && settings.tikTok?.enable_pixel && window.ttq) {
        window.ttq.track(eventName, eventParams);
      }
    },
    [consent, settings]
  );

  // Track conversion (for ads)
  const trackConversion = useCallback(
    (type: "lead" | "signup", value?: number) => {
      // Google Ads
      if (consent.marketing && settings.googleAds?.conversion_id && window.gtag) {
        const label =
          type === "lead"
            ? settings.googleAds.conversion_label_lead
            : settings.googleAds.conversion_label_signup;

        if (label) {
          window.gtag("event", "conversion", {
            send_to: `${settings.googleAds.conversion_id}/${label}`,
            value: value,
            currency: "CHF",
          });
        }
      }

      // Facebook Pixel
      if (consent.marketing && settings.metaAds?.enable_pixel && window.fbq) {
        if (type === "lead" && settings.metaAds.track_lead) {
          window.fbq("track", "Lead", { value, currency: "CHF" });
        } else if (type === "signup" && settings.metaAds.track_complete_registration) {
          window.fbq("track", "CompleteRegistration", { value, currency: "CHF" });
        }
      }

      // LinkedIn
      if (consent.marketing && settings.linkedIn?.enable_insight_tag && window.lintrk) {
        const conversionId = settings.linkedIn.conversion_ids[type];
        if (conversionId) {
          window.lintrk("track", { conversion_id: conversionId });
        }
      }

      // TikTok
      if (consent.marketing && settings.tikTok?.enable_pixel && window.ttq) {
        const eventName = type === "lead" ? "SubmitForm" : "CompleteRegistration";
        window.ttq.track(eventName, { value, currency: "CHF" });
      }
    },
    [consent, settings]
  );

  return {
    loaded,
    consent,
    settings,
    trackEvent,
    trackConversion,
  };
}

// Standalone functions for use outside React
export function trackPageView(pagePath: string, pageTitle?: string): void {
  const consent = getConsentFromSession();

  if (consent.analytics && window.gtag) {
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }

  if (consent.marketing && window.fbq) {
    window.fbq("track", "PageView");
  }

  if (consent.marketing && window.ttq) {
    window.ttq.page();
  }
}

