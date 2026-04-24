// Step11NewLift.tsx - New property lift information

import { LiftSelector } from "../ui/LiftSelector";
import { PropertyDetails, LiftType } from "@/types/umzug";
import { cn } from "@/lib/utils";
import { Info, Check, X, Home } from "lucide-react";

interface Step11Props {
  data: PropertyDetails;
  onChange: (data: Partial<PropertyDetails>) => void;
}

export const Step11NewLift = ({ data, onChange }: Step11Props) => {
  const hasLift = data.lift?.vorhanden ?? false;

  // Skip lift selection for houses
  if (data.property_type === 'haus') {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
            Liftinformationen - Neue Adresse
          </h2>
          <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <Home className="w-5 h-5" />
              <p>Bei einem Haus ist typischerweise kein Lift vorhanden.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          Liftinformationen - Neue Adresse
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Informationen zum Lift in Ihrer neuen Unterkunft
        </p>
      </div>

      {/* Lift Yes/No Selection */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">
          Ist ein Lift vorhanden?
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onChange({ 
              lift: { ...data.lift, vorhanden: true } 
            })}
            className={cn(
              "p-4 rounded-xl border-2 transition-all duration-200",
              "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary",
              hasLift
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50"
            )}
          >
            <div className={cn(
              "w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center",
              hasLift ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-gray-700 text-gray-500"
            )}>
              <Check className="w-5 h-5" />
            </div>
            <span className={cn(
              "font-semibold",
              hasLift ? "text-primary" : "text-gray-700 dark:text-gray-300"
            )}>
              Ja
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => onChange({ 
              lift: { vorhanden: false } 
            })}
            className={cn(
              "p-4 rounded-xl border-2 transition-all duration-200",
              "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary",
              !hasLift
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50"
            )}
          >
            <div className={cn(
              "w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center",
              !hasLift ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-gray-700 text-gray-500"
            )}>
              <X className="w-5 h-5" />
            </div>
            <span className={cn(
              "font-semibold",
              !hasLift ? "text-primary" : "text-gray-700 dark:text-gray-300"
            )}>
              Nein
            </span>
          </button>
        </div>
      </div>

      {/* Lift Type Selection */}
      {hasLift && (
        <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">
            Welcher Lifttyp ist vorhanden?
          </h3>
          
          <LiftSelector
            value={data.lift?.typ || 'small_elevator'}
            onChange={(value: LiftType) => onChange({ 
              lift: { ...data.lift, vorhanden: true, typ: value } 
            })}
          />
          
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Super!</strong> Ein Lift erleichtert den Einzug erheblich und 
              verkürzt die Umzugszeit.
            </p>
          </div>
        </div>
      )}

      {/* No lift info */}
      {!hasLift && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-4 duration-300">
          <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Hinweis:</strong> Ohne Lift planen wir entsprechend mehr Zeit 
            für den Einzug ein. Bei höheren Stockwerken kann ein Möbellift 
            eine gute Alternative sein.
          </p>
        </div>
      )}
    </div>
  );
};


