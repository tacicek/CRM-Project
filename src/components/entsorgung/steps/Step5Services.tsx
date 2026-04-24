import { EntsorgungsZusatzleistungen } from "@/types/entsorgung";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Wrench, Package, Truck, Sparkles, FileText, ArrowDown, ArrowUp } from "lucide-react";

interface Step5ServicesProps {
  services: EntsorgungsZusatzleistungen;
  onChange: (services: EntsorgungsZusatzleistungen) => void;
}

const serviceOptions = [
  {
    key: "demontage",
    label: "Demontage",
    description: "Möbel und Geräte werden vor Ort demontiert",
    icon: Wrench,
  },
  {
    key: "verpackung",
    label: "Verpackung",
    description: "Gegenstände werden für den Transport verpackt",
    icon: Package,
  },
  {
    key: "transport_aus_wohnung",
    label: "Transport aus Wohnung",
    description: "Abholung direkt aus der Wohnung/Räumlichkeit",
    icon: Truck,
  },
  {
    key: "container_lieferung",
    label: "Container-Lieferung",
    description: "Ein Container wird vor Ort geliefert",
    icon: ArrowDown,
  },
  {
    key: "container_abholung",
    label: "Container-Abholung",
    description: "Gefüllter Container wird abgeholt",
    icon: ArrowUp,
  },
  {
    key: "besenrein",
    label: "Besenreine Übergabe",
    description: "Räumlichkeiten werden grob gereinigt",
    icon: Sparkles,
  },
  {
    key: "entsorgungsnachweis",
    label: "Entsorgungsnachweis",
    description: "Offizieller Nachweis über die fachgerechte Entsorgung",
    icon: FileText,
  },
];

export const Step5Services = ({ services, onChange }: Step5ServicesProps) => {
  const toggleService = (key: keyof EntsorgungsZusatzleistungen) => {
    onChange({ ...services, [key]: !services[key] });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Welche Zusatzleistungen benötigen Sie?
        </h2>
        <p className="mt-2 text-gray-600">
          Wählen Sie optionale Services für Ihre Entsorgung
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {serviceOptions.map(({ key, label, description, icon: Icon }) => {
          const isSelected = services[key as keyof EntsorgungsZusatzleistungen];

          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleService(key as keyof EntsorgungsZusatzleistungen)}
              className={cn(
                "flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all",
                isSelected
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className={cn(
                "p-3 rounded-lg",
                isSelected ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Label className="font-medium cursor-pointer">{label}</Label>
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center",
                    isSelected
                      ? "bg-green-500 border-green-500"
                      : "border-gray-300"
                  )}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">{description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tipp:</strong> Je mehr Zusatzleistungen Sie auswählen, desto einfacher wird die Entsorgung für Sie. 
          Die Firmen werden Ihnen entsprechende Angebote unterbreiten.
        </p>
      </div>
    </div>
  );
};

export default Step5Services;

