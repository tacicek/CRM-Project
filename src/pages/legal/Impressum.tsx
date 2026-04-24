import { Helmet } from "react-helmet-async";
import Layout from "@/components/layout/Layout";
import { Mail, Phone, MapPin, Globe } from "lucide-react";

const Impressum = () => {
  return (
    <>
      <Helmet>
        <title>Impressum | Offerio</title>
        <meta name="description" content="Impressum und rechtliche Angaben zu Offerio - Ihre Plattform für Umzugs- und Reinigungsofferten in der Schweiz." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Impressum","item":"https://offerio.ch/impressum"}]}`}</script>
      </Helmet>
      <Layout>
        <div className="py-20 lg:py-28">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold mb-8">Impressum</h1>
              
              <div className="space-y-8">
                {/* Company Info Card */}
                <div className="bg-card border border-border rounded-xl p-8">
                  <h2 className="text-xl font-semibold mb-6">Angaben gemäss Art. 3 UWG</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold text-lg">Offerio</p>
                      <p className="text-muted-foreground">Plattform für Umzugs- und Reinigungsofferten</p>
                    </div>
                    
                    <div className="flex items-start gap-3 text-muted-foreground">
                      <MapPin className="w-5 h-5 text-secondary mt-0.5 shrink-0" />
                      <div>
                        <p>Bahnhofstrasse 10</p>
                        <p>8001 Zürich</p>
                        <p>Schweiz</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Card */}
                <div className="bg-card border border-border rounded-xl p-8">
                  <h2 className="text-xl font-semibold mb-6">Kontakt</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Mail className="w-5 h-5 text-secondary shrink-0" />
                      <a href="mailto:info@offerio.ch" className="hover:text-secondary transition-colors">
                        info@offerio.ch
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Phone className="w-5 h-5 text-secondary shrink-0" />
                      <a href="tel:+41443001234" className="hover:text-secondary transition-colors">
                        +41 44 300 12 34
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Globe className="w-5 h-5 text-secondary shrink-0" />
                      <a href="https://offerio.ch" className="hover:text-secondary transition-colors">
                        www.offerio.ch
                      </a>
                    </div>
                  </div>
                </div>

                {/* Legal Info */}
                <div className="bg-card border border-border rounded-xl p-8">
                  <h2 className="text-xl font-semibold mb-6">Rechtliche Angaben</h2>
                  
                  <div className="space-y-6 text-muted-foreground">
                    <div>
                      <h3 className="font-medium text-foreground mb-2">Unternehmens-Identifikationsnummer (UID)</h3>
                      <p>CHE-XXX.XXX.XXX</p>
                      <p className="text-sm mt-1">(Bitte mit echter UID ersetzen)</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-foreground mb-2">Handelsregistereintrag</h3>
                      <p>Handelsregisteramt des Kantons Zürich</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-foreground mb-2">Mehrwertsteuernummer</h3>
                      <p>CHE-XXX.XXX.XXX MWST</p>
                      <p className="text-sm mt-1">(Bitte mit echter MWST-Nummer ersetzen)</p>
                    </div>
                  </div>
                </div>

                {/* Responsible Person */}
                <div className="bg-card border border-border rounded-xl p-8">
                  <h2 className="text-xl font-semibold mb-6">Verantwortliche Person</h2>
                  
                  <div className="text-muted-foreground">
                    <p className="font-medium text-foreground">Inhaltlich verantwortlich gemäss Art. 3 UWG:</p>
                    <p className="mt-2">[Name der verantwortlichen Person]</p>
                    <p>Geschäftsführer/in</p>
                    <p className="text-sm mt-2">(Bitte mit echten Angaben ersetzen)</p>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="bg-muted/50 border border-border rounded-xl p-8">
                  <h2 className="text-xl font-semibold mb-6">Haftungsausschluss</h2>
                  
                  <div className="space-y-4 text-muted-foreground text-sm">
                    <p>
                      <strong className="text-foreground">Haftung für Inhalte:</strong> Die Inhalte dieser Webseite wurden 
                      mit grösster Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität 
                      der Inhalte können wir jedoch keine Gewähr übernehmen.
                    </p>
                    
                    <p>
                      <strong className="text-foreground">Haftung für Links:</strong> Unsere Webseite enthält Links zu externen 
                      Webseiten Dritter. Auf deren Inhalte haben wir keinen Einfluss. Für die Inhalte 
                      der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich.
                    </p>
                    
                    <p>
                      <strong className="text-foreground">Urheberrecht:</strong> Die Inhalte und Werke auf dieser Webseite 
                      unterliegen dem schweizerischen Urheberrecht. Jede Art der Vervielfältigung, 
                      Bearbeitung, Verbreitung und jede Art der Verwertung ausserhalb der Grenzen 
                      des Urheberrechtes bedarf der schriftlichen Zustimmung des Autors.
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  Stand: Dezember 2024
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
};

export default Impressum;