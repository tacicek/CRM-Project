import { MalerarbeitWizard } from "@/components/malerarbeit";
import Layout from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";

const MalerarbeitAnfrage = () => {
  return (
    <>
      <Helmet>
        <title>Malerarbeiten anfragen | Offerio</title>
        <meta name="description" content="Kostenlose Offerten für Malerarbeiten anfragen. Bis zu 5 Angebote von verifizierten Schweizer Firmen – schnell und unverbindlich." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Anfrage","item":"https://offerio.ch/anfrage"},{"@type":"ListItem","position":3,"name":"Malerarbeiten anfragen","item":"https://offerio.ch/anfrage/malerarbeiten"}]}`}</script>
      </Helmet>
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
          <div className="py-8">
            <div className="text-center max-w-2xl mx-auto mb-6 px-4">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1.5">
                Malerarbeiten anfragen
              </h1>
              <p className="text-sm text-gray-500">
                Kostenlos · Unverbindlich · Bis zu 5 Offerten in 24h
              </p>
            </div>
            <MalerarbeitWizard />
          </div>
        </div>
      </Layout>
    </>
  );
};

export default MalerarbeitAnfrage;

