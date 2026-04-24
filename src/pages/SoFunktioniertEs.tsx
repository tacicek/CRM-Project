import Layout from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Send, Users, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TrustBar from "@/components/shared/TrustBar";

const steps = [
  {
    icon: FileText,
    title: "1. Anfrage stellen",
    description: "Füllen Sie unser einfaches Formular aus mit Details zu Ihrem Umzug oder Ihrer Reinigung. Das dauert nur 2 Minuten."
  },
  {
    icon: Users,
    title: "2. Offerten erhalten",
    description: "Geprüfte Partnerunternehmen aus Ihrer Region erhalten Ihre Anfrage und senden Ihnen unverbindliche Offerten."
  },
  {
    icon: CheckCircle2,
    title: "3. Vergleichen & Wählen",
    description: "Vergleichen Sie die erhaltenen Angebote in Ruhe und wählen Sie das beste Preis-Leistungs-Verhältnis."
  },
  {
    icon: Send,
    title: "4. Auftrag vergeben",
    description: "Kontaktieren Sie Ihren Wunschanbieter direkt und vereinbaren Sie die Details Ihres Auftrags."
  }
];

const benefits = [
  "100% kostenlos und unverbindlich",
  "Bis zu 5 Offerten von lokalen Firmen",
  "Geprüfte und bewertete Anbieter",
  "Zeitersparnis durch Vergleich",
  "Keine versteckten Kosten",
  "Persönliche Beratung möglich"
];

const soFunktioniertFaqs = [
  {
    question: "Wie schnell erhalte ich Offerten?",
    answer: "In der Regel erhalten Sie innerhalb von 24 Stunden bis zu 5 unverbindliche Angebote von geprüften Anbietern aus Ihrer Region."
  },
  {
    question: "Bin ich verpflichtet, ein Angebot anzunehmen?",
    answer: "Nein, die Anfrage ist vollständig unverbindlich. Sie entscheiden selbst, ob und welches Angebot Sie annehmen möchten."
  },
  {
    question: "Wie viele Offerten erhalte ich?",
    answer: "Sie erhalten bis zu 5 Offerten von verschiedenen Anbietern in Ihrer Region – so haben Sie die beste Grundlage für einen Preisvergleich."
  },
  {
    question: "Wer sind die Anbieter auf Offerio?",
    answer: "Alle Partner-Firmen auf Offerio.ch werden vor der Aufnahme ins Netzwerk geprüft. Wir achten auf gültige Versicherungen, positive Kundenbewertungen und professionelles Auftreten."
  },
  {
    question: "Für welche Dienstleistungen kann ich Offerten anfragen?",
    answer: "Auf Offerio können Sie Offerten für Umzug, Endreinigung, Entrümpelung, Klaviertransport, Möbellift, Entsorgung, Renovation, Malerarbeiten und Lagerung anfragen."
  }
];

const SoFunktioniertEs = () => {
  return (
    <Layout>
      <Helmet>
        <title>So funktioniert's | Offerio</title>
        <meta name="description" content="Erfahren Sie, wie Sie mit Offerio in wenigen Schritten kostenlose Offerten für Umzug und Reinigung erhalten." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"So funktioniert's","item":"https://offerio.ch/so-funktioniert-es"}]}`}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: soFunktioniertFaqs.map(faq => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer }
          }))
        })}</script>
      </Helmet>

      {/* Hero Section */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-muted/50 to-background">
        <div className="container-custom text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            So funktioniert <span className="text-secondary">Offerio</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            In nur 4 einfachen Schritten zu Ihrem perfekten Angebot – kostenlos, schnell und unverbindlich.
          </p>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-16 lg:py-24">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div 
                key={index}
                className="relative p-6 rounded-2xl bg-card border border-border hover:border-secondary/50 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center mb-4 group-hover:bg-secondary group-hover:scale-110 transition-all duration-300">
                  <step.icon className="w-7 h-7 text-secondary group-hover:text-primary-foreground transition-colors" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
                
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="w-8 h-8 text-secondary/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Quick Links */}
      <section className="py-16 lg:py-24">
        <div className="container-custom">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Für welche Dienstleistung suchen Sie eine Offerte?</h2>
            <p className="text-muted-foreground">Wählen Sie Ihren Bedarf und erhalten Sie kostenlos bis zu 5 Angebote</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: "Umzug", href: "/anfrage/umzug" },
              { label: "Reinigung", href: "/anfrage/reinigung" },
              { label: "Entrümpelung", href: "/anfrage/raeumung" },
              { label: "Klaviertransport", href: "/anfrage/klaviertransport" },
              { label: "Möbellift", href: "/anfrage/moebellift" },
              { label: "Entsorgung", href: "/anfrage/entsorgung" },
              { label: "Renovation", href: "/anfrage/renovation" },
              { label: "Malerarbeiten", href: "/anfrage/malerarbeiten" },
              { label: "Lagerung", href: "/anfrage/lagerung" },
              { label: "Umzug & Reinigung", href: "/umzug-reinigung" },
              { label: "Preise vergleichen", href: "/preise" },
              { label: "Für Firmen", href: "/fuer-firmen" },
            ].map(({ label, href }) => (
              <Link
                key={href}
                to={href}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-card text-sm font-medium hover:border-secondary hover:text-secondary hover:shadow-sm transition-all duration-200"
              >
                {label}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Ihre Vorteile mit Offerio
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Wir verbinden Sie mit den besten lokalen Dienstleistern und machen den Vergleich einfach.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-secondary" />
                    </div>
                    <span className="font-medium">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-square max-w-md mx-auto rounded-3xl bg-gradient-to-br from-secondary/20 to-primary/20 p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-7xl font-bold text-secondary mb-2">4</div>
                  <div className="text-2xl font-semibold">Einfache Schritte</div>
                  <div className="text-muted-foreground mt-2">zu Ihrem Wunschangebot</div>
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
            <h2 className="text-3xl font-bold mb-4">Häufig gestellte Fragen</h2>
            <p className="text-muted-foreground">Ihre Fragen zu Offerio – schnell beantwortet</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {soFunktioniertFaqs.map((faq, i) => (
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

      {/* CTA Section */}
      <section className="py-16 lg:py-24">
        <div className="container-custom text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Bereit für Ihre kostenlose Offerte?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Starten Sie jetzt und erhalten Sie innerhalb von 24 Stunden bis zu 5 unverbindliche Angebote.
          </p>
          <Button variant="hero" size="lg" asChild>
            <Link to="/anfrage">Jetzt Offerte anfragen</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default SoFunktioniertEs;
