import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BadgeCheck, Coins, ShieldCheck } from "lucide-react";

const bullets = [
  { icon: BadgeCheck, text: "Kostenlose Registrierung" },
  { icon: Coins, text: "Keine Grundgebühren" },
  { icon: ShieldCheck, text: "Sofort startklar" },
];

const DashCtaSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-br from-primary via-primary/95 to-primary/90 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative text-center max-w-3xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-semibold mb-6">
          <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
          Jetzt kostenlos loslegen
        </div>

        {/* Headline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
          Bereit, Ihr Geschäft auf die{" "}
          <span style={{ color: "#EF6A17" }}>nächste Stufe</span> zu bringen?
        </h2>

        <p className="text-lg text-white/75 leading-relaxed mb-10 max-w-xl mx-auto">
          Schliessen Sie sich über 500 Schweizer Dienstleistern an, die mit Offerio
          täglich neue Kunden gewinnen.
        </p>

        {/* Bullets */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {bullets.map((b, index) => (
            <div key={index} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <b.icon className="w-4 h-4 text-secondary shrink-0" />
              <span className="text-white text-sm font-medium">{b.text}</span>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            asChild
            className="bg-secondary hover:bg-secondary/90 text-white text-base px-8 py-4 h-auto font-semibold shadow-lg"
          >
            <Link to="/partner-werden" className="group">
              Kostenlos Partner werden
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="bg-transparent border-2 border-white/50 text-white hover:bg-white/10 hover:border-white hover:text-white text-base px-8 py-4 h-auto"
          >
            <Link to="/auth">Bereits Partner? Anmelden</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default DashCtaSection;
