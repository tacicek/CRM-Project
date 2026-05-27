// Step4CurrentFloor.tsx - Current property floor level

import { FloorSelector } from "../ui/FloorSelector";
import { PropertyDetails, FloorLevel } from "@/types/umzug";
import { Layers, Home, Package, Info } from "lucide-react";

interface Step4Props {
  data: PropertyDetails;
  onChange: (data: Partial<PropertyDetails>) => void;
}

export const Step4CurrentFloor = ({ data, onChange }: Step4Props) => {
  // Skip floor selection for houses and storage
  if (data.property_type === 'haus' || data.property_type === 'lager') {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <Layers className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            Stockwerkinformation
          </h2>
          <div className="p-6 rounded-xl bg-gray-50 border border-gray-200 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 text-gray-600">
              {data.property_type === 'haus' ? <Home className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              <p>
                {data.property_type === 'haus' 
                  ? 'Bei einem Haus ist keine Stockwerkauswahl erforderlich.'
                  : 'Bei einem Lager ist keine Stockwerkauswahl erforderlich.'
                }
              </p>
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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <Layers className="w-8 h-8 text-gray-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
          Stockwerk, wo sich die Wohnung befindet
        </h2>
        <p className="text-gray-600">
          Das Stockwerk beeinflusst den Aufwand und die Kosten
        </p>
      </div>

      {/* Floor Selection */}
      <FloorSelector
        value={data.stockwerk}
        onChange={(value: FloorLevel) => onChange({ stockwerk: value })}
      />

      {/* Info based on floor */}
      {data.stockwerk && (
        <div className="p-4 rounded-xl border bg-gray-50 border-gray-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600">
              {data.stockwerk === 'basement' && (
                <>
                  <strong>Untergeschoss:</strong> Der Zugang kann eingeschränkt sein. 
                  Wir prüfen im nächsten Schritt die Liftmöglichkeiten.
                </>
              )}
              {(data.stockwerk === 'ground_floor' || data.stockwerk === 'raised_ground') && (
                <>
                  <strong>Erdgeschoss/Hochparterre:</strong> Ideale Bedingungen für einen 
                  schnellen und unkomplizierten Umzug!
                </>
              )}
              {(data.stockwerk === 'floor_1' || data.stockwerk === 'floor_2') && (
                <>
                  <strong>1.-2. Stock:</strong> Mit Lift problemlos, ohne Lift etwas mehr 
                  Aufwand. Wir fragen gleich nach.
                </>
              )}
              {(data.stockwerk === 'floor_3' || data.stockwerk === 'floor_4') && (
                <>
                  <strong>3.-4. Stock:</strong> Ein Lift ist hier sehr hilfreich. 
                  Alternativ kann ein Möbellift eingesetzt werden.
                </>
              )}
              {data.stockwerk === 'floor_5_plus' && (
                <>
                  <strong>5.+ Stock:</strong> Bei hohen Stockwerken empfehlen wir einen 
                  Lift oder Möbellift für grosse Möbelstücke.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};


