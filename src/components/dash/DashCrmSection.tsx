import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileText,
  CalendarDays,
  Users,
  ClipboardList,
  BookOpen,
  Tag,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

const crmFeatures = [
  {
    icon: FileText,
    title: "Professionelle Offerten",
    description:
      "Erstellen Sie Offerten mit Pauschal-, Stundenansatz- oder Kostendach-Modell und versenden Sie sie als PDF — in wenigen Minuten.",
  },
  {
    icon: CalendarDays,
    title: "Kalender & Terminplanung",
    description:
      "Drag-and-Drop-Kalender für Umzüge, Besichtigungen und interne Termine. Team-Wochenansicht und ICS-Export inklusive.",
  },
  {
    icon: Users,
    title: "Team & Ressourcen",
    description:
      "Mitarbeiter, Fahrzeuge und Ausrüstung verwalten, Aufgaben zuweisen und Kapazitäten im Blick behalten.",
  },
  {
    icon: ClipboardList,
    title: "Aufträge & Checklisten",
    description:
      "Von der Offerte zum Auftrag in einem Klick. Kundenspezifische Checklisten werden automatisch als PDF an die Offerte angehängt.",
  },
  {
    icon: BookOpen,
    title: "Leistungskatalog",
    description:
      "Eigener Servicekatalog mit Preisvorlagen. Positionen per Klick in Offerten übernehmen — kein manuelles Eintippen mehr.",
  },
  {
    icon: Tag,
    title: "Preisgestaltung",
    description:
      "Firmenspezifische Kalkulationsregeln, Umzugsrechner und Stundenansatz-Vorlagen. Jede Offerte wird automatisch korrekt berechnet.",
  },
];

const stats = [
  { value: "3×", label: "schneller zur fertigen Offerte" },
  { value: "0 CHF", label: "Grundgebühr für das CRM" },
  { value: "100%", label: "Swiss-hosted & DSGVO-konform" },
];

const DashCrmSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-white overflow-hidden">
      <div className="container-custom">
        {/* Top label */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary text-sm font-semibold">
            <TrendingUp className="w-4 h-4" />
            Das integrierte CRM-Modul
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-start">
          {/* Left: Text */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-5 leading-tight">
              Von der Anfrage zum{" "}
              <span className="text-secondary">abgeschlossenen Auftrag</span>
              {" "}— alles in einem System.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-10">
              Offerio ist mehr als eine Lead-Plattform. Mit dem CRM-Modul haben
              Sie Offerten, Termine, Team und Aufträge an einem Ort — ohne
              Insellösungen, ohne Datenchaos.
            </p>

            {/* Feature list */}
            <div className="space-y-6 mb-10">
              {crmFeatures.map((feature, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <feature.icon className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1 text-sm">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="hero" size="lg" asChild>
                <Link to="/partner-werden" className="group">
                  Jetzt kostenlos starten
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/auth">Bereits Partner? Anmelden</Link>
              </Button>
            </div>

            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              Registrierung kostenlos. CRM-Modul: erster Monat gratis, danach CHF 200 / Monat.{" "}
              <Link to="/preise" className="underline underline-offset-2 hover:text-gray-600 transition-colors">
                Preise ansehen →
              </Link>
            </p>
          </div>

          {/* Right: UI Mockup */}
          <div className="relative lg:sticky lg:top-24">
            {/* Decorative blurs */}
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

            {/* Mock dashboard card */}
            <div className="relative bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
              {/* Topbar */}
              <div className="bg-gray-900 px-4 py-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="flex-1 mx-4 bg-gray-700 rounded-md px-3 py-1 text-xs text-gray-400">
                  dash.offerio.ch/firma/offerten
                </div>
              </div>

              {/* Sidebar + content layout */}
              <div className="flex h-[420px]">
                {/* Sidebar */}
                <div className="w-14 bg-gray-50 border-r border-gray-100 flex flex-col items-center py-4 gap-4">
                  {[
                    { icon: "⚡", active: false },
                    { icon: "📋", active: false },
                    { icon: "📄", active: true },
                    { icon: "📅", active: false },
                    { icon: "👥", active: false },
                    { icon: "✅", active: false },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${
                        item.active
                          ? "bg-secondary text-white shadow-sm"
                          : "text-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {item.icon}
                    </div>
                  ))}
                </div>

                {/* Main content */}
                <div className="flex-1 p-5 overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 text-sm">Meine Offerten</h3>
                    <div className="bg-secondary text-white text-xs px-3 py-1 rounded-lg font-medium">
                      + Neue Offerte
                    </div>
                  </div>

                  {/* Offer rows */}
                  {[
                    { name: "Müller, Zürich", status: "Angenommen", statusColor: "bg-emerald-100 text-emerald-700", amount: "CHF 2'450", date: "14.04.2026" },
                    { name: "Schmidt, Basel", status: "Gesendet", statusColor: "bg-blue-100 text-blue-700", amount: "CHF 1'890", date: "13.04.2026" },
                    { name: "Weber, Bern", status: "Entwurf", statusColor: "bg-amber-100 text-amber-700", amount: "CHF 3'200", date: "12.04.2026" },
                    { name: "Fischer, Luzern", status: "Angenommen", statusColor: "bg-emerald-100 text-emerald-700", amount: "CHF 980", date: "11.04.2026" },
                  ].map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                        {row.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{row.name}</p>
                        <p className="text-[10px] text-gray-400">{row.date}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${row.statusColor}`}>
                        {row.status}
                      </span>
                      <span className="text-xs font-bold text-gray-900 shrink-0">{row.amount}</span>
                    </div>
                  ))}

                  {/* Mini stats */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: "Diese Woche", value: "4", color: "bg-primary/8 text-primary" },
                      { label: "Angenommen", value: "2", color: "bg-emerald-50 text-emerald-700" },
                      { label: "Offen", value: "2", color: "bg-amber-50 text-amber-700" },
                    ].map((s, i) => (
                      <div key={i} className={`rounded-lg p-2 text-center ${s.color}`}>
                        <div className="text-lg font-bold">{s.value}</div>
                        <div className="text-[9px] font-medium opacity-80">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating stats below card */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {stats.map((s, i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100"
                >
                  <div className="text-xl font-bold text-gray-900">{s.value}</div>
                  <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: "Already included" note */}
        <div className="mt-16 p-6 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-secondary" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">
              CRM-Modul: CHF 200 / Monat — der erste Monat ist kostenlos.
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              Testen Sie alle CRM-Funktionen 30 Tage lang ohne Kosten. Danach CHF 200 / Monat, jederzeit kündbar.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link to="/preise">Preise ansehen</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default DashCrmSection;
