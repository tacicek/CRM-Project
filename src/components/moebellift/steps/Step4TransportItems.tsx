import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  MoebelliftAnfrage, 
  ApartmentSize, 
  LoadSize, 
  SingleItemType, 
  ItemWeight,
  MaterialType,
  singleItemConfig 
} from "@/types/moebellift";

interface Step4Props {
  data: MoebelliftAnfrage;
  updateData: (updates: Partial<MoebelliftAnfrage>) => void;
}

const apartmentSizes: { value: ApartmentSize; label: string }[] = [
  { value: '1_room', label: '1-Zimmer' },
  { value: '2_room', label: '2-Zimmer' },
  { value: '3_room', label: '3-Zimmer' },
  { value: '4_room', label: '4-Zimmer' },
  { value: '5_room', label: '5-Zimmer' },
  { value: '6_plus_room', label: '6+ Zimmer' },
  { value: 'house', label: 'Haus' },
];

const loadSizes: { value: LoadSize; label: string; description: string }[] = [
  { value: 'small', label: 'Wenig', description: '5-15 Fahrten (Studio, wenig Möbel)' },
  { value: 'medium', label: 'Mittel', description: '15-30 Fahrten (2-3 Zimmer Standard)' },
  { value: 'large', label: 'Viel', description: '30-50 Fahrten (4+ Zimmer, voll möbliert)' },
  { value: 'very_large', label: 'Sehr viel', description: '50+ Fahrten (Haus, Sammlung)' },
];

const singleItems: SingleItemType[] = [
  'sofa', 'wardrobe', 'bed', 'piano', 'grand_piano', 
  'appliance', 'fridge', 'whirlpool', 'safe', 
  'fitness', 'pool_table', 'aquarium', 'other'
];

const itemWeights: { value: ItemWeight; label: string; description: string }[] = [
  { value: 'light', label: 'Leicht', description: 'Unter 50 kg' },
  { value: 'medium', label: 'Mittel', description: '50-150 kg' },
  { value: 'heavy', label: 'Schwer', description: '150-250 kg' },
  { value: 'very_heavy', label: 'Sehr schwer', description: 'Über 250 kg' },
];

const materialTypes: { value: MaterialType; label: string }[] = [
  { value: 'windows_doors', label: 'Fenster / Türen' },
  { value: 'drywall', label: 'Gipsplatten / Rigips' },
  { value: 'insulation', label: 'Isolationsmaterial' },
  { value: 'wood_panels', label: 'Holzplatten / OSB' },
  { value: 'bricks', label: 'Ziegel / Steine' },
  { value: 'roof_tiles', label: 'Dachziegel' },
  { value: 'solar_panels', label: 'Solarmodule' },
  { value: 'sanitary', label: 'Sanitär / Badewanne' },
  { value: 'other', label: 'Anderes' },
];

const units = ['Stück', 'm²', 'kg', 'Paletten'];

