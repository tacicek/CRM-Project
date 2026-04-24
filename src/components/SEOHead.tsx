import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import type { SEOGlobalSettings, SEOSocialSettings } from "@/types/websiteSettings";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
}

export default function SEOHead({
  title,
  description,
  keywords,
  image,
  url,
  type = "website",
  noindex = false,
  structuredData,
}: SEOHeadProps) {
  const [seoGlobal, setSeoGlobal] = useState<SEOGlobalSettings | null>(null);
  const [seoSocial, setSeoSocial] = useState<SEOSocialSettings | null>(null);

  useEffect(() => {
    const fetchSeoSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("website_settings")
          .select("setting_key, setting_value")
          .eq("is_active", true)
          .in("setting_key", ["seo_global", "seo_social"]);

        if (error) throw error;

        data?.forEach((item) => {
          if (item.setting_key === "seo_global") {
            setSeoGlobal(item.setting_value as SEOGlobalSettings);
          } else if (item.setting_key === "seo_social") {
            setSeoSocial(item.setting_value as SEOSocialSettings);
          }
        });
      } catch (err) {
        console.error("Error fetching SEO settings:", err);
      }
    };

    fetchSeoSettings();
  }, []);

  // Compute final values
  const finalTitle = title
    ? `${title}${seoGlobal?.default_title_suffix || ""}`
    : `Offerio.ch${seoGlobal?.default_title_suffix || ""}`;

  const finalDescription = description || seoGlobal?.default_description || "";
  const finalKeywords = keywords?.join(", ") || seoGlobal?.default_keywords?.join(", ") || "";
  const finalImage = image || seoSocial?.og_image || "";
  const baseUrl = (seoGlobal?.canonical_base_url || (typeof window !== "undefined" ? window.location.origin : ""))
    .replace(/\/$/, "");
  const finalUrl = url
    ? (url.startsWith("http") ? url : `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`)
    : baseUrl;

  // Generate structured data
  const organizationSchema = seoGlobal?.enable_structured_data
    ? {
        "@context": "https://schema.org",
        ...seoGlobal.structured_data_org,
      }
    : null;

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: finalTitle,
    description: finalDescription,
    url: finalUrl,
    ...(finalImage && { image: finalImage }),
  };

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {finalKeywords && <meta name="keywords" content={finalKeywords} />}
      <link rel="canonical" href={finalUrl} />

      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:type" content={type || seoSocial?.og_type || "website"} />
      <meta property="og:url" content={finalUrl} />
      {finalImage && <meta property="og:image" content={finalImage} />}
      {seoSocial?.og_image_width && (
        <meta property="og:image:width" content={String(seoSocial.og_image_width)} />
      )}
      {seoSocial?.og_image_height && (
        <meta property="og:image:height" content={String(seoSocial.og_image_height)} />
      )}
      {seoSocial?.og_site_name && (
        <meta property="og:site_name" content={seoSocial.og_site_name} />
      )}
      <meta property="og:locale" content="de_CH" />

      {/* Twitter Card */}
      <meta
        name="twitter:card"
        content={seoSocial?.twitter_card || "summary_large_image"}
      />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      {finalImage && <meta name="twitter:image" content={finalImage} />}
      {seoSocial?.twitter_site && (
        <meta name="twitter:site" content={seoSocial.twitter_site} />
      )}
      {seoSocial?.twitter_creator && (
        <meta name="twitter:creator" content={seoSocial.twitter_creator} />
      )}

      {/* Additional Meta */}
      <meta name="author" content="Offerio.ch" />
      <meta name="geo.region" content="CH" />
      <meta name="geo.placename" content="Switzerland" />
      <meta name="language" content="de" />

      {/* Structured Data */}
      {organizationSchema && (
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
      )}
      <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
      {structuredData && Array.isArray(structuredData)
        ? structuredData.map((entry, index) => (
            <script key={`json-ld-${index}`} type="application/ld+json">
              {JSON.stringify(entry)}
            </script>
          ))
        : structuredData && (
            <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
          )}
    </Helmet>
  );
}

// Service-specific structured data generators
export function generateServiceSchema(service: {
  name: string;
  description: string;
  provider: string;
  areaServed: string;
  url: string;
  image?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description,
    provider: {
      "@type": "Organization",
      name: service.provider,
    },
    areaServed: {
      "@type": "Country",
      name: service.areaServed,
    },
    url: service.url,
    ...(service.image && { image: service.image }),
  };
}

export function generateLocalBusinessSchema(business: {
  name: string;
  description: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  phone?: string;
  email?: string;
  url: string;
  image?: string;
  priceRange?: string;
  openingHours?: string[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    description: business.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.street,
      addressLocality: business.address.city,
      postalCode: business.address.postalCode,
      addressCountry: business.address.country,
    },
    ...(business.phone && { telephone: business.phone }),
    ...(business.email && { email: business.email }),
    url: business.url,
    ...(business.image && { image: business.image }),
    ...(business.priceRange && { priceRange: business.priceRange }),
    ...(business.openingHours && { openingHoursSpecification: business.openingHours }),
  };
}

export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

