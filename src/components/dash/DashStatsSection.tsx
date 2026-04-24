import { Users, FileText, Star, MapPin } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: "500+",
    label: "Aktive Partnerfirmen",
    sublabel: "Schweizweit vertreten",
  },
  {
    icon: FileText,
    value: "50'000+",
    label: "Vermittelte Anfragen",
    sublabel: "Seit Plattformstart",
  },
  {
    icon: Star,
    value: "4.8/5",
    label: "Partnerzufriedenheit",
    sublabel: "Basierend auf Bewertungen",
  },
  {
    icon: MapPin,
    value: "26",
    label: "Kantone abgedeckt",
    sublabel: "Gesamte Schweiz",
  },
];

const DashStatsSection = () => {
  return (
    <section className="py-16 lg:py-20 bg-primary">
      <div className="container-custom">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Offerio in Zahlen
          </h2>
          <p className="text-primary-foreground/70 text-base">
            Eine der führenden Lead-Plattformen für Dienstleister in der Schweiz
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-colors">
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-white font-semibold text-sm mb-0.5">{stat.label}</div>
              <div className="text-primary-foreground/60 text-xs">{stat.sublabel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DashStatsSection;
