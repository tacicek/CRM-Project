import { Helmet } from "react-helmet-async";
import Layout from "@/components/layout/Layout";
import LeadFormWizard from "@/components/forms/LeadFormWizard";
import { Shield, Clock, Star } from "lucide-react";

const Anfrage = () => {
  const benefits = [
    { icon: Shield, text: "100% Kostenlos & Unverbindlich" },
    { icon: Clock, text: "Antworten in 24 Stunden" },
    { icon: Star, text: "Nur verifizierte Partner" },
  ];

  return (
    <>
      <Helmet>
        <title>Offerte anfragen | Offerio</title>
        <meta 
          name="description" 
          content="Stellen Sie jetzt Ihre Anfrage und erhalten Sie bis zu 5 kostenlose Offerten von verifizierten Schweizer Umzugs- und Reinigungsfirmen." 
        />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Offerte anfragen","item":"https://offerio.ch/anfrage"}]}`}</script>
      </Helmet>
      <Layout>
        <section className="py-12 lg:py-20 bg-gradient-to-b from-background to-secondary/5">
          <div className="container-custom">
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                Offerte anfragen
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                Füllen Sie das Formular aus und erhalten Sie bis zu 5 Offerten 
                von verifizierten Anbietern.
              </p>
              <div className="flex flex-wrap justify-center gap-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <benefit.icon className="w-5 h-5 text-accent" />
                    <span>{benefit.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <LeadFormWizard />
          </div>
        </section>
      </Layout>
    </>
  );
};

export default Anfrage;
