import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UmzugWizard } from "@/components/umzug/UmzugWizard";
import { ReinigungWizard } from "@/components/reinigung/ReinigungWizard";
import { RaeumungWizard } from "@/components/raeumung/RaeumungWizard";
import { KlaviertransportWizard } from "@/components/klaviertransport/KlaviertransportWizard";
import { MoebelliftWizard } from "@/components/moebellift/MoebelliftWizard";
import { SpezialTransportWizard } from "@/components/spezialtransport/SpezialTransportWizard";
import { RenovationWizard } from "@/components/renovation";
import { MalerarbeitWizard } from "@/components/malerarbeit";
import { LagerungWizard } from "@/components/lagerung";
import LeadFormWizard from "@/components/forms/LeadFormWizard";

interface LeadForm {
  id: string;
  name: string;
  slug: string;
  service_types: string[] | null;
  primary_color: string | null;
  show_header: boolean | null;
  header_title: string | null;
  header_subtitle: string | null;
  is_active: boolean | null;
}

// Translations for supported languages
const translations = {
  de: {
    loading: "Formular wird geladen...",
    notAvailable: "Formular nicht verfügbar",
    notFound: "Das angeforderte Formular existiert nicht.",
    defaultTitle: "Offerte anfragen",
  },
  en: {
    loading: "Loading form...",
    notAvailable: "Form not available",
    notFound: "The requested form does not exist.",
    defaultTitle: "Request a quote",
  },
  fr: {
    loading: "Chargement du formulaire...",
    notAvailable: "Formulaire non disponible",
    notFound: "Le formulaire demandé n'existe pas.",
    defaultTitle: "Demander un devis",
  },
  it: {
    loading: "Caricamento del modulo...",
    notAvailable: "Modulo non disponibile",
    notFound: "Il modulo richiesto non esiste.",
    defaultTitle: "Richiedi un preventivo",
  },
};

type SupportedLang = keyof typeof translations;

// Slug → dedicated wizard mapping
const SLUG_TO_WIZARD: Record<string, string> = {
  umzug: "umzug",
  reinigung: "reinigung",
  raeumung: "raeumung",
  entsorgung: "raeumung",
  klaviertransport: "klaviertransport",
  moebellift: "moebellift",
  spezialtransport: "spezialtransport",
  transport: "spezialtransport",
  renovation: "renovation",
  malerarbeit: "malerarbeit",
  malerarbeiten: "malerarbeit",
  lagerung: "lagerung",
};

interface WizardProps {
  form: LeadForm;
  lang: SupportedLang;
}

const EmbedWizard = ({ form, lang }: WizardProps) => {
  const wizardKey = SLUG_TO_WIZARD[form.slug];
  const sharedProps = { formId: form.id };

  switch (wizardKey) {
    case "umzug":
      return <UmzugWizard {...sharedProps} />;
    case "reinigung":
      return <ReinigungWizard {...sharedProps} />;
    case "raeumung":
      return <RaeumungWizard {...sharedProps} />;
    case "klaviertransport":
      return <KlaviertransportWizard {...sharedProps} />;
    case "moebellift":
      return <MoebelliftWizard {...sharedProps} />;
    case "spezialtransport":
      return <SpezialTransportWizard {...sharedProps} />;
    case "renovation":
      return <RenovationWizard {...sharedProps} />;
    case "malerarbeit":
      return <MalerarbeitWizard {...sharedProps} />;
    case "lagerung":
      return <LagerungWizard {...sharedProps} />;
    default: {
      // "Alle" means no filter — show all services
      const effectiveServices =
        form.service_types && !form.service_types.some(s => s.toLowerCase() === "alle")
          ? form.service_types
          : undefined;
      return (
        <LeadFormWizard
          allowedServices={effectiveServices}
          formId={form.id}
          formSlug={form.slug}
          language={lang}
          isEmbedded
        />
      );
    }
  }
};

const EmbedForm = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<LeadForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(0);

  // Get URL parameters
  const colorParam = searchParams.get("color");
  const langParam = searchParams.get("lang") as SupportedLang | null;
  const hideHeaderParam = searchParams.get("hideHeader") === "true";

  // Determine language (default to German)
  const lang: SupportedLang = langParam && translations[langParam] ? langParam : "de";
  const t = translations[lang];

  // Parse color from URL (supports both with and without #)
  const getColorFromParam = (color: string | null): string | null => {
    if (!color) return null;
    const cleanColor = color.replace(/^#/, "");
    if (/^[0-9A-Fa-f]{6}$/.test(cleanColor)) {
      return `#${cleanColor}`;
    }
    return null;
  };

  const urlColor = getColorFromParam(colorParam);

  // Send height to parent window via postMessage
  const sendHeightToParent = useCallback(() => {
    if (containerRef.current) {
      const height = containerRef.current.scrollHeight;
      if (Math.abs(height - lastHeightRef.current) > 10) {
        lastHeightRef.current = height;
        const message = {
          type: "offerio-resize",
          height: height + 40,
          slug: slug,
        };
        window.parent.postMessage(message, "*");
        window.parent.postMessage({ ...message, type: "leadform-resize" }, "*");
      }
    }
  }, [slug]);

  const notifyFormLoaded = useCallback(() => {
    window.parent.postMessage({ type: "offerio-loaded", slug }, "*");
  }, [slug]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      sendHeightToParent();
    });

    resizeObserver.observe(containerRef.current);

    const initialTimeout = setTimeout(() => {
      sendHeightToParent();
      notifyFormLoaded();
    }, 100);

    const mutationObserver = new MutationObserver(() => {
      sendHeightToParent();
    });

    mutationObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      clearTimeout(initialTimeout);
    };
  }, [sendHeightToParent, notifyFormLoaded, form]);

  useEffect(() => {
    const fetchForm = async () => {
      if (!slug) {
        setError(t.notFound);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("lead_forms")
          .select("*")
          .eq("slug", slug)
          .eq("is_active", true)
          .single();

        if (fetchError || !data) {
          setError(t.notFound);
          return;
        }

        setForm(data as LeadForm);
      } catch (_err) {
        setError(t.notFound);
      } finally {
        setIsLoading(false);
      }
    };

    fetchForm();
  }, [slug, t.notFound]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <h1 className="text-2xl font-bold mb-4">{t.notAvailable}</h1>
          <p className="text-muted-foreground">{error || t.notFound}</p>
        </div>
      </div>
    );
  }

  const primaryColor = urlColor || form.primary_color;
  const customStyles = primaryColor ? {
    "--primary": primaryColor,
  } as React.CSSProperties : {};
  const showHeader = !hideHeaderParam && form.show_header;

  return (
    <div
      ref={containerRef}
      className="bg-gradient-to-b from-background to-secondary/5 py-8 px-4"
      style={customStyles}
    >
      <div className="container max-w-3xl mx-auto">
        {showHeader && (
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {form.header_title || t.defaultTitle}
            </h1>
            {form.header_subtitle && (
              <p className="text-muted-foreground">
                {form.header_subtitle}
              </p>
            )}
          </div>
        )}

        <EmbedWizard form={form} lang={lang} />
      </div>
    </div>
  );
};

export default EmbedForm;
