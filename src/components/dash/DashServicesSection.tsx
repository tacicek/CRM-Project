import { services } from "@/data/services";
import { Plus } from "lucide-react";

const DashServicesSection = () => {
  const count = services.length;

  return (
    <section className="py-20 lg:py-24 bg-gray-50">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Für welche Branchen?
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Anfragen in{" "}
            <span className="text-primary">über {count} Kategorien</span>
          </h2>
          <p className="text-lg text-gray-500">
            Egal ob Umzug, Reinigung oder Spezialtransport — Offerio vermittelt
            qualifizierte Kundenanfragen für alle gängigen Dienstleistungen.
          </p>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 group text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/15 transition-colors">
                <service.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-2">{service.title}</h3>
              <div className="space-y-1">
                {service.features.slice(0, 2).map((feat, i) => (
                  <p key={i} className="text-xs text-gray-400 leading-snug">
                    {feat}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* "Noch mehr" card */}
          <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl p-5 border border-dashed border-primary/25 text-center flex flex-col items-center justify-center gap-2 min-h-[130px]">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-gray-700 text-sm">Noch mehr</h3>
            <p className="text-xs text-gray-400 leading-snug">
              Weitere Kategorien folgen
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">
          Registrieren Sie sich und geben Sie an, für welche Kategorien Sie
          Anfragen erhalten möchten.
        </p>
      </div>
    </section>
  );
};

export default DashServicesSection;
