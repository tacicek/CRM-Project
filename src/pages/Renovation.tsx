import { RenovationWizard } from "@/components/renovation";
import { Helmet } from "react-helmet-async";
import Layout from "@/components/layout/Layout";

const RenovationAnfrage = () => {
  return (
    <>
      <Helmet>
        <title>Renovation anfragen | Offerio</title>
        <meta name="description" content="Erhalten Sie kostenlose Offerten für Ihre Renovation. Vergleichen Sie Preise von geprüften Renovationsfirmen." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Anfrage","item":"https://offerio.ch/anfrage"},{"@type":"ListItem","position":3,"name":"Renovation anfragen","item":"https://offerio.ch/anfrage/renovation"}]}`}</script>
      </Helmet>
      <Layout>
        <section className="py-12 lg:py-16 bg-gradient-to-b from-gray-50 via-white to-white">
          <div className="container-custom">
            <div className="text-center max-w-2xl mx-auto mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1.5">
                Renovation anfragen
              </h1>
              <p className="text-sm text-gray-500">
                Kostenlos · Unverbindlich · Bis zu 3 Offerten in 24h
              </p>
            </div>
            <RenovationWizard />
          </div>
        </section>
      </Layout>
    </>
  );
};

export default RenovationAnfrage;
