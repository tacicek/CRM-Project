import { cn } from "@/lib/utils";
import { 
  KlaviertransportAnfrage, 
  EquipmentType,
  DemontageType,
  instrumentSpecs
} from "@/types/klaviertransport";

interface Step5Props {
  data: Partial<KlaviertransportAnfrage>;
  updateData: (field: keyof KlaviertransportAnfrage, value: unknown) => void;
  errors: Record<string, string>;
}

const equipmentOptions: { value: EquipmentType; label: string; description: string; icon: string; price?: string }[] = [
  { value: 'none', label: 'Keines / Standard', description: 'Standardausrüstung genügt', icon: '✓', price: 'inkl.' },
  { value: 'furniture_lift', label: 'Möbellift / Aussenlift', description: 'Externer Lift über Fenster/Balkon', icon: '🏗️', price: '+CHF 250-400' },
  { value: 'crane', label: 'Kran', description: 'Für sehr schwierige Zugänge', icon: '🏗️', price: '+CHF 500-1000+' },
  { value: 'platform', label: 'Bühne / Hebebühne', description: 'Ladeplattform', icon: '📦', price: '+CHF 150-250' },
  { value: 'assessment', label: 'Unsicher - Beratung', description: 'Wir beraten Sie gerne', icon: '❓', price: 'kostenlos' }
];

const demontageOptions: { value: DemontageType; label: string; description: string }[] = [
  { value: 'no', label: 'Nein', description: 'Keine Demontage nötig' },
  { value: 'legs_only', label: 'Ja - Beine abnehmen', description: 'Standard bei Flügeln' },
  { value: 'full', label: 'Ja - Komplett', description: 'Umfassende Zerlegung' },
  { value: 'unsure', label: 'Unsicher', description: 'Beratung gewünscht' }
];

export function Step5SpecialRequirements({ data, updateData, errors }: Step5Props) {
  const spec = data.instrument_type ? instrumentSpecs[data.instrument_type] : null;
  const isGrandPiano = spec?.is_grand;
  
  return (
    <div className="space-y-8">
      {/* Equipment Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">🏗️ Hilfsmittel erforderlich?</h3>
          <p className="text-sm text-gray-500">Wird spezielles Equipment für den Transport benötigt?</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {equipmentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateData('equipment_required', option.value)}
              className={cn(
                "p-4 rounded-xl border-2 text-left transition-all",
                data.equipment_required === option.value
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{option.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                  {option.price && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {option.price}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
        
        {errors.equipment_required && (
          <p className="text-sm text-red-500">{errors.equipment_required}</p>
        )}
      </div>
      
      {/* Info box for furniture lift */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
          ⚠️ Wann ist ein Möbellift erforderlich?
        </h4>
        <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
          <li>• Stockwerk 3 oder höher ohne passenden Gebäudelift</li>
          <li>• Wendeltreppe</li>
          <li>• Sehr enges Treppenhaus (&lt; 90cm)</li>
          <li>• Flügel ab Salonflügel-Grösse</li>
        </ul>
      </div>
      
      {/* Demontage Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">🔧 Demontage erforderlich?</h3>
          <p className="text-sm text-gray-500">Muss das Instrument für den Transport zerlegt werden?</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {demontageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateData('demontage', option.value)}
              className={cn(
                "p-4 rounded-xl border-2 text-center transition-all",
                data.demontage === option.value
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
              )}
            >
              <div className="font-semibold text-sm">{option.label}</div>
              <div className="text-xs text-gray-500 mt-1">{option.description}</div>
            </button>
          ))}
        </div>
        
        {errors.demontage && (
          <p className="text-sm text-red-500">{errors.demontage}</p>
        )}
      </div>
      
      {/* Grand piano demontage info */}
      {isGrandPiano && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div>
              <h4 className="font-semibold text-green-800 dark:text-green-200">Hinweis für Flügel</h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                Bei Flügeln ist das Abnehmen der Beine Standard und im Basispreis inbegriffen. 
                Die Demontage und Montage erfolgt durch unsere geschulten Fachkräfte.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Equipment selection summary */}
      {data.equipment_required && data.equipment_required !== 'none' && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Ihre Auswahl
          </h4>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p>
              <strong>Equipment:</strong>{' '}
              {equipmentOptions.find(o => o.value === data.equipment_required)?.label}
            </p>
            {data.demontage && (
              <p>
                <strong>Demontage:</strong>{' '}
                {demontageOptions.find(o => o.value === data.demontage)?.label}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


