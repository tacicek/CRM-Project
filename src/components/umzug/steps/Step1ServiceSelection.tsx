// Step1ServiceSelection.tsx - Service and property type selection

import { PropertyTypeSelector } from "../ui/PropertyTypeSelector";
import { PropertyType, PropertyDetails } from "@/types/umzug";
import { Truck, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step1Props {
  data: PropertyDetails;
  onChange: (data: Partial<PropertyDetails>) => void;
  serviceType: "umzug_privat" | "umzug_firma";
  onServiceTypeChange: (value: "umzug_privat" | "umzug_firma") => void;
}

export const Step1ServiceSelection = ({ data, onChange, serviceType, onServiceTypeChange }: Step1Props) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          Erhalten Sie mit wenigen Klicks Angebote
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          in weniger als 24 Stunden
        </p>
      </div>

      {/* Service Type Selection: Privat vs. Firma */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Art des Umzugs</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onServiceTypeChange("umzug_privat")}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
              serviceType === "umzug_privat"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md"
                : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
            )}
          >
            <Truck className={cn("w-6 h-6", serviceType === "umzug_privat" ? "text-blue-600" : "text-gray-400")} />
            <span className="font-semibold text-sm">Privatumzug</span>
            <span className="text-xs text-gray-500">Für Privatpersonen</span>
          </button>
          <button
            type="button"
            onClick={() => onServiceTypeChange("umzug_firma")}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
              serviceType === "umzug_firma"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md"
                : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
            )}
          >
            <Building2 className={cn("w-6 h-6", serviceType === "umzug_firma" ? "text-blue-600" : "text-gray-400")} />
            <span className="font-semibold text-sm">Firmenumzug</span>
            <span className="text-xs text-gray-500">Für Unternehmen</span>
          </button>
        </div>
      </div>

      {/* Property Type Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Art der aktuellen Unterkunft
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Von wo ziehen Sie um?
        </p>
        
        <PropertyTypeSelector
          value={data.property_type}
          onChange={(value: PropertyType) => onChange({ property_type: value })}
        />
      </div>

      {/* Info box for property-specific hints */}
      {data.property_type && (
        <div className={cn(
          "p-4 rounded-xl border",
          "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
        )}>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {data.property_type === 'haus' && (
              <>
                <strong>Haus:</strong> Bei einem Haus werden zusätzliche Fragen zu Garage, 
                Garten und mehreren Stockwerken gestellt.
              </>
            )}
            {data.property_type === 'wohnung' && (
              <>
                <strong>Wohnung:</strong> Wir fragen nach Stockwerk und Liftinformationen 
                für eine genaue Kalkulation.
              </>
            )}
            {data.property_type === 'wg_zimmer' && (
              <>
                <strong>WG-Zimmer:</strong> Das Inventar wird vereinfacht - nur das 
                Wesentliche für Ihr Zimmer.
              </>
            )}
            {data.property_type === 'lager' && (
              <>
                <strong>Lager:</strong> Wir konzentrieren uns auf Lagergrösse und 
                spezielle Anforderungen.
              </>
            )}
            {data.property_type === 'buero' && (
              <>
                <strong>Büro:</strong> Zusätzliche Optionen für IT-Equipment und 
                Wochenend-Umzüge verfügbar.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
};


