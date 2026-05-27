import { Info } from "lucide-react";
import { PriceEstimate, instrumentSpecs, InstrumentType } from "@/types/klaviertransport";

interface CostEstimateProps {
  estimate: PriceEstimate;
  instrumentType?: InstrumentType;
  showDetails?: boolean;
}

export function CostEstimate({ estimate, instrumentType, showDetails = false }: CostEstimateProps) {
  const spec = instrumentType ? instrumentSpecs[instrumentType] : null;
  
  if (estimate.total === 0) {
    return null;
  }
  
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">💰</span>
        <h4 className="font-semibold text-gray-800">Preisindikation</h4>
      </div>
      
      {showDetails ? (
        <div className="space-y-2 text-sm">
          {/* Base Price */}
          <div className="flex justify-between">
            <span className="text-gray-600">
              Basistransport {spec?.labelShort}
            </span>
            <span className="font-medium">CHF {estimate.basis}.-</span>
          </div>
          
          {/* Pickup Floor */}
          {estimate.abholort_floor > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Abholort (Stockwerk)</span>
              <span className="font-medium">CHF {estimate.abholort_floor}.-</span>
            </div>
          )}
          
          {/* Delivery Floor */}
          {estimate.lieferort_floor > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Lieferort (Stockwerk)</span>
              <span className="font-medium">CHF {estimate.lieferort_floor}.-</span>
            </div>
          )}
          
          {/* Distance */}
          {estimate.distance > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Distanz</span>
              <span className="font-medium">CHF {estimate.distance}.-</span>
            </div>
          )}
          
          {/* Equipment */}
          {estimate.equipment > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Spezialequipment</span>
              <span className="font-medium">CHF {estimate.equipment}.-</span>
            </div>
          )}
          
          {/* Services */}
          {estimate.services.stimmen > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Klavierstimmen</span>
              <span className="font-medium">CHF {estimate.services.stimmen}.-</span>
            </div>
          )}
          {estimate.services.verpackung > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Spezialverpackung</span>
              <span className="font-medium">CHF {estimate.services.verpackung}.-</span>
            </div>
          )}
          {estimate.services.lagerung > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Zwischenlagerung</span>
              <span className="font-medium">CHF {estimate.services.lagerung}.-/Mt.</span>
            </div>
          )}
          {estimate.services.versicherung > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Zusatzversicherung</span>
              <span className="font-medium">CHF {estimate.services.versicherung}.-</span>
            </div>
          )}
          {estimate.services.entsorgung > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Altinstrument entsorgen</span>
              <span className="font-medium">CHF {estimate.services.entsorgung}.-</span>
            </div>
          )}
          
          {/* Divider */}
          <div className="border-t border-blue-200 my-2 pt-2">
            <div className="flex justify-between text-base font-semibold">
              <span>Geschätzter Preis</span>
              <span className="text-blue-600">CHF {estimate.total}.-</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600 mb-1">
            CHF {estimate.total}.-
          </div>
          <div className="text-sm text-gray-500">
            Geschätzter Preis
          </div>
        </div>
      )}
      
      {/* Info Note */}
      <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Endpreis nach Besichtigung / Detailabklärung. Preise exkl. MwSt.</span>
      </div>
    </div>
  );
}


