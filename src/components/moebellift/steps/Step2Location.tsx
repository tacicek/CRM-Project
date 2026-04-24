import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FloorSelector } from "../ui/FloorSelector";
import { cn } from "@/lib/utils";
import { MoebelliftAnfrage, FloorLevel, AccessPoint, floorHeights } from "@/types/moebellift";
import { Lightbulb, Square, Building, DoorOpen, CircleDot } from "lucide-react";

interface Step2Props {
  data: MoebelliftAnfrage;
  updateData: (updates: Partial<MoebelliftAnfrage>) => void;
}

const accessPoints: { value: AccessPoint; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'window', label: 'Fenster', icon: <Square className="w-5 h-5" />, description: 'Standardfenster' },
  { value: 'balcony', label: 'Balkon', icon: <Building className="w-5 h-5" />, description: 'Balkon/Terrasse' },
  { value: 'roof_window', label: 'Dachfenster', icon: <DoorOpen className="w-5 h-5" />, description: 'Mit Knickstück' },
  { value: 'terrace', label: 'Terrasse (EG)', icon: <CircleDot className="w-5 h-5" />, description: 'Erdgeschoss' },
];

const countries = [
  { code: 'CH', label: 'Schweiz' },
  { code: 'DE', label: 'Deutschland' },
  { code: 'AT', label: 'Österreich' },
  { code: 'FR', label: 'Frankreich' },
  { code: 'IT', label: 'Italien' },
  { code: 'LI', label: 'Liechtenstein' },
];

export function Step2Location({ data, updateData }: Step2Props) {
  const updateEinsatzort = (updates: Partial<typeof data.einsatzort>) => {
    updateData({
      einsatzort: { ...data.einsatzort, ...updates }
    });
  };

  const updateAdresse = (updates: Partial<typeof data.einsatzort.adresse>) => {
    updateData({
      einsatzort: {
        ...data.einsatzort,
        adresse: { ...data.einsatzort.adresse, ...updates }
      }
    });
  };

  const updateOeffnung = (updates: Partial<typeof data.einsatzort.oeffnung>) => {
    updateData({
      einsatzort: {
        ...data.einsatzort,
        oeffnung: { ...data.einsatzort.oeffnung, ...updates }
      }
    });
  };

  const handleFloorChange = (floor: FloorLevel) => {
    updateEinsatzort({
      stockwerk: floor,
      geschaetzte_hoehe_m: floorHeights[floor]
    });
  };

  return (
    <div className="space-y-8">
      {/* Address Section */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Einsatzadresse
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wo soll der Möbellift eingesetzt werden?
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Country */}
          <div className="md:col-span-2">
            <Label htmlFor="land" className="text-sm text-gray-600">Land</Label>
            <Select
              value={data.einsatzort.adresse.land}
              onValueChange={(value) => updateAdresse({ land: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Street */}
          <div className="md:col-span-2">
            <Label htmlFor="strasse" className="text-sm text-gray-600">Strasse *</Label>
            <Input
              id="strasse"
              value={data.einsatzort.adresse.strasse}
              onChange={(e) => updateAdresse({ strasse: e.target.value })}
              placeholder="Musterstrasse"
              className="mt-1"
            />
          </div>
          
          {/* House number */}
          <div>
            <Label htmlFor="hausnummer" className="text-sm text-gray-600">Hausnummer *</Label>
            <Input
              id="hausnummer"
              value={data.einsatzort.adresse.hausnummer}
              onChange={(e) => updateAdresse({ hausnummer: e.target.value })}
              placeholder="12"
              className="mt-1"
            />
          </div>
          
          {/* PLZ */}
          <div>
            <Label htmlFor="plz" className="text-sm text-gray-600">PLZ *</Label>
            <Input
              id="plz"
              value={data.einsatzort.adresse.plz}
              onChange={(e) => updateAdresse({ plz: e.target.value })}
              placeholder="8000"
              className="mt-1"
              maxLength={data.einsatzort.adresse.land === 'CH' ? 4 : 5}
            />
          </div>
          
          {/* City */}
          <div className="md:col-span-2">
            <Label htmlFor="ort" className="text-sm text-gray-600">Ort *</Label>
            <Input
              id="ort"
              value={data.einsatzort.adresse.ort}
              onChange={(e) => updateAdresse({ ort: e.target.value })}
              placeholder="Zürich"
              className="mt-1"
            />
          </div>
        </div>
      </div>
      
      {/* Floor Selection */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Stockwerk
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            In welches Stockwerk soll geliftet werden?
          </p>
        </div>
        
        <FloorSelector
          value={data.einsatzort.stockwerk}
          onChange={handleFloorChange}
        />
      </div>
      
      {/* Access Point */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Zugang
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wohin soll der Lift die Gegenstände bringen?
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {accessPoints.map((access) => (
            <button
              key={access.value}
              type="button"
              onClick={() => updateEinsatzort({ zugang: access.value })}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                "hover:border-orange-300",
                data.einsatzort.zugang === access.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <span className="text-2xl">{access.icon}</span>
              <span className={cn(
                "text-sm font-medium",
                data.einsatzort.zugang === access.value ? "text-orange-700" : "text-gray-700"
              )}>
                {access.label}
              </span>
              <span className="text-xs text-gray-400">{access.description}</span>
            </button>
          ))}
        </div>
        
        {/* Warning for roof window */}
        {data.einsatzort.zugang === 'roof_window' && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">Dachfenster</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Für Dachfenster wird ein Stecklift mit Knickstück (20°-45°) empfohlen. Zusätzliche Kosten: CHF 50-100.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Opening Size */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Fenstergrösse / Öffnung
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Wie gross ist die Öffnung, durch die transportiert wird?
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="breite" className="text-sm text-gray-600">Breite (cm)</Label>
            <Input
              id="breite"
              type="number"
              value={data.einsatzort.oeffnung.breite_cm}
              onChange={(e) => updateOeffnung({ breite_cm: parseInt(e.target.value) || 0 })}
              placeholder="100"
              className="mt-1"
              min={40}
            />
          </div>
          <div>
            <Label htmlFor="hoehe" className="text-sm text-gray-600">Höhe (cm)</Label>
            <Input
              id="hoehe"
              type="number"
              value={data.einsatzort.oeffnung.hoehe_cm}
              onChange={(e) => updateOeffnung({ hoehe_cm: parseInt(e.target.value) || 0 })}
              placeholder="150"
              className="mt-1"
              min={80}
            />
          </div>
        </div>
        
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Lightbulb className="w-3 h-3" />
          Mindestöffnung für die meisten Gegenstände: 60cm x 100cm
        </p>
        
        {/* Warning for small opening */}
        {(data.einsatzort.oeffnung.breite_cm > 0 && data.einsatzort.oeffnung.breite_cm < 60) && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Kleine Öffnung</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Die angegebene Breite ist möglicherweise zu schmal für grössere Gegenstände. Bitte prüfen Sie die Masse.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


