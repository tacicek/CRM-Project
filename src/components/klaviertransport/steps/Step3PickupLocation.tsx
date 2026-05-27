import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  KlaviertransportAnfrage, 
  LocationDetails,
  StaircaseType,
  LiftFitStatus,
  floorLabels,
  instrumentSpecs,
  needsFurnitureLiftRecommendation,
  createEmptyLocationDetails
} from "@/types/klaviertransport";
import { FloorSelector } from "../ui";

interface Step3Props {
  data: Partial<KlaviertransportAnfrage>;
  updateLocation: (location: LocationDetails) => void;
  errors: Record<string, string>;
}

const staircaseOptions: { value: StaircaseType; label: string; description: string }[] = [
  { value: 'wide', label: 'Breit (> 110cm)', description: 'Problemloser Transport' },
  { value: 'normal', label: 'Normal (90-110cm)', description: 'Standard-Transport möglich' },
  { value: 'narrow', label: 'Eng (< 90cm)', description: 'Erschwerter Transport' },
  { value: 'spiral', label: 'Wendeltreppe', description: 'Oft Aussenlift nötig' }
];

const liftFitOptions: { value: LiftFitStatus; label: string }[] = [
  { value: 'fits_easily', label: 'Ja, problemlos' },
  { value: 'fits_tight', label: 'Ja, knapp' },
  { value: 'does_not_fit', label: 'Nein, passt nicht' },
  { value: 'unsure', label: 'Unsicher' }
];

const countries = [
  { value: 'CH', label: '🇨🇭 Schweiz' },
  { value: 'DE', label: '🇩🇪 Deutschland' },
  { value: 'AT', label: '🇦🇹 Österreich' },
  { value: 'FR', label: '🇫🇷 Frankreich' },
  { value: 'IT', label: '🇮🇹 Italien' },
  { value: 'LI', label: '🇱🇮 Liechtenstein' }
];

export function Step3PickupLocation({ data, updateLocation, errors }: Step3Props) {
  const location = data.abholort || createEmptyLocationDetails();
  const spec = data.instrument_type ? instrumentSpecs[data.instrument_type] : null;
  
  // Show furniture lift recommendation
  const showLiftRecommendation = data.instrument_type && needsFurnitureLiftRecommendation(
    data.instrument_type,
    location.stockwerk,
    location.lift_vorhanden,
    location.lift_passt
  );
  
  const updateField = <K extends keyof LocationDetails>(field: K, value: LocationDetails[K]) => {
    updateLocation({ ...location, [field]: value });
  };
  
  const updateHindernis = (field: keyof LocationDetails['hindernisse'], value: boolean | string) => {
    updateLocation({
      ...location,
      hindernisse: { ...location.hindernisse, [field]: value }
    });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">📍 Abholadresse</h3>
        <p className="text-sm text-gray-500">Wo befindet sich das Instrument derzeit?</p>
      </div>
      
      {/* Country Selection */}
      <div className="space-y-2">
        <Label>Land</Label>
        <Select
          value={location.land}
          onValueChange={(value) => updateField('land', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.value} value={country.value}>
                {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Address Fields */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label>Strasse *</Label>
          <Input
            placeholder="Strasse"
            value={location.strasse}
            onChange={(e) => updateField('strasse', e.target.value)}
            className={errors['abholort.strasse'] ? 'border-red-500' : ''}
          />
          {errors['abholort.strasse'] && (
            <p className="text-sm text-red-500">{errors['abholort.strasse']}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Nr. *</Label>
          <Input
            placeholder="Nr."
            value={location.hausnummer}
            onChange={(e) => updateField('hausnummer', e.target.value)}
            className={errors['abholort.hausnummer'] ? 'border-red-500' : ''}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>PLZ *</Label>
          <Input
            placeholder="PLZ"
            value={location.plz}
            onChange={(e) => updateField('plz', e.target.value)}
            className={errors['abholort.plz'] ? 'border-red-500' : ''}
          />
          {errors['abholort.plz'] && (
            <p className="text-sm text-red-500">{errors['abholort.plz']}</p>
          )}
        </div>
        <div className="col-span-2 space-y-2">
          <Label>Stadt *</Label>
          <Input
            placeholder="Stadt"
            value={location.ort}
            onChange={(e) => updateField('ort', e.target.value)}
            className={errors['abholort.ort'] ? 'border-red-500' : ''}
          />
          {errors['abholort.ort'] && (
            <p className="text-sm text-red-500">{errors['abholort.ort']}</p>
          )}
        </div>
      </div>
      
      {/* Floor Selection */}
      <div className="space-y-2">
        <Label>Stockwerk *</Label>
        <FloorSelector
          value={location.stockwerk}
          onChange={(value) => updateField('stockwerk', value)}
          showPriceHint={!location.lift_vorhanden || location.lift_passt === 'does_not_fit'}
          pricePerFloor={spec?.floor_price || 40}
        />
        {errors['abholort.stockwerk'] && (
          <p className="text-sm text-red-500">{errors['abholort.stockwerk']}</p>
        )}
      </div>
      
      {/* Lift Toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Lift vorhanden?</Label>
            <p className="text-sm text-gray-500">Gibt es einen Aufzug im Gebäude?</p>
          </div>
          <Switch
            checked={location.lift_vorhanden}
            onCheckedChange={(checked) => updateField('lift_vorhanden', checked)}
          />
        </div>
        
        {/* Lift Details */}
        {location.lift_vorhanden && (
          <div className="pl-4 border-l-2 border-blue-200 space-y-4">
            <div className="space-y-2">
              <Label>Passt das Instrument in den Lift?</Label>
              <div className="grid grid-cols-2 gap-2">
                {liftFitOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField('lift_passt', option.value)}
                    className={cn(
                      "p-3 rounded-lg border-2 text-sm transition-all",
                      location.lift_passt === option.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Lift Measurements (optional) */}
            {(location.lift_passt === 'fits_tight' || location.lift_passt === 'unsure') && (
              <div className="space-y-3">
                <Label className="text-sm text-gray-600">Liftmasse (optional, für genaue Einschätzung)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Türbreite (cm)</Label>
                    <Input
                      type="number"
                      placeholder="z.B. 80"
                      value={location.lift_breite_cm || ''}
                      onChange={(e) => updateField('lift_breite_cm', parseInt(e.target.value) || undefined)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Kabinentiefe (cm)</Label>
                    <Input
                      type="number"
                      placeholder="z.B. 140"
                      value={location.lift_tiefe_cm || ''}
                      onChange={(e) => updateField('lift_tiefe_cm', parseInt(e.target.value) || undefined)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Staircase Type */}
      <div className="space-y-2">
        <Label>Treppenhaus</Label>
        <div className="grid grid-cols-2 gap-2">
          {staircaseOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateField('treppenhaus', option.value)}
              className={cn(
                "p-3 rounded-lg border-2 text-left transition-all",
                location.treppenhaus === option.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300"
              )}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-gray-500">{option.description}</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Spiral Staircase Warning */}
      {location.treppenhaus === 'spiral' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800">Wendeltreppe</h4>
              <p className="text-sm text-amber-700">
                Bei Wendeltreppen ist oft ein Aussenlift oder Kran erforderlich. 
                Wir werden dies bei der Angebotserstellung berücksichtigen.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Furniture Lift Recommendation */}
      {showLiftRecommendation && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">🏗️</span>
            <div>
              <h4 className="font-semibold text-blue-800">Möbellift empfohlen</h4>
              <p className="text-sm text-blue-700">
                Für {spec?.label} im {floorLabels[location.stockwerk]} ohne passenden Lift 
                empfehlen wir einen Möbellift (Aussenlift). Dies können Sie im nächsten Schritt auswählen.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Obstacles */}
      <div className="space-y-3">
        <Label>Besondere Hindernisse</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enge_tueren"
              checked={location.hindernisse.enge_tueren}
              onCheckedChange={(checked) => updateHindernis('enge_tueren', !!checked)}
            />
            <label htmlFor="enge_tueren" className="text-sm">Enge Türen</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="stufen_vor_gebaeude"
              checked={location.hindernisse.stufen_vor_gebaeude}
              onCheckedChange={(checked) => updateHindernis('stufen_vor_gebaeude', !!checked)}
            />
            <label htmlFor="stufen_vor_gebaeude" className="text-sm">Stufen vor dem Gebäude</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="schwierige_parkplatz"
              checked={location.hindernisse.schwierige_parkplatz}
              onCheckedChange={(checked) => updateHindernis('schwierige_parkplatz', !!checked)}
            />
            <label htmlFor="schwierige_parkplatz" className="text-sm">Schwierige Parkplatzsituation</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="denkmalgeschuetzt"
              checked={location.hindernisse.denkmalgeschuetzt}
              onCheckedChange={(checked) => updateHindernis('denkmalgeschuetzt', !!checked)}
            />
            <label htmlFor="denkmalgeschuetzt" className="text-sm">Denkmalgeschütztes Gebäude</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="zufahrt_eingeschraenkt"
              checked={location.hindernisse.zufahrt_eingeschraenkt}
              onCheckedChange={(checked) => updateHindernis('zufahrt_eingeschraenkt', !!checked)}
            />
            <label htmlFor="zufahrt_eingeschraenkt" className="text-sm">Zufahrt nur zu bestimmten Zeiten</label>
          </div>
        </div>
        
        {/* Details for obstacles */}
        {(location.hindernisse.enge_tueren || 
          location.hindernisse.stufen_vor_gebaeude || 
          location.hindernisse.schwierige_parkplatz ||
          location.hindernisse.zufahrt_eingeschraenkt) && (
          <div className="space-y-2">
            <Label>Details zu den Hindernissen (optional)</Label>
            <Textarea
              placeholder="Beschreiben Sie die Hindernisse genauer..."
              value={location.hindernisse.details || ''}
              onChange={(e) => updateHindernis('details', e.target.value)}
              rows={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}


