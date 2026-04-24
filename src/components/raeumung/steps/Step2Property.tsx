// Step2Property.tsx - Property details step for Räumung wizard

import { PropertyDetails, PropertyType, RaeumungsArt } from "@/types/raeumung";
import { FillLevelSlider } from "../ui/FillLevelSlider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface PropertyOption {
  value: PropertyType;
  label: string;
  icon: string;
}

const propertyOptions: PropertyOption[] = [
  { value: "apartment", label: "Wohnung", icon: "🏢" },
  { value: "house", label: "Einfamilienhaus", icon: "🏡" },
  { value: "multi_family", label: "Mehrfamilienhaus", icon: "🏘️" },
  { value: "townhouse", label: "Reihenhaus", icon: "🏠" },
  { value: "office_building", label: "Bürogebäude", icon: "🏢💼" },
  { value: "warehouse", label: "Lagerhalle", icon: "🏭" },
  { value: "cellar_only", label: "Nur Keller", icon: "🚪" },
  { value: "attic_only", label: "Nur Estrich", icon: "🏚️" },
  { value: "garage_only", label: "Nur Garage", icon: "🚗" },
];

interface Step2PropertyProps {
  property: PropertyDetails;
  onChange: (property: PropertyDetails) => void;
  serviceType: RaeumungsArt;
}

export const Step2Property = ({ property, onChange, serviceType }: Step2PropertyProps) => {
  // Check if we should show full property details or simplified version
  const isStorageType = ["cellar_only", "attic_only", "garage_only"].includes(property.type);
  const isCommercial = ["office_building", "warehouse"].includes(property.type);

  // Filter property options based on service type
  const filteredOptions = propertyOptions.filter((opt) => {
    if (serviceType === "cellar_clearance") return opt.value === "cellar_only";
    if (serviceType === "attic_clearance") return opt.value === "attic_only";
    if (serviceType === "garage_clearance") return opt.value === "garage_only";
    if (serviceType === "office_clearance" || serviceType === "company_dissolution") {
      return ["office_building", "warehouse"].includes(opt.value);
    }
    if (serviceType === "storage_clearance") return opt.value === "warehouse";
    // Default: show residential options
    return !["cellar_only", "attic_only", "garage_only"].includes(opt.value);
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Details zum Objekt
        </h2>
        <p className="text-gray-600">
          Geben Sie uns mehr Informationen über das zu räumende Objekt
        </p>
      </div>

      {/* Property Type Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Art der Unterkunft</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...property, type: option.value })}
              className={cn(
                "flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200",
                "hover:border-blue-300 hover:shadow-sm",
                property.type === option.value
                  ? "border-blue-500 bg-blue-50/50 shadow-md"
                  : "border-gray-200 bg-white"
              )}
            >
              {property.type === option.value && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <span className="text-2xl mb-2">{option.icon}</span>
              <span className={cn(
                "font-medium text-sm text-center",
                property.type === option.value ? "text-blue-700" : "text-gray-700"
              )}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Conditional fields based on property type */}
      {!isStorageType && (
        <>
          {/* Room count */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base font-medium">Anzahl Zimmer</Label>
              <span className="text-lg font-semibold text-blue-600">
                {property.zimmer_anzahl} Zimmer
              </span>
            </div>
            <div className="relative">
              <Slider
                value={[property.zimmer_anzahl || 3]}
                onValueChange={(vals) => onChange({ ...property, zimmer_anzahl: vals[0] })}
                min={1}
                max={12}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1</span>
                <span>3</span>
                <span>5</span>
                <span>7</span>
                <span>10+</span>
              </div>
            </div>
          </div>

          {/* Floor count (for maisonette/multi-story) */}
          {(property.type === "house" || property.type === "townhouse" || property.type === "multi_family") && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium">
                  Anzahl Stockwerke
                  <span className="text-sm text-gray-500 font-normal ml-2">
                    (z.B. Maisonette)
                  </span>
                </Label>
                <span className="text-lg font-semibold text-blue-600">
                  {property.stockwerke || 1}
                </span>
              </div>
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => onChange({ ...property, stockwerke: num })}
                    className={cn(
                      "flex-1 py-3 rounded-lg border-2 font-medium transition-all",
                      property.stockwerke === num
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-blue-300"
                    )}
                  >
                    {num}{num === 5 ? "+" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Living area / Storage area */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-base font-medium">
            {isStorageType ? "Fläche" : "Wohnfläche"} in m²
          </Label>
          <span className="text-lg font-semibold text-blue-600">
            {property.flaeche_m2} m²
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Input
            type="number"
            value={property.flaeche_m2 || ""}
            onChange={(e) => onChange({ ...property, flaeche_m2: parseInt(e.target.value) || 0 })}
            min={1}
            max={1000}
            className="w-32 text-center text-lg font-medium"
          />
          <Slider
            value={[property.flaeche_m2 || 50]}
            onValueChange={(vals) => onChange({ ...property, flaeche_m2: vals[0] })}
            min={5}
            max={500}
            step={5}
            className="flex-1"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>5 m²</span>
          <span>100 m²</span>
          <span>250 m²</span>
          <span>500+ m²</span>
        </div>
      </div>

      {/* Fill level (especially for storage/cellar/attic) */}
      <div className="space-y-4">
        <FillLevelSlider
          value={property.fuellgrad || 50}
          onChange={(value) => onChange({ ...property, fuellgrad: value })}
          label="Füllgrad des Objekts"
        />
      </div>

      {/* Info box for commercial */}
      {isCommercial && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💼</span>
            <div>
              <h4 className="font-semibold text-purple-800">
                Gewerbliche Räumung
              </h4>
              <p className="text-sm text-purple-700 mt-1">
                Für gewerbliche Räumungen bieten wir spezielle Lösungen an,
                einschliesslich IT-Entsorgung, Aktenschredderung und
                Inventarlisten für Versicherungszwecke.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step2Property;


