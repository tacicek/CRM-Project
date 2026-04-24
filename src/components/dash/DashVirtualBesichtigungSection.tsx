import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Camera, Sparkles, FileText, Clock, CheckCircle2 } from "lucide-react";

const steps = [
  {
    icon: Camera,
    number: "01",
    title: "Kunde fotografiert",
    description:
      "Sie senden dem Kunden einen einzigartigen Link. Er fotografiert Wohnung, Möbel und besondere Gegenstände bequem mit dem Smartphone — kein Termin nötig.",
    color: "bg-primary/10 text-primary",
    borderColor: "border-primary/20",
  },
  {
    icon: Sparkles,
    number: "02",
    title: "KI analysiert die Bilder",
    description:
      "Unsere KI erkennt automatisch Umzugsgut, Volumen und Besonderheiten. Sie erhalten eine strukturierte Zusammenfassung — fertig für Ihre Offerte.",
    color: "bg-secondary/10 text-secondary",
    borderColor: "border-secondary/20",
  },
  {
    icon: FileText,
    number: "03",
    title: "Sie erstellen die Offerte",
    description:
      "Mit einem Klick werden die KI-Erkenntnisse in die Offerte übernommen. In wenigen Minuten liegt der Preis beim Kunden — bevor der Mitbewerber überhaupt angerufen hat.",
    color: "bg-emerald-50 text-emerald-700",
    borderColor: "border-emerald-200",
  },
];

const benefits = [
  "Kein Vor-Ort-Termin mehr nötig",
  "Schnellere Offerte als die Konkurrenz",
  "Höhere Abschlussquote durch Professionalität",
  "Spart Fahrzeit und Personalkosten",
];

const DashVirtualBesichtigungSection = () => {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      </div>

      <div className="container-custom relative">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary text-sm font-semibold mb-6 border border-primary/30">
            <Sparkles className="w-4 h-4" />
            KI-gestützte Besichtigung
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5 leading-tight">
            Kein Vor-Ort-Termin mehr.{" "}
            <span className="text-primary">Die KI übernimmt.</span>
          </h2>
          <p className="text-lg text-gray-300 leading-relaxed">
            Schicken Sie dem Kunden einen Link — er fotografiert,
            die KI analysiert, Sie offerieren. Von der Anfrage zur
            fertigen Offerte in unter 30 Minuten.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6 mb-16 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-10 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-primary/30 via-secondary/30 to-emerald-500/30 pointer-events-none" />

          {steps.map((step, i) => (
            <div
              key={i}
              className={`relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 border ${step.borderColor} hover:bg-white/8 transition-colors`}
            >
              {/* Step number */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center`}
                >
                  <step.icon className="w-6 h-6" />
                </div>
                <span className="text-3xl font-black text-white/10 select-none">
                  {step.number}
                </span>
              </div>

              <h3 className="font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom: benefits + CTA */}
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Benefits */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                Ihr Vorteil
              </span>
            </div>
            <div className="space-y-3">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-gray-200 text-sm">{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA card */}
          <div className="bg-white/8 backdrop-blur-sm rounded-2xl border border-white/10 p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Enthalten im</div>
                <div className="text-sm font-bold text-white">CRM-Modul</div>
              </div>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed mb-6">
              Die virtuelle Besichtigung ist Teil des CRM-Moduls — zusammen mit
              Offerten, Kalender, Team und Auftragsmanagement.
            </p>

            {/* Mini preview */}
            <div className="bg-gray-900/50 rounded-xl p-4 mb-6 border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-gray-400">Live-Beispiel: KI-Analyse</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Wohnfläche erkannt", value: "87 m²", color: "text-primary" },
                  { label: "Umzugsgut", value: "~18 m³", color: "text-secondary" },
                  { label: "Besonderheiten", value: "Klavier, 2 OG", color: "text-amber-400" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className={`text-xs font-semibold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="hero" size="lg" className="w-full" asChild>
              <Link to="/partner-werden" className="group">
                Jetzt kostenlos ausprobieren
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>

            <p className="text-center text-xs text-gray-500 mt-3 leading-relaxed">
              Registrierung kostenlos. CRM-Modul ab dem 2. Monat CHF 200 / Monat — erster Monat gratis.{" "}
              <Link to="/preise" className="text-gray-400 underline underline-offset-2 hover:text-white transition-colors">
                Preise ansehen →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashVirtualBesichtigungSection;
