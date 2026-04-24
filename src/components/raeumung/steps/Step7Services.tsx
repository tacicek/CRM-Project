// Step7Services.tsx - Additional services step for Räumung wizard

import { AdditionalServicesRaeumung, RaeumungsArt, getSpecialServices } from "@/types/raeumung";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ServiceToggle {
  key: keyof AdditionalServicesRaeumung;
  label: string;
  description: string;
  icon: string;
  hasExtra?: boolean;
}

const baseServices: ServiceToggle[] = [
  {
    key: "demontage",
    label: "Möbeldemontage",
    description: "Zerlegung von Möbeln für einfacheren Transport",
    icon: "🔧",
  },
  {
    key: "entsorgung",
    label: "Fachgerechte Entsorgung",
    description: "Umweltgerechte Entsorgung aller Gegenstände",
    icon: "♻️",
  },
  {
    key: "recycling",
    label: "Recycling / Wiederverwertung",
    description: "Maximale Wiederverwertung von Materialien",
    icon: "🌱",
  },
  {
    key: "endreinigung",
    label: "Endreinigung",
    description: "Reinigung nach der Räumung",
    icon: "🧹",
    hasExtra: true,
  },
  {
    key: "renovation",
    label: "Kleinrenovation",
    description: "Kleine Reparaturen und Ausbesserungen",
    icon: "🔨",
  },
  {
    key: "wertanrechnung",
    label: "Wertanrechnung",
    description: "Verwertbare Gegenstände werden angerechnet",
    icon: "💰",
  },
  {
    key: "dokumentensicherung",
    label: "Dokumentensicherung",
    description: "Sichere Aufbewahrung wichtiger Dokumente",
    icon: "📄",
  },
  {
    key: "einlagerung",
    label: "Zwischenlagerung",
    description: "Temporäre Lagerung von Gegenständen",
    icon: "📦",
    hasExtra: true,
  },
];

interface Step7ServicesProps {
  services: AdditionalServicesRaeumung;
  onChange: (services: AdditionalServicesRaeumung) => void;
  serviceType: RaeumungsArt;
}

