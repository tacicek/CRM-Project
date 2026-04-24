import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BadgeCheck, ShieldCheck, Coins, Users, Star } from "lucide-react";

const DashHeroSection = () => {
  const trustItems = [
    { icon: Users, text: "500+ Partnerfirmen" },
    { icon: BadgeCheck, text: "50'000+ Anfragen" },
    { icon: Coins, text: "Ab CHF 8 pro Lead" },
    { icon: ShieldCheck, text: "Schweizweit" },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-white to-secondary/5 pt-8 pb-20 lg:pt-12 lg:pb-28">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-secondary/8 rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            Das Partner-Portal für Schweizer Dienstleister
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-gray-900 mb-6">
            Neue Kunden.{" "}
            <span style={{ color: "#EF6A17" }}>Kein Risiko.</span>
            <br />
            Nur Resultate.
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            Werden Sie Offerio-Partner und erhalten Sie qualifizierte Kundenanfragen
            direkt aus Ihrer Region. Kein Abo, keine Grundgebühren — Sie zahlen nur für
            Leads, die Sie wirklich wollen.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button variant="hero" size="lg" asChild className="text-base px-8 py-4 h-auto">
              <Link to="/partner-werden" className="group">
                Kostenlos Partner werden
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-base px-8 py-4 h-auto border-2">
              <Link to="/auth">Bereits Partner? Anmelden</Link>
            </Button>
          </div>

          {/* Trust Bar */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            {trustItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2.5 bg-white/80 backdrop-blur-sm px-4 py-2.5 rounded-full border border-gray-100 shadow-sm"
              >
                <item.icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Rating strip */}
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="font-semibold text-gray-700">4.8/5</span>
            <span>von unseren Partnerfirmen bewertet</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashHeroSection;
