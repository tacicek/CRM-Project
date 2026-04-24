import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import Layout from "@/components/layout/Layout";
import DashHeroSection from "@/components/dash/DashHeroSection";
import DashHowItWorksSection from "@/components/dash/DashHowItWorksSection";

// Lazy load below-the-fold sections
const DashStatsSection = lazy(() => import("@/components/dash/DashStatsSection"));
const DashFeaturesSection = lazy(() => import("@/components/dash/DashFeaturesSection"));
const DashCrmSection = lazy(() => import("@/components/dash/DashCrmSection"));
const DashVirtualBesichtigungSection = lazy(() => import("@/components/dash/DashVirtualBesichtigungSection"));
const DashPricingSection = lazy(() => import("@/components/dash/DashPricingSection"));
const DashServicesSection = lazy(() => import("@/components/dash/DashServicesSection"));
const DashFaqSection = lazy(() => import("@/components/dash/DashFaqSection"));
const DashCtaSection = lazy(() => import("@/components/dash/DashCtaSection"));

const DashIndex = () => {
  return (
    <>
      <Helmet>
        <title>Offerio Partner-Portal — Neue Kunden für Ihr Unternehmen</title>
        <meta
          name="description"
          content="Werden Sie Offerio-Partner und erhalten Sie qualifizierte Kundenanfragen aus Ihrer Region. Kein Abo, keine Grundgebühren — zahlen Sie nur für Leads, die Sie wirklich wollen."
        />
        <meta name="robots" content="noindex, nofollow" />
        <script type="application/ld+json">{`{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Offerio Partner-Portal",
  "url": "https://dash.offerio.ch",
  "description": "Das Partner-Portal für Schweizer Umzugs- und Reinigungsunternehmen. Qualifizierte Leads, flexibles Token-Modell, kein Abo."
}`}</script>
      </Helmet>

      <Layout>
        <main>
          {/* Above-the-fold: loaded immediately */}
          <DashHeroSection />
          <DashHowItWorksSection />

          {/* Below-the-fold: lazy loaded */}
          <Suspense fallback={<div className="min-h-[200px]" />}>
            <DashStatsSection />
            <DashFeaturesSection />
            <DashCrmSection />
            <DashVirtualBesichtigungSection />
            <DashPricingSection />
            <DashServicesSection />
            <DashFaqSection />
            <DashCtaSection />
          </Suspense>
        </main>
      </Layout>
    </>
  );
};

export default DashIndex;
