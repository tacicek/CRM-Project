import { MoebelliftAnfrage, estimatePrice, floorHeights } from "@/types/moebellift";

interface PriceEstimateProps {
  data: MoebelliftAnfrage;
}

export function PriceEstimate({ data }: PriceEstimateProps) {
  const totalPrice = estimatePrice(data);
  
  // Service type label
  const serviceLabels = {
    with_operator: 'Mit Bediener',
    self_service: 'Ohne Bediener',
    pickup: 'Selbstabholung'
  };
  
  // Duration label
  const durationLabels = {
    short: 'Kurz (1-2h)',
    half_day: 'Halbtags (3-4h)',
    full_day: 'Ganztags (5-8h)',
    multi_day: 'Mehrtägig'
  };
  
  // Calculate line items
  const lineItems: { label: string; value: string; included?: boolean }[] = [];
  
  // Base service
  const basePrices = {
    short: { with_operator: 250, self_service: 180, pickup: 150 },
    half_day: { with_operator: 420, self_service: 300, pickup: 230 },
    full_day: { with_operator: 720, self_service: 480, pickup: 380 },
    multi_day: { with_operator: 650, self_service: 430, pickup: 340 }
  };
  
  lineItems.push({
    label: `Möbellift ${serviceLabels[data.service_type]} (${durationLabels[data.termin.dauer].toLowerCase()})`,
    value: `CHF ${basePrices[data.termin.dauer][data.service_type]}.-`
  });
  
  // Location
  lineItems.push({
    label: `Region ${data.einsatzort.adresse.ort || 'Schweiz'}`,
    value: 'inkl.',
    included: true
  });
  
  // Floor
  const floorHeight = floorHeights[data.einsatzort.stockwerk];
  const floorSurcharge: Record<string, number> = {
    floor_1: 0, floor_2: 0, floor_3: 0,
    floor_4: 50, floor_5: 80,
    floor_6: 120, floor_7_plus: 150, roof: 180
  };
  const floorCost = floorSurcharge[data.einsatzort.stockwerk];
  lineItems.push({
    label: `${data.einsatzort.stockwerk.replace('floor_', '').replace('_plus', '+')}. Stock (~${floorHeight}m Höhe)`,
    value: floorCost > 0 ? `CHF ${floorCost}.-` : 'inkl.',
    included: floorCost === 0
  });
  
  // Travel
  lineItems.push({
    label: 'Anfahrt/Rückfahrt',
    value: 'inkl.',
    included: true
  });
  
  // Additional services
  const additionalItems: { label: string; value: string }[] = [];
  
  if (data.zusatzleistungen.halteverbot) {
    additionalItems.push({
      label: 'Halteverbotszone',
      value: 'CHF 180.-'
    });
  }
  
  if (data.zusatzleistungen.helfer.aktiv) {
    const hours = data.termin.dauer === 'short' ? 2 : data.termin.dauer === 'half_day' ? 4 : 8;
    const helperCost = data.zusatzleistungen.helfer.anzahl * 50 * hours;
    additionalItems.push({
      label: `${data.zusatzleistungen.helfer.anzahl}x Zusätzlicher Helfer (${hours}h)`,
      value: `CHF ${helperCost}.-`
    });
  }
  
  if (data.zusatzleistungen.verpackung) {
    additionalItems.push({
      label: 'Verpackungsmaterial',
      value: 'CHF 80.-'
    });
  }
  
  if (data.zusatzleistungen.entsorgung) {
    additionalItems.push({
      label: 'Entsorgung Altmöbel',
      value: 'CHF 120.-'
    });
  }
  
  if (data.zusatzleistungen.lagerung) {
    additionalItems.push({
      label: 'Zwischenlagerung',
      value: 'CHF 100.-'
    });
  }
  
  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">💰</span>
        <h3 className="text-lg font-semibold text-gray-800">Preisindikation</h3>
      </div>
      
      {/* Base service items */}
      <div className="space-y-2 mb-4">
        {lineItems.map((item, index) => (
          <div key={index} className="flex justify-between items-center text-sm">
            <span className="text-gray-600">{item.label}</span>
            <span className={item.included ? "text-gray-400" : "text-gray-800 font-medium"}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
      
      {/* Additional services */}
      {additionalItems.length > 0 && (
        <>
          <div className="border-t border-orange-200 my-3" />
          <p className="text-sm font-medium text-gray-700 mb-2">Zusatzleistungen</p>
          <div className="space-y-2 mb-4">
            {additionalItems.map((item, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{item.label}</span>
                <span className="text-gray-800 font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
      
      {/* Total */}
      <div className="border-t border-orange-300 pt-3 mt-3">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-gray-800">Geschätzter Gesamtpreis</span>
          <span className="text-xl font-bold text-orange-600">CHF {totalPrice}.-</span>
        </div>
      </div>
      
      {/* Info note */}
      <div className="flex items-start gap-2 mt-4 p-3 bg-white/60 rounded-lg">
        <svg className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-gray-600">
          Endpreis nach Bestätigung der Details. Mindestbuchung: 2 Stunden.
        </p>
      </div>
      
      {/* Hourly rate info */}
      <div className="mt-3 text-center">
        <span className="text-xs text-gray-500">
          Stundensatz ab 4h: <strong className="text-gray-700">CHF 75.-/h</strong>
        </span>
      </div>
    </div>
  );
}