export function Step4TransportItems({ data, updateData }: Step4Props) {
  const updateTransport = (updates: Partial<typeof data.transport>) => {
    updateData({ transport: { ...data.transport, ...updates } });
  };

  // Render based on purpose
  if (data.zweck === 'umzug') {
    return (
      <div className="space-y-8">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Umzugsgut
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Geben Sie uns einen Überblick über den Umfang Ihres Umzugs
          </p>
        </div>
        
        {/* Apartment Size */}
        <div className="space-y-4">
          <Label className="font-medium text-gray-700">Wohnungsgrösse</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {apartmentSizes.map((size) => (
              <button
                key={size.value}
                type="button"
                onClick={() => updateTransport({ 
                  umzug: { 
                    ...data.transport.umzug, 
                    wohnungsgroesse: size.value,
                    menge: data.transport.umzug?.menge || 'medium'
                  } 
                })}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all text-center",
                  "hover:border-orange-300",
                  data.transport.umzug?.wohnungsgroesse === size.value
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 bg-white"
                )}
              >
                <span className={cn(
                  "text-sm font-medium",
                  data.transport.umzug?.wohnungsgroesse === size.value 
                    ? "text-orange-700" 
                    : "text-gray-700"
                )}>
                  {size.label}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Load Size */}
        <div className="space-y-4">
          <Label className="font-medium text-gray-700">Geschätzte Menge</Label>
          <div className="space-y-2">
            {loadSizes.map((load) => (
              <button
                key={load.value}
                type="button"
                onClick={() => updateTransport({ 
                  umzug: { 
                    ...data.transport.umzug,
                    wohnungsgroesse: data.transport.umzug?.wohnungsgroesse || '3_room', 
                    menge: load.value 
                  } 
                })}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
                  "hover:border-orange-300",
                  data.transport.umzug?.menge === load.value
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 bg-white"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  data.transport.umzug?.menge === load.value
                    ? "border-orange-500 bg-orange-500"
                    : "border-gray-300"
                )}>
                  {data.transport.umzug?.menge === load.value && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <p className={cn(
                    "font-medium",
                    data.transport.umzug?.menge === load.value ? "text-orange-700" : "text-gray-800"
                  )}>
                    {load.label}
                  </p>
                  <p className="text-sm text-gray-500">{load.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.zweck === 'einzelstueck') {
    return (
      <div className="space-y-8">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Einzelstück-Transport
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Was soll transportiert werden?
          </p>
        </div>
        
        {/* Item Type */}
        <div className="space-y-4">
          <Label className="font-medium text-gray-700">Gegenstand</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {singleItems.map((item) => {
              const config = singleItemConfig[item];
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => updateTransport({ 
                    einzelstueck: { 
                      ...data.transport.einzelstueck, 
                      typ: item,
                      gewicht: data.transport.einzelstueck?.gewicht || 'medium'
                    } 
                  })}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all text-left",
                    "hover:border-orange-300",
                    data.transport.einzelstueck?.typ === item
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 bg-white"
                  )}
                >
                  <p className={cn(
                    "text-sm font-medium",
                    data.transport.einzelstueck?.typ === item ? "text-orange-700" : "text-gray-700"
                  )}>
                    {config.label}
                  </p>
                  <p className="text-xs text-gray-400">{config.maxWeight}</p>
                  {config.notes && (
                    <p className="text-xs text-orange-500 mt-1">{config.notes}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Weight */}
        <div className="space-y-4">
          <Label className="font-medium text-gray-700">Geschätztes Gewicht</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {itemWeights.map((weight) => (
              <button
                key={weight.value}
                type="button"
                onClick={() => updateTransport({ 
                  einzelstueck: { 
                    ...data.transport.einzelstueck,
                    typ: data.transport.einzelstueck?.typ || 'other', 
                    gewicht: weight.value 
                  } 
                })}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all text-center",
                  "hover:border-orange-300",
                  data.transport.einzelstueck?.gewicht === weight.value
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 bg-white"
                )}
              >
                <p className={cn(
                  "text-sm font-medium",
                  data.transport.einzelstueck?.gewicht === weight.value 
                    ? "text-orange-700" 
                    : "text-gray-700"
                )}>
                  {weight.label}
                </p>
                <p className="text-xs text-gray-400">{weight.description}</p>
              </button>
            ))}
          </div>
          
          {/* Warning for very heavy items */}
          {data.transport.einzelstueck?.gewicht === 'very_heavy' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Sehr schwerer Gegenstand</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Bei Gegenständen über 250kg ist möglicherweise ein Kran erforderlich. Wir beraten Sie gerne.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Optional Dimensions */}
        <div className="space-y-4">
          <Label className="font-medium text-gray-700">Masse (optional)</Label>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm text-gray-500">Länge (cm)</Label>
              <Input
                type="number"
                value={data.transport.einzelstueck?.masse?.laenge_cm || ''}
                onChange={(e) => updateTransport({ 
                  einzelstueck: { 
                    ...data.transport.einzelstueck,
                    typ: data.transport.einzelstueck?.typ || 'other',
                    gewicht: data.transport.einzelstueck?.gewicht || 'medium',
                    masse: {
                      ...data.transport.einzelstueck?.masse,
                      laenge_cm: parseInt(e.target.value) || 0,
                      breite_cm: data.transport.einzelstueck?.masse?.breite_cm || 0,
                      hoehe_cm: data.transport.einzelstueck?.masse?.hoehe_cm || 0
                    }
                  } 
                })}
                placeholder="200"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-500">Breite (cm)</Label>
              <Input
                type="number"
                value={data.transport.einzelstueck?.masse?.breite_cm || ''}
                onChange={(e) => updateTransport({ 
                  einzelstueck: { 
                    ...data.transport.einzelstueck,
                    typ: data.transport.einzelstueck?.typ || 'other',
                    gewicht: data.transport.einzelstueck?.gewicht || 'medium',
                    masse: {
                      ...data.transport.einzelstueck?.masse,
                      laenge_cm: data.transport.einzelstueck?.masse?.laenge_cm || 0,
                      breite_cm: parseInt(e.target.value) || 0,
                      hoehe_cm: data.transport.einzelstueck?.masse?.hoehe_cm || 0
                    }
                  } 
                })}
                placeholder="100"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-500">Höhe (cm)</Label>
              <Input
                type="number"
                value={data.transport.einzelstueck?.masse?.hoehe_cm || ''}
                onChange={(e) => updateTransport({ 
                  einzelstueck: { 
                    ...data.transport.einzelstueck,
                    typ: data.transport.einzelstueck?.typ || 'other',
                    gewicht: data.transport.einzelstueck?.gewicht || 'medium',
                    masse: {
                      ...data.transport.einzelstueck?.masse,
                      laenge_cm: data.transport.einzelstueck?.masse?.laenge_cm || 0,
                      breite_cm: data.transport.einzelstueck?.masse?.breite_cm || 0,
                      hoehe_cm: parseInt(e.target.value) || 0
                    }
                  } 
                })}
                placeholder="150"
                className="mt-1"
              />
            </div>
          </div>
        </div>
        
        {/* Description */}
        <div className="space-y-2">
          <Label className="font-medium text-gray-700">Beschreibung / Besonderheiten</Label>
          <Textarea
            value={data.transport.einzelstueck?.beschreibung || ''}
            onChange={(e) => updateTransport({ 
              einzelstueck: { 
                ...data.transport.einzelstueck,
                typ: data.transport.einzelstueck?.typ || 'other',
                gewicht: data.transport.einzelstueck?.gewicht || 'medium',
                beschreibung: e.target.value 
              } 
            })}
            placeholder="z.B. antiker Schrank, besonders empfindlich, muss stehend transportiert werden..."
            rows={3}
          />
        </div>
      </div>
    );
  }

  if (data.zweck === 'baumaterial') {
    return (
      <div className="space-y-8">
        <div>
          <Label className="text-base font-semibold text-gray-800">
            Baumaterial-Transport
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Welches Material soll transportiert werden?
          </p>
        </div>
        
        {/* Material Type */}
        <div className="space-y-4">
          <Label className="font-medium text-gray-700">Material-Art</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {materialTypes.map((mat) => (
              <button
                key={mat.value}
                type="button"
                onClick={() => updateTransport({ 
                  baumaterial: { 
                    ...data.transport.baumaterial, 
                    art: mat.value,
                    menge: data.transport.baumaterial?.menge || 1,
                    einheit: data.transport.baumaterial?.einheit || 'Stück'
                  } 
                })}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all text-center",
                  "hover:border-orange-300",
                  data.transport.baumaterial?.art === mat.value
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 bg-white"
                )}
              >
                <span className={cn(
                  "text-sm font-medium",
                  data.transport.baumaterial?.art === mat.value 
                    ? "text-orange-700" 
                    : "text-gray-700"
                )}>
                  {mat.label}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Quantity */}
        <div className="space-y-4">
          <Label className="font-medium text-gray-700">Menge</Label>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                type="number"
                value={data.transport.baumaterial?.menge || ''}
                onChange={(e) => updateTransport({ 
                  baumaterial: { 
                    ...data.transport.baumaterial,
                    art: data.transport.baumaterial?.art || 'other',
                    einheit: data.transport.baumaterial?.einheit || 'Stück',
                    menge: parseInt(e.target.value) || 0 
                  } 
                })}
                placeholder="10"
                min={1}
              />
            </div>
            <div className="w-32">
              <Select
                value={data.transport.baumaterial?.einheit || 'Stück'}
                onValueChange={(value) => updateTransport({ 
                  baumaterial: { 
                    ...data.transport.baumaterial,
                    art: data.transport.baumaterial?.art || 'other',
                    menge: data.transport.baumaterial?.menge || 1,
                    einheit: value 
                  } 
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default for handwerker, entsorgung, sonstiges
  return (
    <div className="space-y-8">
      <div>
        <Label className="text-base font-semibold text-gray-800">
          Transportgut
        </Label>
        <p className="text-sm text-gray-500 mt-1">
          Beschreiben Sie bitte, was transportiert werden soll
        </p>
      </div>
      
      <div className="space-y-2">
        <Textarea
          value={data.transport.sonstiges || ''}
          onChange={(e) => updateTransport({ sonstiges: e.target.value })}
          placeholder="Bitte beschreiben Sie, was transportiert werden soll, ungefähre Menge und Gewicht..."
          rows={5}
        />
      </div>
    </div>
  );
}


