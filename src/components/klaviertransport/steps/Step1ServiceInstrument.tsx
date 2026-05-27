import { 
  KlaviertransportAnfrage, 
  ServiceType, 
  InstrumentType,
  instrumentSpecs 
} from "@/types/klaviertransport";
import { ServiceTypeCard, InstrumentCard } from "../ui";
import { Piano, Music, AlertTriangle, Music2 } from "lucide-react";

interface Step1Props {
  data: Partial<KlaviertransportAnfrage>;
  updateData: (field: keyof KlaviertransportAnfrage, value: unknown) => void;
  errors: Record<string, string>;
}

const serviceTypes: ServiceType[] = ['transport', 'storage', 'disposal', 'internal_move'];

// Group instruments by category
const instrumentGroups = {
  klavier: ['spinett', 'pianino_small', 'pianino_medium', 'pianino_large'] as InstrumentType[],
  fluegel: ['stutzfluegel', 'salonfluegel', 'halbkonzertfluegel', 'konzertfluegel'] as InstrumentType[],
  sonstige: ['digitalpiano', 'cembalo', 'orgel', 'other'] as InstrumentType[]
};

export function Step1ServiceInstrument({ data, updateData, errors }: Step1Props) {
  return (
    <div className="space-y-8">
      {/* Service Type Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Was möchten Sie tun?</h3>
        <p className="text-sm text-gray-500 mb-4">Wählen Sie die gewünschte Dienstleistung</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {serviceTypes.map((type) => (
            <ServiceTypeCard
              key={type}
              type={type}
              selected={data.service_type === type}
              onClick={() => updateData('service_type', type)}
            />
          ))}
        </div>
        
        {errors.service_type && (
          <p className="mt-2 text-sm text-red-500">{errors.service_type}</p>
        )}
      </div>
      
      {/* Instrument Type Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Welches Instrument?</h3>
        <p className="text-sm text-gray-500 mb-4">Wählen Sie den Instrumententyp für eine genaue Offerte</p>
        
        {/* Klaviere (Upright Pianos) */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
            <Piano className="w-4 h-4" /> Klaviere (aufrecht)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {instrumentGroups.klavier.map((type) => (
              <InstrumentCard
                key={type}
                type={type}
                selected={data.instrument_type === type}
                onClick={() => updateData('instrument_type', type)}
              />
            ))}
          </div>
        </div>
        
        {/* Flügel (Grand Pianos) */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
            <Music className="w-4 h-4" /> Flügel
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {instrumentGroups.fluegel.map((type) => (
              <InstrumentCard
                key={type}
                type={type}
                selected={data.instrument_type === type}
                onClick={() => updateData('instrument_type', type)}
              />
            ))}
          </div>
        </div>
        
        {/* Sonstige (Other) */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
            <Music2 className="w-4 h-4" /> Sonstige
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {instrumentGroups.sonstige.map((type) => (
              <InstrumentCard
                key={type}
                type={type}
                selected={data.instrument_type === type}
                onClick={() => updateData('instrument_type', type)}
              />
            ))}
          </div>
        </div>
        
        {errors.instrument_type && (
          <p className="mt-2 text-sm text-red-500">{errors.instrument_type}</p>
        )}
      </div>
      
      {/* Warning for Konzertflügel */}
      {data.instrument_type === 'konzertfluegel' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800">Konzertflügel</h4>
              <p className="text-sm text-amber-700">
                Konzertflügel erfordern besondere Planung und Spezialausrüstung. 
                Wir empfehlen eine Vorbesichtigung für ein genaues Angebot.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Selected Summary */}
      {data.service_type && data.instrument_type && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{instrumentSpecs[data.instrument_type].icon}</span>
            <div>
              <p className="font-medium text-blue-800">
                {instrumentSpecs[data.instrument_type].label}
              </p>
              <p className="text-sm text-blue-600">
                {instrumentSpecs[data.instrument_type].weight_min}-{instrumentSpecs[data.instrument_type].weight_max} kg • {instrumentSpecs[data.instrument_type].dimension_key}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


