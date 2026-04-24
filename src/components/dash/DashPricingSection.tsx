import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Coins, ShieldCheck, RefreshCw } from "lucide-react";

const highlights = [
  {
    icon: Coins,
    title: "Kein Abo",
    description: "Keine monatlichen Fixkosten. Sie kaufen Token nach Bedarf.",
  },
  {
    icon: ShieldCheck,
    title: "Kein Risiko",
    description: "Sie entscheiden selbst, welche Leads Sie freischalten — kein Zwang.",
  },
  {
    icon: RefreshCw,
    title: "Volle Flexibilität",
    description: "Token verfallen nicht und können jederzeit aufgestockt werden.",
  },
];

const included = [
  "Kostenlose Registrierung",
  "Eigenes Firmenprofil",
  "Keine Grundgebühren",
  "E-Mail Benachrichtigungen",
  "Statistiken & Auswertungen",
  "Leistungskatalog-Verwaltung",
  "Flexible Token-Pakete",
  "Offerten-Generator (Basis)",
];

const DashPricingSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="container-custom">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Highlights */}
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-4">
                Transparente Preise
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Sie zahlen nur für{" "}
                <span className="text-primary">das, was Sie nehmen</span>
              </h2>
              <p className="text-lg text-gray-500 leading-relaxed">
                Das Token-Modell von Offerio gibt Ihnen die volle Kontrolle über
                Ihre Marketingkosten. Keine bösen Überraschungen am Monatsende.
              </p>
            </div>

            <div className="space-y-5">
              {highlights.map((item, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                    <p className="text-gray-500 text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="hero" size="lg" asChild>
                <Link to="/partner-werden" className="group">
                  Jetzt Partner werden
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/preise">Alle Preise ansehen</Link>
              </Button>
            </div>
          </div>

          {/* Right: Pricing card */}
          <div className="relative">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-8">
              {/* Card header */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Token-Kosten pro Lead</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">ab CHF 8</span>
                    <span className="text-gray-400 text-sm">/ Lead</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">Abhängig von</div>
                  <div className="text-xs text-gray-600 font-medium">Service &amp; Region</div>
                </div>
              </div>

              {/* What's included */}
              <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">
                Inklusive bei jedem Account
              </h3>
              <div className="grid grid-cols-1 gap-3 mb-6">
                {included.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>

              {/* Bottom note */}
              <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  Registrierung ist kostenlos. Token werden erst benötigt, wenn Sie
                  ein Lead freischalten möchten.
                </p>
              </div>
            </div>

            {/* Decorative glow */}
            <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashPricingSection;
