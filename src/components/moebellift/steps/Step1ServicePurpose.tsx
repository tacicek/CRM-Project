import { PurposeCard } from "../ui/PurposeCard";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { 
  MoebelliftAnfrage, 
  Purpose, 
  ServiceType, 
  Direction
} from "@/types/moebellift";

interface Step1Props {
  data: MoebelliftAnfrage;
  updateData: (updates: Partial<MoebelliftAnfrage>) => void;
}

const purposes: Purpose[] = ['umzug', 'einzelstueck', 'baumaterial', 'handwerker', 'entsorgung', 'sonstiges'];

const serviceTypes: { value: ServiceType; label: string; description: string; recommended?: boolean }[] = [
  { 
    value: 'with_operator', 
    label: 'Mit Liftführer', 
    description: 'Komplettservice inkl. Bedienung',
    recommended: true 
  },
  { 
    value: 'self_service', 
    label: 'Ohne Bediener', 
    description: 'Einweisung ca. 15 Min. inkl.' 
  },
  { 
    value: 'pickup', 
    label: 'Selbstabholung', 
    description: 'Sie holen den Lift selbst ab' 
  },
];

const directions: { value: Direction; label: string; icon: string }[] = [
  { value: 'up', label: 'Hinauf (Einzug)', icon: '⬆️' },
  { value: 'down', label: 'Hinunter (Auszug)', icon: '⬇️' },
  { value: 'both', label: 'Beides (Umzug)', icon: '⬆️⬇️' },
];

export function Step1ServicePurpose({ data, updateData }: Step1Props) {
  return (
    <div className="space-y-8">
      {/* Purpose Selection */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Einsatzzweck
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wofür benötigen Sie den Möbellift?
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {purposes.map((purpose) => (
            <PurposeCard
              key={purpose}
              purpose={purpose}
              selected={data.zweck === purpose}
              onClick={() => updateData({ zweck: purpose })}
            />
          ))}
        </div>
      </div>
      
      {/* Service Type Selection */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Service-Art
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wie möchten Sie den Möbellift nutzen?
          </p>
        </div>
        
        <div className="space-y-2">
          {serviceTypes.map((service) => (
            <button
              key={service.value}
              type="button"
              onClick={() => updateData({ service_type: service.value })}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                "hover:border-orange-300",
                data.service_type === service.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                data.service_type === service.value
                  ? "border-orange-500 bg-orange-500"
                  : "border-gray-300"
              )}>
                {data.service_type === service.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium",
                    data.service_type === service.value ? "text-orange-700" : "text-gray-800"
                  )}>
                    {service.label}
                  </span>
                  {service.recommended && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                      empfohlen
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{service.description}</p>
              </div>
            </button>
          ))}
        </div>
        
        {/* Warning for self-service */}
        {data.service_type === 'self_service' && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Selbstbedienung</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Sie erhalten eine Einweisung und bedienen den Lift selbst. Erfahrung im Umgang mit Hebetechnik empfohlen.
              </p>
            </div>
          </div>
        )}
        
        {/* Warning for pickup */}
        {data.service_type === 'pickup' && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">Selbstabholung</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Fahrzeug mit Anhängerkupplung erforderlich. Kaution: CHF 500-1000.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Direction Selection */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Richtung
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            In welche Richtung soll transportiert werden?
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {directions.map((dir) => (
            <button
              key={dir.value}
              type="button"
              onClick={() => updateData({ richtung: dir.value })}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                "hover:border-orange-300",
                data.richtung === dir.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <span className="text-2xl">{dir.icon}</span>
              <span className={cn(
                "text-sm font-medium text-center",
                data.richtung === dir.value ? "text-orange-700" : "text-gray-700"
              )}>
                {dir.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


