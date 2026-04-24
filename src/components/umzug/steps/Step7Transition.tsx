// Step7Transition.tsx - Transition to new property section

import { PropertyTypeSelector } from "../ui/PropertyTypeSelector";
import { PropertyType, PropertyDetails } from "@/types/umzug";
import { Home, ArrowRight, Check, Info } from "lucide-react";

interface Step7Props {
  data: PropertyDetails;
  onChange: (data: Partial<PropertyDetails>) => void;
}

export const Step7Transition = ({ data, onChange }: Step7Props) => {
  return (
    <div className="space-y-8">
      {/* Celebration Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Check className="w-6 h-6 text-primary" />
          </div>
          <ArrowRight className="w-6 h-6 text-gray-400" />
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Home className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </div>
        </div>
        
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          Weiter geht's!
        </h2>
        
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Kommen wir nun zu Ihrem neuen Zuhause
        </p>
      </div>

      {/* Progress Summary */}
      <div className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-full">
            <Check className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Die Informationen zu Ihrer aktuellen Unterkunft wurden erfasst.
          </p>
        </div>
      </div>

      {/* New Property Type Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Art der neuen Unterkunft
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Wohin ziehen Sie um?
        </p>
        
        <PropertyTypeSelector
          value={data.property_type}
          onChange={(value: PropertyType) => onChange({ property_type: value })}
        />
      </div>

      {/* Info Note */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Gut zu wissen:</strong> Die neue Unterkunft kann sich von der 
            aktuellen unterscheiden. Wir passen die Fragen entsprechend an.
          </p>
        </div>
      </div>
    </div>
  );
};


