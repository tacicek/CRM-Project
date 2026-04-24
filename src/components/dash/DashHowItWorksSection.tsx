import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserPlus, BellRing, TrendingUp, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Kostenlos registrieren",
    description:
      "Erstellen Sie Ihr Firmenprofil in wenigen Minuten. Keine Kreditkarte nötig, keine Grundgebühren. Einfach loslegen.",
    highlight: "Dauert nur 5 Minuten",
  },
  {
    number: "02",
    icon: BellRing,
    title: "Qualifizierte Leads erhalten",
    description:
      "Sobald ein Kunde eine Anfrage passend zu Ihrer Region und Ihrem Leistungsangebot stellt, werden Sie sofort per E-Mail benachrichtigt.",
    highlight: "Nur relevante Anfragen",
  },
  {
    number: "03",
    icon: TrendingUp,
    title: "Kunden gewinnen",
    description:
      "Schalten Sie interessante Leads frei, senden Sie Ihre Offerte und gewinnen Sie neue Kunden — direkt über das Dashboard.",
    highlight: "Sie entscheiden selbst",
  },
];

const DashHowItWorksSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-4">
            So einfach funktioniert es
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            In 3 Schritten zu{" "}
            <span className="text-primary">neuen Kunden</span>
          </h2>
          <p className="text-lg text-gray-500">
            Kein komplizierter Onboarding-Prozess. Keine langen Wartezeiten.
            Sie sind in Minuten startklar.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line (desktop) */}
          <div className="hidden lg:block absolute top-16 left-1/2 -translate-x-1/2 w-[66%] h-0.5 bg-gradient-to-r from-primary/20 via-secondary/40 to-primary/20" />

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center group">
                {/* Icon circle */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors duration-300 relative z-10">
                    <step.icon className="w-7 h-7 text-primary group-hover:text-white transition-colors duration-300" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-secondary text-white text-xs font-bold rounded-full flex items-center justify-center z-20">
                    {index + 1}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {step.highlight}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{step.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <Button variant="hero" size="lg" asChild>
            <Link to="/partner-werden" className="group">
              Jetzt kostenlos starten
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default DashHowItWorksSection;
