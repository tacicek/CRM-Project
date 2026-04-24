import { SpezialTransportWizard } from "@/components/spezialtransport";
import Layout from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";

const SpezialTransportAnfrage = () => {
  return (
    <>
      <Helmet>
        <title>Spezialtransport anfragen | Offerio</title>
        <meta
          name="description"
          content="Kostenlose Offerten für Spezialtransporte anfragen. Tresor, Klavier, Motorrad, Kunst & mehr – geprüfte Schweizer Fachfirmen in 24h."
        />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Anfrage","item":"https://offerio.ch/anfrage"},{"@type":"ListItem","position":3,"name":"Spezialtransport anfragen","item":"https://offerio.ch/anfrage/spezialtransport"}]}`}</script>
      </Helmet>
      <Layout>
        <section className="py-8 bg-gradient-to-b from-blue-50/40 via-white to-white">
          <div className="container-custom">
            <div className="text-center max-w-2xl mx-auto mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1.5">
                Spezialtransport anfragen
              </h1>
              <p className="text-sm text-gray-500">
                Kostenlos · Unverbindlich · Bis zu 5 Offerten in 24h
              </p>
            </div>
            <SpezialTransportWizard />
          </div>
        </section>
      </Layout>
    </>
  );
};

export default SpezialTransportAnfrage;
