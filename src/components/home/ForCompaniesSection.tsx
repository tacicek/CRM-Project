import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Target, 
  Coins, 
  BarChart3, 
  Zap,
  CheckCircle2
} from "lucide-react";

const ForCompaniesSection = () => {
  const benefits = [
    {
      icon: Target,
      title: "Qualifizierte Leads",
      description: "Erhalten Sie nur Anfragen, die zu Ihrem Servicegebiet und Angebot passen.",
    },
    {
      icon: Coins,
      title: "Faire Token-Preise",
      description: "Bezahlen Sie nur für Leads, die Sie aktiv annehmen – keine versteckten Kosten.",
    },
    {
      icon: BarChart3,
      title: "Transparentes Dashboard",
      description: "Verwalten Sie alle Anfragen, Offerten und Ihre Token übersichtlich.",
    },
    {
      icon: Zap,
      title: "Schneller Prozess",
      description: "Von der Anfrage zur Offerte in wenigen Klicks dank intelligenter Vorlagen.",
    },
  ];

  const included = [
    "Kostenlose Registrierung",
    "Keine Grundgebühren",
    "Flexible Token-Pakete",
    "Eigenes Firmenprofil",
    "Offerte-Generator",
    "E-Mail Benachrichtigungen",
  ];

  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container-custom">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Target className="w-4 h-4" />
              Für Umzugs- & Reinigungsfirmen
            </div>

            <h2 className="text-3xl md:text-4xl font-bold leading-tight">
              Neue Kunden gewinnen –{" "}
              <span className="text-primary">ohne Risiko</span>
            </h2>

            <p className="text-lg text-muted-foreground leading-relaxed">
              Werden Sie Partner bei Offerio und erhalten Sie qualifizierte 
              Kundenanfragen direkt in Ihr Dashboard. Zahlen Sie nur für Leads, 
              die Sie annehmen.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    <benefit.icon className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-base">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="lg" asChild>
                <Link to="/partner-werden" className="group">
                  Jetzt Partner werden
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/auth">Bereits Partner? Anmelden</Link>
              </Button>
            </div>
          </div>

          {/* Card */}
          <div className="relative">
            <div className="glass-card p-8">
              <h3 className="text-xl font-semibold mb-6">Inklusive bei Offerio</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {included.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Token-Kosten pro Lead</span>
                  <span className="text-sm font-semibold">ab CHF 8.-</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Abhängig von Service, Distanz und Auftragsvolumen
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-secondary/10 rounded-full blur-2xl" />
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForCompaniesSection;
