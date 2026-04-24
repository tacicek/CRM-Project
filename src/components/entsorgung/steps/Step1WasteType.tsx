import { EntsorgungsArt, getEntsorgungsArtLabel, getEntsorgungsArtDescription } from "@/types/entsorgung";
import { cn } from "@/lib/utils";
import { Sofa, Monitor, Construction, TreePine, Home, Building2, AlertTriangle, Layers } from "lucide-react";

interface Step1WasteTypeProps {
  value: EntsorgungsArt | undefined;
  onChange: (value: EntsorgungsArt) => void;
}

const wasteTypes: { type: EntsorgungsArt; icon: React.ElementType; color: string }[] = [
  { type: "sperrmuell", icon: Sofa, color: "bg-amber-500" },
  { type: "elektronik", icon: Monitor, color: "bg-blue-500" },
  { type: "bauschutt", icon: Construction, color: "bg-orange-500" },
  { type: "gruenabfall", icon: TreePine, color: "bg-green-500" },
  { type: "haushalt", icon: Home, color: "bg-purple-500" },
  { type: "gewerbe", icon: Building2, color: "bg-indigo-500" },
  { type: "sondermuell", icon: AlertTriangle, color: "bg-red-500" },
  { type: "mischmuell", icon: Layers, color: "bg-gray-500" },
];

export const Step1WasteType = ({ value, onChange }: Step1WasteTypeProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Was möchten Sie entsorgen?
        </h2>
        <p className="mt-2 text-gray-600">
          Wählen Sie die Art des Abfalls, den Sie entsorgen möchten
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {wasteTypes.map(({ type, icon: Icon, color }) => {
          const isSelected = value === type;
          const label = getEntsorgungsArtLabel(type);
          const description = getEntsorgungsArtDescription(type);

          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={cn(
                "relative flex flex-col items-center p-6 rounded-xl border-2 transition-all duration-200",
                "hover:shadow-lg hover:scale-[1.02]",
                isSelected
                  ? "border-green-500 bg-green-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <div className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center mb-3",
                isSelected ? color : "bg-gray-100"
              )}>
                <Icon className={cn(
                  "w-7 h-7",
                  isSelected ? "text-white" : "text-gray-500"
                )} />
              </div>
              <h3 className={cn(
                "font-semibold text-center",
                isSelected ? "text-green-700" : "text-gray-900"
              )}>
                {label}
              </h3>
              <p className="mt-1 text-xs text-gray-500 text-center line-clamp-2">
                {description}
              </p>
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {value === "sondermuell" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">Wichtiger Hinweis</h4>
              <p className="mt-1 text-sm text-red-700">
                Sondermüll wie Farben, Chemikalien oder Asbest erfordert spezielle Entsorgungsverfahren. 
                Wir werden Sie mit zertifizierten Fachbetrieben verbinden.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step1WasteType;

