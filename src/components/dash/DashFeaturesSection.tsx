import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Users,
  BarChart3,
  Bell,
  Briefcase,
  ClipboardList,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Übersichtliches Dashboard",
    description:
      "Alle Anfragen, Offerten und Token auf einen Blick. Behalten Sie stets den Überblick über Ihr Geschäft.",
    badge: "Inklusive",
  },
  {
    icon: FileText,
    title: "Offerten-Generator",
    description:
      "Erstellen Sie professionelle Offerten in wenigen Klicks und versenden Sie diese als PDF direkt an den Kunden.",
    badge: "CRM",
  },
  {
    icon: CalendarDays,
    title: "Kalender & Termine",
    description:
      "Verwalten Sie Besichtigungstermine, Umzugsdaten und Kundentermine übersichtlich an einem zentralen Ort.",
    badge: "CRM",
  },
  {
    icon: Users,
    title: "Team-Verwaltung",
    description:
      "Fügen Sie Mitarbeiter hinzu, verteilen Sie Aufgaben und koordinieren Sie Ihr Team effizient.",
    badge: "CRM",
  },
  {
    icon: BarChart3,
    title: "Statistiken & Auswertungen",
    description:
      "Sehen Sie, welche Leads Sie gewonnen haben, wie viele Token Sie verbraucht haben und wie Ihr ROI aussieht.",
    badge: "Inklusive",
  },
  {
    icon: Bell,
    title: "Sofort-Benachrichtigungen",
    description:
      "Erhalten Sie E-Mail-Benachrichtigungen in Echtzeit, sobald eine neue Anfrage passend zu Ihrer Region eingeht.",
    badge: "Inklusive",
  },
  {
    icon: Briefcase,
    title: "Leistungskatalog",
    description:
      "Definieren Sie Ihr genaues Angebot und Ihre Serviceregionen — und erhalten Sie nur wirklich passende Leads.",
    badge: "Inklusive",
  },
  {
    icon: ClipboardList,
    title: "Checklisten & Aufträge",
    description:
      "Verwalten Sie laufende Aufträge mit Checklisten und behalten Sie den Status jedes Kunden im Blick.",
    badge: "CRM",
  },
];

const badgeStyles: Record<string, string> = {
  Inklusive: "bg-primary/10 text-primary",
  CRM: "bg-secondary/10 text-secondary",
};

const DashFeaturesSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Alles was Sie brauchen
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Ein Dashboard —{" "}
            <span className="text-primary">alle Werkzeuge</span>
          </h2>
          <p className="text-lg text-gray-500">
            Von der ersten Anfrage bis zur abgeschlossenen Offerte — Offerio bietet
            alles, was Ihr Unternehmen braucht, um effizient zu wachsen.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mb-10">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-gray-600 font-medium">Inklusive bei jedem Account</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-secondary" />
            <span className="text-gray-600 font-medium">CRM-Modul (optional)</span>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeStyles[feature.badge]}`}
                >
                  {feature.badge}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DashFeaturesSection;
