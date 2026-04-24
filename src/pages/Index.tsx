import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";

// Lazy load below-the-fold components to reduce initial bundle
const TrustSection = lazy(() => import("@/components/home/TrustSection"));
const PartnerLogos = lazy(() => import("@/components/home/PartnerLogos"));
const ForCompaniesSection = lazy(() => import("@/components/home/ForCompaniesSection"));

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Offerio — Kostenlos Offerten anfragen | Schweiz</title>
        <meta
          name="description"
          content="Stellen Sie jetzt Ihre Anfrage und erhalten Sie bis zu 5 kostenlose Offerten von verifizierten Schweizer Umzugs- und Reinigungsfirmen."
        />
        {/* Mobile & App */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Offerio" />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"}]}`}</script>
        <script type="application/ld+json">{`{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Offerio.ch",
  "url": "https://offerio.ch",
  "logo": "https://offerio.ch/logo.png",
  "description": "Offerio ist die führende Schweizer Plattform für kostenlose Offerten – Umzug, Reinigung, Entrümpelung und mehr. Verifizierte Anbieter, transparente Preise.",
  "foundingDate": "2023",
  "areaServed": {
    "@type": "Country",
    "name": "Schweiz"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "info@offerio.ch",
    "availableLanguage": ["German", "French", "Italian"]
  },
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "CH"
  },
  "sameAs": [
    "https://www.linkedin.com/company/offerio",
    "https://www.instagram.com/offerio.ch"
  ],
  "knowsAbout": [
    "Umzug Schweiz",
    "Reinigung Schweiz",
    "Entrümpelung",
    "Offerten vergleichen",
    "Umzugsfirmen"
  ],
  "hasCredential": {
    "@type": "EducationalOccupationalCredential",
    "name": "Verifizierte Partnerunternehmen",
    "description": "Alle Partnerunternehmen auf Offerio.ch sind geprüft und verifiziert."
  }
}`}</script>
      </Helmet>
      <Layout>
        <main>
          {/* Critical above-the-fold content - loaded immediately */}
          <HeroSection />
          <ServicesSection />

          {/* Below-the-fold content - lazy loaded for better LCP */}
          <Suspense fallback={<div className="min-h-[200px]" />}>
            <TrustSection />
            <PartnerLogos />
            <ForCompaniesSection />
          </Suspense>
        </main>
      </Layout>
    </>
  );
};

export default Index;
