// Step1ServiceType.tsx - Service type selection step for Räumung wizard

import { RaeumungsArt, serviceTypeConfig } from "@/types/raeumung";
import { ServiceTypeCard } from "../ui/ServiceTypeCard";

interface Step1ServiceTypeProps {
  value: RaeumungsArt;
  onChange: (value: RaeumungsArt) => void;
}

export const Step1ServiceType = ({ value, onChange }: Step1ServiceTypeProps) => {
  // Group services by category
  const standardServices = Object.entries(serviceTypeConfig)
    .filter(([_, config]) => config.category === "standard")
    .map(([key, config]) => ({ key: key as RaeumungsArt, ...config }));

  const sensitiveServices = Object.entries(serviceTypeConfig)
    .filter(([_, config]) => config.category === "sensitive")
    .map(([key, config]) => ({ key: key as RaeumungsArt, ...config }));

  const commercialServices = Object.entries(serviceTypeConfig)
    .filter(([_, config]) => config.category === "commercial")
    .map(([key, config]) => ({ key: key as RaeumungsArt, ...config }));

  const specialServices = Object.entries(serviceTypeConfig)
    .filter(([_, config]) => config.category === "special")
    .map(([key, config]) => ({ key: key as RaeumungsArt, ...config }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Erhalten Sie mit wenigen Klicks Angebote in weniger als 24 Stunden
        </h2>
        <p className="text-gray-600">
          Wählen Sie die Art der Räumung/Entsorgung
        </p>
      </div>

      {/* Service badge */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-200">
          <span className="text-blue-600 font-medium">
            Ihr gewählter Service: Räumung/Entsorgung
          </span>
        </div>
      </div>

      {/* Standard Services */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full" />
          Standard-Räumungen
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {standardServices.map((service) => (
            <ServiceTypeCard
              key={service.key}
              serviceType={service.key}
              label={service.label}
              description={service.description}
              selected={value === service.key}
              onClick={() => onChange(service.key)}
            />
          ))}
        </div>
      </div>

      {/* Sensitive Services */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-500 rounded-full" />
          Sensible Räumungen
          <span className="text-xs text-gray-500 font-normal">
            - Diskret und respektvoll
          </span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sensitiveServices.map((service) => (
            <ServiceTypeCard
              key={service.key}
              serviceType={service.key}
              label={service.label}
              description={service.description}
              sensitive={service.sensitive}
              selected={value === service.key}
              onClick={() => onChange(service.key)}
            />
          ))}
        </div>
      </div>

      {/* Commercial Services */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full" />
          Gewerbliche Räumungen
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {commercialServices.map((service) => (
            <ServiceTypeCard
              key={service.key}
              serviceType={service.key}
              label={service.label}
              description={service.description}
              selected={value === service.key}
              onClick={() => onChange(service.key)}
            />
          ))}
        </div>
      </div>

      {/* Special Services */}
      {specialServices.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            Spezielle Räumungen
            <span className="text-xs text-gray-500 font-normal">
              - Rechtliche Grundlage erforderlich
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {specialServices.map((service) => (
              <ServiceTypeCard
                key={service.key}
                serviceType={service.key}
                label={service.label}
                description={service.description}
                sensitive={service.sensitive}
                selected={value === service.key}
                onClick={() => onChange(service.key)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Info box for selected sensitive service */}
      {serviceTypeConfig[value]?.sensitive && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h4 className="font-semibold text-amber-800">
                Vertrauliche Behandlung garantiert
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Ihre Anfrage wird diskret und mit höchster Sensibilität behandelt.
                Alle beteiligten Unternehmen sind auf solche Situationen spezialisiert
                und gehen respektvoll mit Ihrem Anliegen um.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step1ServiceType;


