// Step5CurrentLift.tsx - Current property lift information

import { LiftSelector } from "../ui/LiftSelector";
import { PropertyDetails, LiftType } from "@/types/umzug";
import { cn } from "@/lib/utils";
import { Info, Check, X, Home, AlertTriangle } from "lucide-react";

interface Step5Props {
  data: PropertyDetails;
  onChange: (data: Partial<PropertyDetails>) => void;
}

export const Step5CurrentLift = ({ data, onChange }: Step5Props) => {
  const hasLift = data.lift?.vorhanden ?? false;

  // Skip lift selection for houses
  if (data.property_type === 'haus') {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            Liftinformationen
          </h2>
          <div className="p-6 rounded-xl bg-gray-50 border border-gray-200 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Home className="w-5 h-5" />
              <p>Bei einem Haus ist typischerweise kein Lift vorhanden. 
              Wir berücksichtigen die Anzahl der Stockwerke aus dem vorherigen Schritt.</p>
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
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
          Liftinformationen
        </h2>
        <p className="text-gray-600">
          Ein Lift erleichtert den Transport erheblich
        </p>
      </div>

      {/* Lift Yes/No Selection */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">
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
                ? "border-primary bg-primary/5"
                : "border-gray-200 bg-white hover:border-primary/50"
            )}
          >
            <div className={cn(
              "w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center",
              hasLift ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
            )}>
              <Check className="w-5 h-5" />
            </div>
            <span className={cn(
              "font-semibold",
              hasLift ? "text-primary" : "text-gray-700"
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
                ? "border-primary bg-primary/5"
                : "border-gray-200 bg-white hover:border-primary/50"
            )}
          >
            <div className={cn(
              "w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center",
              !hasLift ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
            )}>
              <X className="w-5 h-5" />
            </div>
            <span className={cn(
              "font-semibold",
              !hasLift ? "text-primary" : "text-gray-700"
            )}>
              Nein
            </span>
          </button>
        </div>
      </div>

      {/* Lift Type Selection (if lift exists) */}
      {hasLift && (
        <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
          <h3 className="font-semibold text-gray-800">
            Welcher Lifttyp ist vorhanden?
          </h3>
          
          <LiftSelector
            value={data.lift?.typ || 'small_elevator'}
            onChange={(value: LiftType) => onChange({ 
              lift: { ...data.lift, vorhanden: true, typ: value } 
            })}
          />
          
          {/* Tooltip info */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <Info className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600">
              <strong>Tipp:</strong> Grössere Lifte ermöglichen den Transport von Möbeln 
              ohne Demontage. Bei kleinen Liften müssen Schränke und Betten oft 
              zerlegt werden.
            </p>
          </div>
        </div>
      )}

      {/* No lift warning */}
      {!hasLift && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200 animate-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-600">
              <strong>Hinweis:</strong> Ohne Lift kann der Umzug je nach Stockwerk 
              mehr Zeit und Personal erfordern.
            </p>
            {data.stockwerk === 'floor_5_plus' && (
              <p className="text-sm text-gray-500 mt-2">
                Bei 5+ Stockwerken ohne Lift empfehlen wir die Nutzung eines Möbellifts.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


