import Layout from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Users, TrendingUp, Shield, Coins, BarChart3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TrustBar from "@/components/shared/TrustBar";

const benefits = [
  {
    icon: Users,
    title: "Qualifizierte Leads",
    description: "Erhalten Sie Anfragen von Kunden, die aktiv nach Ihren Dienstleistungen suchen."
  },
  {
    icon: Coins,
    title: "Faire Token-Preise",
    description: "Zahlen Sie nur für Leads, die Sie interessieren. Transparentes Preismodell ohne Abo-Zwang."
  },
  {
    icon: BarChart3,
    title: "Übersichtliches Dashboard",
    description: "Verwalten Sie alle Anfragen, Offerten und Termine an einem zentralen Ort."
  },
  {
    icon: Zap,
    title: "Schnelle Reaktion",
    description: "Werden Sie sofort benachrichtigt, wenn neue passende Anfragen eingehen."
  },
  {
    icon: Shield,
    title: "Verifizierte Anfragen",
    description: "Alle Kundenanfragen werden auf Qualität geprüft, bevor sie an Sie weitergeleitet werden."
  },
  {
    icon: TrendingUp,
    title: "Wachstum steigern",
    description: "Erweitern Sie Ihren Kundenstamm ohne hohe Marketingkosten."
  }
];

const features = [
  "Eigenes Firmen-Dashboard",
  "Offerten-Erstellung mit PDF-Export",
  "Kalender- und Terminverwaltung",
  "Team-Verwaltung",
  "E-Mail-Benachrichtigungen",
  "Statistiken und Auswertungen",
  "Leistungskatalog-Verwaltung",
  "Checklisten für Kunden"
];

const firmenFaqs = [
  {
    question: "Wie werde ich Partner bei Offerio?",
    answer: "Die Registrierung dauert nur wenige Minuten. Füllen Sie das Partnerformular aus, wir prüfen Ihre Firma und schalten Sie frei. Danach können Sie sofort mit dem Empfangen von Anfragen starten."
  },
  {
    question: "Was kostet die Mitgliedschaft als Partnerfirma?",
    answer: "Es gibt keine monatlichen Grundgebühren oder Abo-Zwang. Sie kaufen Token-Pakete und zahlen nur für Leads, die Sie wirklich interessieren. So haben Sie volle Kostenkontrolle."
  },
  {
    question: "Wie erhalte ich Kundenanfragen?",
    answer: "Sobald ein Kunde eine Anfrage passend zu Ihrem Leistungsbereich und Ihrer Region stellt, werden Sie sofort per E-Mail benachrichtigt. Sie entscheiden, ob Sie das Lead freischalten möchten."
  },
  {
    question: "Welche Arten von Anfragen erhalte ich?",
    answer: "Je nach Ihrem Leistungsprofil erhalten Sie Anfragen für Umzug, Endreinigung, Entrümpelung, Klaviertransport, Möbellift, Renovation, Malerarbeiten oder Lagerung – ausschliesslich aus Ihrer Wunschregion."
  },
  {
    question: "Wie werden Anfragen auf Qualität geprüft?",
    answer: "Jede Kundenanfrage wird automatisch auf Vollständigkeit geprüft und manuell stichprobenartig kontrolliert. Gefälschte oder unvollständige Anfragen werden nicht weitergeleitet."
  }
];

const FuerFirmen = () => {
  return (
    <Layout>
      <Helmet>
        <title>Für Firmen | Offerio</title>
        <meta name="description" content="Werden Sie Partner bei Offerio und erhalten Sie qualifizierte Kundenanfragen für Umzug und Reinigung." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Für Firmen","item":"https://offerio.ch/fuer-firmen"}]}`}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: firmenFaqs.map(faq => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer }
          }))
        })}</script>
      </Helmet>

      {/* Hero Section */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-muted/50 to-background">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                Mehr Kunden für <span className="text-secondary">Ihr Unternehmen</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8">
                Werden Sie Partner bei Offerio und erhalten Sie qualifizierte Kundenanfragen direkt in Ihr Dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="hero" size="lg" asChild>
                  <Link to="/partner-werden">Jetzt Partner werden</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/auth">Firma Login</Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-primary/10 to-secondary/20 border border-border overflow-hidden flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="text-5xl font-bold text-secondary mb-2">500+</div>
                  <div className="text-xl font-semibold">Partner-Firmen</div>
                  <div className="text-muted-foreground mt-1">vertrauen auf Offerio</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 lg:py-24">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Warum Offerio?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Profitieren Sie von unserem bewährten System für qualifizierte Kundenanfragen.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl bg-card border border-border hover:border-secondary/50 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4 group-hover:bg-secondary group-hover:scale-110 transition-all duration-300">
                  <benefit.icon className="w-6 h-6 text-secondary group-hover:text-primary-foreground transition-colors" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Alles was Sie brauchen
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Unser Firmen-Dashboard bietet Ihnen alle Tools für effizientes Lead-Management.
              </p>
              <ul className="grid sm:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-secondary" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
                <div className="h-8 bg-muted/50 border-b border-border flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="p-6">
                  <div className="text-sm text-muted-foreground mb-4">Firmen-Dashboard</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold text-secondary">12</div>
                      <div className="text-xs text-muted-foreground">Neue Anfragen</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">8</div>
                      <div className="text-xs text-muted-foreground">Offerten</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">5</div>
                      <div className="text-xs text-muted-foreground">Termine</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <TrustBar />

      {/* FAQ Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container-custom max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">Häufig gestellte Fragen für Firmen</h2>
            <p className="text-muted-foreground">
              Alles, was Sie als Partnerfirma wissen müssen —{" "}
              <Link to="/so-funktioniert-es" className="text-secondary hover:underline">
                So funktioniert Offerio
              </Link>
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {firmenFaqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b border-border">
                <AccordionTrigger className="text-left font-medium py-4 hover:no-underline hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-16 lg:py-24">
        <div className="container-custom text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Transparente Token-Preise
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Kaufen Sie <Link to="/preise" className="text-secondary font-medium hover:underline">Token-Pakete</Link> und zahlen Sie nur für die Leads, die Sie interessieren.
            Keine versteckten Kosten, keine Abo-Pflicht. Alle Dienstleistungen auf{" "}
            <Link to="/so-funktioniert-es" className="text-secondary font-medium hover:underline">So funktioniert's</Link> erklärt.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" asChild>
              <Link to="/preise">Token-Preise ansehen</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/partner-werden">Kostenlos registrieren</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default FuerFirmen;
