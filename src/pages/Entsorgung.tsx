import { Helmet } from "react-helmet-async";
import Layout from "@/components/layout/Layout";
import { EntsorgungWizard } from "@/components/entsorgung";

const Entsorgung = () => {
  return (
    <>
      <Helmet>
        <title>Entsorgung Anfrage | Offerio</title>
        <meta
          name="description"
          content="Jetzt unverbindliche Entsorgungsofferten anfordern. Sperrmüll, Elektroschrott, Bauschutt und mehr - schnell und einfach entsorgen lassen."
        />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Anfrage","item":"https://offerio.ch/anfrage"},{"@type":"ListItem","position":3,"name":"Entsorgung anfragen","item":"https://offerio.ch/anfrage/entsorgung"}]}`}</script>
      </Helmet>
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-8">
          <div className="container mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                Entsorgung anfragen
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Erhalten Sie kostenlose Offerten von geprüften Entsorgungsfirmen
              </p>
            </div>
            <EntsorgungWizard />
          </div>
        </div>
      </Layout>
    </>
  );
};

export default Entsorgung;

