import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  KlaviertransportAnfrage, 
  InstrumentAge, 
  ValueRange,
  pianoBrands,
  instrumentSpecs
} from "@/types/klaviertransport";

interface Step2Props {
  data: Partial<KlaviertransportAnfrage>;
  updateData: (field: keyof KlaviertransportAnfrage, value: unknown) => void;
  errors: Record<string, string>;
}

const ageOptions: { value: InstrumentAge; label: string }[] = [
  { value: 'new', label: 'Neu (< 2 Jahre)' },
  { value: 'recent', label: '2-10 Jahre' },
  { value: 'used', label: '10-30 Jahre' },
  { value: 'vintage', label: '30-50 Jahre' },
  { value: 'antique', label: 'Über 50 Jahre' },
  { value: 'unknown', label: 'Unbekannt' }
];

const valueOptions: { value: ValueRange; label: string }[] = [
  { value: 'under_5k', label: "Bis CHF 5'000" },
  { value: '5k_15k', label: "CHF 5'000 - 15'000" },
  { value: '15k_30k', label: "CHF 15'000 - 30'000" },
  { value: '30k_50k', label: "CHF 30'000 - 50'000" },
  { value: '50k_100k', label: "CHF 50'000 - 100'000" },
  { value: 'over_100k', label: "Über CHF 100'000" },
  { value: 'unknown', label: 'Unbekannt / Keine Angabe' }
];


export function Step2InstrumentDetails({ data, updateData, errors }: Step2Props) {
  const isDigital = data.instrument_type === 'digitalpiano';
  const spec = data.instrument_type ? instrumentSpecs[data.instrument_type] : null;
  
  return (
    <div className="space-y-6">
      {/* Selected Instrument Header */}
      {spec && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{spec.icon}</span>
            <div>
              <h3 className="font-semibold">{spec.label}</h3>
              <p className="text-sm text-gray-500">
                {spec.weight_min}-{spec.weight_max} kg • {spec.dimension_key}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Brand Selection */}
      <div className="space-y-2">
        <Label>Marke / Hersteller</Label>
        <Select
          value={data.instrument_brand || ''}
          onValueChange={(value) => updateData('instrument_brand', value === 'none' ? undefined : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Marke auswählen (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Keine Angabe --</SelectItem>
            {!isDigital && (
              <>
                <SelectItem value="_premium" disabled className="font-semibold text-amber-600">
                  ─ Premium ─
                </SelectItem>
                {pianoBrands.premium.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
                <SelectItem value="_professional" disabled className="font-semibold text-blue-600">
                  ─ Professional ─
                </SelectItem>
                {pianoBrands.professional.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
                <SelectItem value="_midrange" disabled className="font-semibold text-gray-600">
                  ─ Standard ─
                </SelectItem>
                {pianoBrands.midrange.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </>
            )}
            {isDigital && (
              <>
                <SelectItem value="_digital" disabled className="font-semibold text-purple-600">
                  ─ Digital Piano ─
                </SelectItem>
                {pianoBrands.digital.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </>
            )}
            <SelectItem value="andere">Andere</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Model Input */}
      <div className="space-y-2">
        <Label>Modell (optional)</Label>
        <Input
          placeholder="z.B. Model B, CLP-775, etc."
          value={data.instrument_model || ''}
          onChange={(e) => updateData('instrument_model', e.target.value)}
        />
      </div>
      
      {/* Age Selection */}
      <div className="space-y-2">
        <Label>Ungefähres Alter</Label>
        <Select
          value={data.instrument_age || 'unknown'}
          onValueChange={(value) => updateData('instrument_age', value as InstrumentAge)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Alter auswählen" />
          </SelectTrigger>
          <SelectContent>
            {ageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Value Selection */}
      <div className="space-y-2">
        <Label>Geschätzter Wert</Label>
        <Select
          value={data.instrument_value || 'unknown'}
          onValueChange={(value) => updateData('instrument_value', value as ValueRange)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Wert auswählen" />
          </SelectTrigger>
          <SelectContent>
            {valueOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Für Versicherungszwecke - Der Wert beeinflusst die empfohlene Versicherungssumme
        </p>
        {errors.instrument_value && (
          <p className="text-sm text-red-500">{errors.instrument_value}</p>
        )}
      </div>
      
      {/* Condition Notes */}
      <div className="space-y-2">
        <Label>Bekannte Mängel oder Besonderheiten (optional)</Label>
        <Textarea
          placeholder="z.B. fehlende Rollen, beschädigte Oberfläche, besonders empfindlich..."
          value={data.instrument_notes || ''}
          onChange={(e) => updateData('instrument_notes', e.target.value)}
          rows={3}
        />
      </div>
      
      {/* Antique Warning */}
      {data.instrument_age === 'antique' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">🏛️</span>
            <div>
              <h4 className="font-semibold text-amber-800">Antikes Instrument</h4>
              <p className="text-sm text-amber-700">
                Instrumente über 50 Jahre sind oft besonders wertvoll und empfindlich. 
                Wir empfehlen eine erhöhte Versicherungssumme und spezielle Verpackung.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Premium Brand Info */}
      {data.instrument_brand && pianoBrands.premium.includes(data.instrument_brand) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⭐</span>
            <div>
              <h4 className="font-semibold text-blue-800">Premium-Instrument</h4>
              <p className="text-sm text-blue-700">
                {data.instrument_brand} Instrumente sind hochwertig und erfordern besondere Sorgfalt. 
                Unsere spezialisierten Teams sind für den Transport solcher Instrumente ausgebildet.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


