import { Helmet } from "react-helmet-async";
import Layout from "@/components/layout/Layout";
import { ReinigungWizard } from "@/components/reinigung/ReinigungWizard";
import { useSearchParams } from "react-router-dom";
import { ReinigungServiceType } from "@/types/reinigung";

const ReinigungAnfrage = () => {
  const [searchParams] = useSearchParams();

  const serviceTypeParam = searchParams.get("type") as ReinigungServiceType | null;
  const initialServiceType: ReinigungServiceType =
    serviceTypeParam && ["uebergabereinigung", "unterhaltsreinigung", "grundreinigung"].includes(serviceTypeParam)
      ? serviceTypeParam
      : "uebergabereinigung";

  const maxCompaniesParam = searchParams.get("max_companies");
  const maxCompanies: 3 | 5 = maxCompaniesParam === "5" ? 5 : 3;

  const serviceLabels: Record<ReinigungServiceType, { title: string; description: string }> = {
    uebergabereinigung: {
      title: "Übergabereinigung",
      description: "Professionelle Endreinigung bei Wohnungsübergabe",
    },
    unterhaltsreinigung: {
      title: "Unterhaltsreinigung",
      description: "Regelmässige Reinigung für Ihr Zuhause",
    },
    grundreinigung: {
      title: "Grundreinigung",
      description: "Intensive Tiefenreinigung für alle Bereiche",
    },
  };

  const currentService = serviceLabels[initialServiceType];

  return (
    <>
      <Helmet>
        <title>{currentService.title} anfragen | Offerio</title>
        <meta
          name="description"
          content={`${currentService.description}. Erhalten Sie kostenlos bis zu ${maxCompanies} Offerten von verifizierten Schweizer Reinigungsfirmen.`}
        />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Anfrage","item":"https://offerio.ch/anfrage"},{"@type":"ListItem","position":3,"name":"Reinigung anfragen","item":"https://offerio.ch/anfrage/reinigung"}]}`}</script>
      </Helmet>
      <Layout>
        <section className="py-12 lg:py-16 bg-gradient-to-b from-cyan-50/50 via-white to-white">
          <div className="container-custom">
            <div className="text-center max-w-2xl mx-auto mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1.5">
                {currentService.title} anfragen
              </h1>
              <p className="text-sm text-gray-500">
                Kostenlos · Unverbindlich · Bis zu {maxCompanies} Offerten in 24h
              </p>
            </div>

            <ReinigungWizard
              initialServiceType={initialServiceType}
              maxCompanies={maxCompanies}
            />

            <div className="mt-12 text-center">
              <p className="text-xs text-gray-400">
                Ihre Daten sind sicher. Wir geben Ihre Informationen nur an
                verifizierte Reinigungspartner weiter.
              </p>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
};

export default ReinigungAnfrage;