export const Step7Services = ({ services, onChange, serviceType }: Step7ServicesProps) => {
  const specialServiceKeys = getSpecialServices(serviceType);
  
  const handleToggle = (key: keyof AdditionalServicesRaeumung) => {
    if (key === "endreinigung") {
      onChange({
        ...services,
        endreinigung: {
          ...services.endreinigung,
          aktiv: !services.endreinigung.aktiv,
        },
      });
    } else if (key === "einlagerung") {
      onChange({
        ...services,
        einlagerung: {
          ...services.einlagerung,
          aktiv: !services.einlagerung.aktiv,
        },
      });
    } else {
      onChange({
        ...services,
        [key]: !services[key as keyof AdditionalServicesRaeumung],
      });
    }
  };

  const isServiceActive = (key: keyof AdditionalServicesRaeumung): boolean => {
    if (key === "endreinigung") return services.endreinigung?.aktiv ?? false;
    if (key === "einlagerung") return services.einlagerung?.aktiv ?? false;
    return services[key] as boolean;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Zusätzliche Dienstleistungen
        </h2>
        <p className="text-gray-600">
          Wählen Sie optionale Services für Ihre Räumung
        </p>
      </div>

      {/* Main services */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Standard-Dienstleistungen</Label>
        <div className="space-y-3">
          {baseServices.map((service) => (
            <div key={service.key} className="space-y-3">
              <div
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                  isServiceActive(service.key)
                    ? "border-blue-500 bg-blue-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{service.icon}</span>
                  <div>
                    <span className="font-medium">{service.label}</span>
                    <p className="text-sm text-gray-500">{service.description}</p>
                  </div>
                </div>
                <Switch
                  checked={isServiceActive(service.key)}
                  onCheckedChange={() => handleToggle(service.key)}
                />
              </div>

              {/* Extra options for Endreinigung */}
              {service.key === "endreinigung" && services.endreinigung?.aktiv && (
                <div className="ml-12 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Label className="text-sm font-medium mb-3 block">
                    Art der Reinigung
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...services,
                          endreinigung: { ...services.endreinigung, typ: "besenrein" },
                        })
                      }
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all text-left",
                        services.endreinigung.typ === "besenrein"
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300"
                      )}
                    >
                      <span className="font-medium text-sm">Besenrein</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Grobe Reinigung, alle Gegenstände entfernt
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...services,
                          endreinigung: { ...services.endreinigung, typ: "abgabegarantie" },
                        })
                      }
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all text-left",
                        services.endreinigung.typ === "abgabegarantie"
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300"
                      )}
                    >
                      <span className="font-medium text-sm">Abnahmegarantie</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Professionelle Endreinigung mit Garantie
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Extra options for Einlagerung */}
              {service.key === "einlagerung" && services.einlagerung?.aktiv && (
                <div className="ml-12 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-sm font-medium">Lagerdauer</Label>
                    <span className="text-lg font-semibold text-blue-600">
                      {services.einlagerung.dauer_wochen || 4} Wochen
                    </span>
                  </div>
                  <Slider
                    value={[services.einlagerung.dauer_wochen || 4]}
                    onValueChange={(vals) =>
                      onChange({
                        ...services,
                        einlagerung: { ...services.einlagerung, dauer_wochen: vals[0] },
                      })
                    }
                    min={1}
                    max={52}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 Woche</span>
                    <span>3 Monate</span>
                    <span>6 Monate</span>
                    <span>1 Jahr</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Special services based on service type */}
      {specialServiceKeys.length > 0 && (
        <div className="space-y-4">
          <Label className="text-base font-medium flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
            Spezielle Dienstleistungen
          </Label>
          <div className="space-y-3">
            {specialServiceKeys.includes("wertsachen_sicherung") && (
              <div
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                  services.wertsachen_sicherung
                    ? "border-amber-500 bg-amber-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">💎</span>
                  <div>
                    <span className="font-medium">Wertsachensicherung</span>
                    <p className="text-sm text-gray-500">
                      Sichere Aufbewahrung von Schmuck, Bargeld etc.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={services.wertsachen_sicherung ?? false}
                  onCheckedChange={(checked) =>
                    onChange({ ...services, wertsachen_sicherung: checked })
                  }
                />
              </div>
            )}

            {specialServiceKeys.includes("inventarliste") && (
              <div
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                  services.inventarliste
                    ? "border-amber-500 bg-amber-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">📋</span>
                  <div>
                    <span className="font-medium">Detaillierte Inventarliste</span>
                    <p className="text-sm text-gray-500">
                      Dokumentation aller Gegenstände für Erben/Versicherung
                    </p>
                  </div>
                </div>
                <Switch
                  checked={services.inventarliste ?? false}
                  onCheckedChange={(checked) =>
                    onChange({ ...services, inventarliste: checked })
                  }
                />
              </div>
            )}

            {specialServiceKeys.includes("behoerden_koordination") && (
              <div
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                  services.behoerden_koordination
                    ? "border-amber-500 bg-amber-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">⚖️</span>
                  <div>
                    <span className="font-medium">Behördenkoordination</span>
                    <p className="text-sm text-gray-500">
                      Abstimmung mit Gerichtsvollzieher / Behörden
                    </p>
                  </div>
                </div>
                <Switch
                  checked={services.behoerden_koordination ?? false}
                  onCheckedChange={(checked) =>
                    onChange({ ...services, behoerden_koordination: checked })
                  }
                />
              </div>
            )}

            {specialServiceKeys.includes("pflicht_einlagerung") && (
              <div
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                  services.pflicht_einlagerung
                    ? "border-amber-500 bg-amber-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">📦</span>
                  <div>
                    <span className="font-medium">Pflichteinlagerung</span>
                    <p className="text-sm text-gray-500">
                      Gesetzlich vorgeschriebene Aufbewahrung (2 Monate)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={services.pflicht_einlagerung ?? false}
                  onCheckedChange={(checked) =>
                    onChange({ ...services, pflicht_einlagerung: checked })
                  }
                />
              </div>
            )}

            {specialServiceKeys.includes("raeumungsprotokoll") && (
              <div
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                  services.raeumungsprotokoll
                    ? "border-amber-500 bg-amber-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">📝</span>
                  <div>
                    <span className="font-medium">Räumungsprotokoll</span>
                    <p className="text-sm text-gray-500">
                      Rechtlich verwertbare Dokumentation
                    </p>
                  </div>
                </div>
                <Switch
                  checked={services.raeumungsprotokoll ?? false}
                  onCheckedChange={(checked) =>
                    onChange({ ...services, raeumungsprotokoll: checked })
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="font-semibold text-blue-800">
              Tipp: Wertanrechnung
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              Bei aktivierter Wertanrechnung werden noch verwertbare Gegenstände
              (Möbel, Elektrogeräte) vom Endpreis abgezogen. Dies kann die
              Gesamtkosten erheblich reduzieren.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step7Services;


