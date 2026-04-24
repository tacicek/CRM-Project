# Swiss Moving Calculator (Umzugsrechner)

## Uebersicht

Der Swiss Moving Calculator ist ein umfassendes Tool zur Berechnung von Umzugskosten fuer Schweizer Umzugsunternehmen. Er ermoeglicht die Erstellung präziser Offerten ohne Vor-Ort-Besichtigung.

## Inhaltsverzeichnis

1. [Architektur](#architektur)
2. [Komponenten](#komponenten)
3. [Berechnungslogik](#berechnungslogik)
4. [Datenbank-Schema](#datenbank-schema)
5. [Verwendung](#verwendung)
6. [API-Referenz](#api-referenz)
7. [Konfiguration](#konfiguration)

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    MovingCalculator                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    useMovingCalculator                   ││
│  │  (State Management Hook)                                 ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│  ┌──────────────┬────────────┼────────────┬────────────────┐│
│  │              │            │            │                ││
│  ▼              ▼            ▼            ▼                ││
│ InventorySelector  BuildingInfoForm  DistanceForm  ExtraServicesForm │
│  (Moebel auswählen)  (Gebäudeinfo)    (Distanz)     (Zusatzleistungen) │
│                              │                               │
│                              ▼                               │
│                    ┌─────────────────┐                       │
│                    │ calculation-utils│                       │
│                    │ (Berechnungen)   │                       │
│                    └─────────────────┘                       │
│                              │                               │
│                              ▼                               │
│                    ┌─────────────────┐                       │
│                    │ PricingSummary  │                       │
│                    │ (Ergebnisse)    │                       │
│                    └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                         │
│  ┌─────────────┐  ┌────────────────────┐  ┌───────────────┐ │
│  │   offers    │  │offer_inventory_items│  │moving_presets │ │
│  └─────────────┘  └────────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Komponenten

### Dateistruktur

```
src/components/offers/moving-calculator/
├── types.ts                 # TypeScript-Typdefinitionen
├── inventory-data.ts        # Moebelkatalog (13 Kategorien, 100+ Artikel)
├── calculation-utils.ts     # Berechnungsfunktionen
├── useMovingCalculator.ts   # React State Management Hook
├── InventorySelector.tsx    # Moebelauswahl-Komponente
├── AddressDistanceForm.tsx  # Google Places Addressseingabe + Auto-Distanzberechnung
├── BuildingInfoForm.tsx     # Gebäudeinformationen-Formular
├── DistanceForm.tsx         # Distanz & Fahrzeit-Formular (manuell)
├── ExtraServicesForm.tsx    # Zusatzleistungen-Auswahl
├── PricingSummary.tsx       # Preis- und Ergebnisanzeige
├── MovingCalculator.tsx     # Hauptkomponente
└── index.ts                 # Modul-Exports
```

### Komponentenbeschreibung

#### 1. AddressDistanceForm (NEU)
Intelligente Addressseingabe mit automatischer Distanzberechnung:

**Features:**
- **Google Places Autocomplete** fuer Schweizer Addresssen
- **Automatische Distanzberechnung** via Google Distance Matrix API
- Zeigt berechnete Entfernung in km und Fahrzeit in Minuten
- Manuelle Ueberschreibung moeglich
- Zusätzliche Stopps (Lager, Entsorgung) konfigurierbar

**Technische Details:**
- Nutzt `GooglePlacesAutocomplete` Komponente
- Ruft `calculate-distance` Edge Function auf
- Speichert Koordinaten (lat/lng) fuer präzise Berechnung
- Extrahiert PLZ, Stadt, Kanton aus Google Places Daten

#### 2. InventorySelector (Tab 1: Inventar)
Ermoeglicht die Auswahl von Moebeln und Gegenständen aus 13 Kategorien:

| Kategorie | Beispiele |
|-----------|-----------|
| Kartons | Umzugskarton, Buecherkarton, Kleiderbox |
| Wohnzimmer | Sofa, Sessel, Couchtisch, Buecherregal |
| Schlafzimmer | Bett, Kleiderschrank, Kommode |
| Esszimmer | Esstisch, Stuehle, Sideboard |
| Kueche | Kuehlschrank, Geschirrspueler |
| Buero | Schreibtisch, Buerostuhl, Aktenschrank |
| Bad & Waschraum | Waschmaschine, Tumbler |
| Kinderzimmer | Kinderbett, Etagenbett, Wickeltisch |
| Elektrogeräte | Fernseher, Stereoanlage |
| Garten & Balkon | Gartentisch, Grill, Sonnenschirm |
| Sport & Hobby | Fahrrad, Fitnessgeräte |
| Spezielles | Klavier, Tresor, Aquarium |
| Lager & Keller | Metallregal, Werkbank |

Jeder Artikel hat:
- **volume_m3**: Volumen in Kubikmetern
- **assembly_time_minutes**: Montage-/Demontagezeit

#### 3. BuildingInfoForm (Tab 3 & 4: Auszug/Einzug)
Erfasst Gebäudeinformationen fuer Auszugs- und Einzugsadresse:

- **Stock** (0-10+)
- **Aufzug vorhanden** (Ja/Nein)
  - Aufzuggroesse (Klein/Standard/Gross)
- **Parkdistanz** zum Eingang (Meter)
- **Treppenhaus-Breite** (Eng/Standard/Breit)
- **Enge Kurven/Wendeltreppen** (Ja/Nein)
- **Aussenlift empfohlen** (Ja/Nein)

#### 4. DistanceForm (Legacy - ersetzt durch AddressDistanceForm)
Manuelle Eingabe von Transportdaten (fuer Fälle ohne Google API):

- **Entfernung** (Kilometer)
- **Fahrzeit** (Minuten)
- **Zusätzliche Stopps** (Anzahl)

#### 5. ExtraServicesForm (Tab 5: Extras)
Zusatzleistungen mit automatischer Kostenberechnung:

| Service | Preis |
|---------|-------|
| Verpackungsservice | 50 CHF/m³ |
| Aussenlift | 600 CHF pauschal |
| Entsorgung | 300 CHF pauschal |
| Klaviertransport | 400 CHF pauschal |
| Moebellagerung | 80 CHF/m³/Monat |

#### 6. PricingSummary (Seitenleiste)
Zeigt die vollständige Kalkulation:

- Fahrzeugempfehlung
- Personalempfehlung
- Volumenberechnung
- Zeitaufwand (Tragen, Montage, Fahrzeit, Puffer)
- Kostenaufstellung (Arbeit, Fahrzeug, Zuschläge, Extras)
- MwSt. (8.1%)
- **Gesamtpreis**

---

## Berechnungslogik

### 1. Volumenberechnung

```typescript
// Netto-Volumen
netVolume = Σ(item.volume_m3 × quantity)

// LKW-Volumen (mit 10% Buffer)
truckVolume = netVolume × 1.10
```

### 2. Zeitberechnung

```typescript
// Basiszeit: 6 Minuten pro m³
baseTime = (netVolume / 10) × 60

// Stockwerkzeit
floorTime = hasElevator ? floor × 5 : floor × 15

// Parkdistanz (ueber 10m)
parkingTime = ((parkingDistance - 10) / 20) × 10

// Treppenhaus-Multiplikator
stairwellMultiplier = 1.0
if (narrow) stairwellMultiplier *= 1.25
if (tightCorners) stairwellMultiplier *= 1.15

// Gesamte Tragezeit
carryingTime = (baseTime + floorTime + parkingTime) × stairwellMultiplier

// Montagezeit
assemblyTime = Σ(item.assembly_time_minutes × quantity)

// Pufferzeit (10% standard, 15% bei komplexen Umzuegen)
bufferTime = (assemblyTime + carryingTime + drivingTime) × bufferPercentage

// Gesamtzeit
totalTime = assemblyTime + carryingTime + drivingTime + bufferTime
```

### 3. Fahrzeugempfehlung

| Volumen | Fahrzeug |
|---------|----------|
| ≤ 10 m³ | Transporter |
| ≤ 20 m³ | LKW 3.5t |
| ≤ 35 m³ | LKW 7.5t |
| > 35 m³ | LKW 18t |

### 4. Personalempfehlung

| Volumen | Zeit | Personal |
|---------|------|----------|
| ≤ 15 m³ | ≤ 6h | 2 Personen |
| ≤ 30 m³ | ≤ 10h | 3 Personen |
| ≤ 50 m³ | - | 4 Personen |
| > 50 m³ | - | 5 Personen |

### 5. Kostenberechnung

```typescript
// Arbeitskosten
laborCost = (totalTime / 60) × hourlyRate × crewSize

// Fahrzeugkosten (Tagespauschale)
vehicleCost = vehiclePrices[recommendedVehicle]

// Distanz-Zuschlag (ueber 30 km)
distanceSurcharge = (distanceKm - 30) × 2 CHF/km

// Zusatzleistungen
extraServicesCost = Σ(selectedServices)

// Subtotal
subtotal = laborCost + vehicleCost + distanceSurcharge + extraServicesCost

// MwSt. (8.1%)
vat = subtotal × 0.081

// Total
total = subtotal + vat
```

---

## Datenbank-Schema

### offers (erweitert)

```sql
-- Neue Spalten fuer Moving Calculator
calculation_data JSONB        -- Vollständige Berechnungsdaten
origin_building_info JSONB    -- Auszugs-Gebäudeinfo
destination_building_info JSONB -- Einzugs-Gebäudeinfo
moving_distance_km NUMERIC    -- Entfernung
moving_driving_time_minutes INTEGER -- Fahrzeit
moving_additional_stops INTEGER -- Zusätzliche Stopps
```

### offer_inventory_items

```sql
CREATE TABLE offer_inventory_items (
  id UUID PRIMARY KEY,
  offer_id UUID REFERENCES offers(id),
  item_id VARCHAR(100),        -- z.B. 'sofa_3'
  category_id VARCHAR(100),    -- z.B. 'living_room'
  name_de VARCHAR(255),        -- z.B. 'Sofa (3-Sitzer)'
  volume_m3 NUMERIC,           -- 2.5
  assembly_time_minutes INTEGER, -- 10
  quantity INTEGER,            -- 1
  total_volume_m3 NUMERIC,     -- GENERATED
  total_assembly_time_minutes INTEGER, -- GENERATED
  position INTEGER
);
```

### moving_calculation_presets

```sql
CREATE TABLE moving_calculation_presets (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name VARCHAR(255),
  description TEXT,
  is_default BOOLEAN,
  pricing_config JSONB  -- Kundenspezifische Preise
);
```

### RPC: save_moving_calculation

```sql
FUNCTION save_moving_calculation(
  p_offer_id UUID,
  p_calculation_data JSONB,
  p_origin_building_info JSONB,
  p_destination_building_info JSONB,
  p_distance_km NUMERIC,
  p_driving_time_minutes INTEGER,
  p_additional_stops INTEGER,
  p_inventory_items JSONB
) RETURNS UUID
```

---

## Verwendung

### Mit Anfrage-Daten (Empfohlen)

Fuer bestehende Anfragen verwendet man `MovingCalculatorWithLead`, das automatisch alle Kundendaten lädt:

```tsx
import { MovingCalculatorWithLead } from '@/components/offers/moving-calculator';
import { CalculationResult } from '@/components/offers/moving-calculator/types';

function OfferteErstellenPage({ leadId }: { leadId: string }) {
  const handleCalculationComplete = (result: CalculationResult) => {
    console.log('Volumen:', result.netVolume, 'm³');
    console.log('Total:', result.costBreakdown.total, 'CHF');
    // Offerte speichern...
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Offerte erstellen</h1>
      <MovingCalculatorWithLead 
        leadId={leadId}
        onCalculate={handleCalculationComplete} 
      />
    </div>
  );
}
```

**Was wird automatisch geladen:**
- ✅ Inventar (Moebel, Kartons, Spezielle Gegenstände)
- ✅ Auszugsadresse (Strasse, PLZ, Stadt)
- ✅ Einzugsadresse (Strasse, PLZ, Stadt)
- ✅ Gebäudeinformationen (Stock, Aufzug, Parkplatz, Treppenhaus)
- ✅ Zusatzleistungen (Verpackung, Entsorgung, Lagerung, etc.)
- ✅ Distanz (falls berechnet)

### Grundlegende Verwendung (ohne Anfrage)

```tsx
import { MovingCalculator } from '@/components/offers/moving-calculator';
import { CalculationResult } from '@/components/offers/moving-calculator/types';

function CreateOfferPage() {
  const handleCalculationComplete = (result: CalculationResult) => {
    console.log('Volumen:', result.netVolume, 'm³');
    console.log('Fahrzeug:', result.recommendedVehicle);
    console.log('Personal:', result.recommendedCrew);
    console.log('Total:', result.costBreakdown.total, 'CHF');
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Neue Offerte erstellen</h1>
      <MovingCalculator onCalculate={handleCalculationComplete} />
    </div>
  );
}
```

### Mit Supabase speichern

```tsx
import { supabase } from '@/integrations/supabase/client';

const saveOfferWithCalculation = async (
  result: CalculationResult,
  companyId: string,
  leadId: string
) => {
  // 1. Offer erstellen
  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .insert({
      company_id: companyId,
      lead_id: leadId,
      title: 'Umzugsofferte',
      customer_first_name: 'Max',
      customer_last_name: 'Mustermann',
      customer_email: 'max@example.com',
      subtotal: result.costBreakdown.subtotal,
      status: 'draft'
    })
    .select()
    .single();

  if (offerError) throw offerError;

  // 2. Berechnung speichern
  const { error: calcError } = await supabase.rpc('save_moving_calculation', {
    p_offer_id: offer.id,
    p_calculation_data: result,
    p_origin_building_info: result.movingDetails.origin,
    p_destination_building_info: result.movingDetails.destination,
    p_distance_km: result.movingDetails.distanceKm,
    p_driving_time_minutes: result.movingDetails.drivingTimeMinutes,
    p_additional_stops: result.movingDetails.additionalStops,
    p_inventory_items: result.inventoryList
  });

  if (calcError) throw calcError;

  return offer;
};
```

### Hook direkt verwenden

```tsx
import { useMovingCalculator } from '@/components/offers/moving-calculator';

function CustomCalculator() {
  const calculator = useMovingCalculator();

  // Artikel hinzufuegen
  const handleAddSofa = () => {
    calculator.addItem(
      { id: 'sofa_3', name_de: 'Sofa (3-Sitzer)', volume_m3: 2.5, assembly_time_minutes: 10 },
      'living_room'
    );
  };

  // Gebäudeinfo setzen
  const handleSetOrigin = () => {
    calculator.setOrigin({
      floor: 3,
      hasElevator: false,
      parkingDistance: 20,
      stairwellType: 'standard',
      hasTightCorners: false,
      needsExternalLift: false
    });
  };

  // Ergebnis abrufen
  if (calculator.result) {
    console.log('Total:', calculator.result.costBreakdown.total);
  }

  return (
    <div>
      <button onClick={handleAddSofa}>Sofa hinzufuegen</button>
      <button onClick={handleSetOrigin}>Gebäudeinfo setzen</button>
      {calculator.result && (
        <p>Geschätzter Preis: {calculator.result.costBreakdown.total} CHF</p>
      )}
    </div>
  );
}
```

### Benutzerdefinierte Preise

```tsx
import { MovingCalculator, PricingConfig } from '@/components/offers/moving-calculator';

const customPricing: PricingConfig = {
  hourlyRate: 180, // Premium-Preis
  vehiclePrices: {
    transporter: 180,
    truck_3_5t: 300,
    truck_7_5t: 500,
    truck_18t: 750,
  },
  distanceSurchargeRate: 2.5,
  distanceSurchargeThreshold: 25,
  packingServiceRate: 60,
  externalLiftCost: 800,
  disposalCost: 400,
  pianoTransportCost: 500,
  storageCostPerM3: 100,
  vatRate: 8.1,
};

function PremiumOfferPage() {
  return (
    <MovingCalculator 
      pricingConfig={customPricing}
      onCalculate={(result) => console.log(result)} 
    />
  );
}
```

---

## API-Referenz

### Types

```typescript
interface CalculationResult {
  netVolume: number;           // Netto-Volumen in m³
  truckVolume: number;         // LKW-Volumen mit Buffer
  bufferPercentage: number;    // Buffer-Prozentsatz
  timeBreakdown: TimeBreakdown;
  costBreakdown: CostBreakdown;
  recommendedVehicle: VehicleType;
  recommendedCrew: number;
  inventoryList: InventorySelection[];
  movingDetails: MovingDetails;
  extraServices: ExtraServices;
}

interface TimeBreakdown {
  assemblyTime: number;    // Montage/Demontage (Minuten)
  carryingTime: number;    // Tragezeit (Minuten)
  drivingTime: number;     // Fahrzeit (Minuten)
  bufferTime: number;      // Pufferzeit (Minuten)
  totalTime: number;       // Gesamtzeit (Minuten)
}

interface CostBreakdown {
  laborCost: number;           // Arbeitskosten
  vehicleCost: number;         // Fahrzeugkosten
  distanceSurcharge: number;   // Distanz-Zuschlag
  extraServicesCost: number;   // Zusatzleistungen
  subtotal: number;            // Zwischensumme
  vat: number;                 // MwSt.
  total: number;               // Gesamtbetrag
}

type VehicleType = 'transporter' | 'truck_3_5t' | 'truck_7_5t' | 'truck_18t';
```

### Utility Functions

```typescript
// Volumen berechnen
calculateNetVolume(inventory: InventorySelection[]): number

// Zeit formatieren
formatTime(minutes: number): string  // "2 Std 30 Min"

// Währung formatieren
formatCHF(amount: number): string    // "CHF 1'234.50"

// Fahrzeugname
getVehicleName(vehicle: VehicleType): string  // "LKW 3.5t"

// Fahrzeugkapazität
getVehicleCapacity(vehicle: VehicleType): number  // 22
```

---

## Konfiguration

### Google API Anforderungen

Fuer die automatische Addresss- und Distanzberechnung werden folgende APIs benoetigt:

| API | Zweck | Edge Function |
|-----|-------|---------------|
| Places API | Addresss-Autocomplete | `google-places-autocomplete` |
| Places Details | Addresssdetails (PLZ, Stadt, Koordinaten) | `google-places-details` |
| Distance Matrix API | Distanz & Fahrzeit berechnen | `calculate-distance` |

**Umgebungsvariable:**
```
GOOGLE_PLACES_API_KEY=your-api-key
```

Diese muss in den Supabase Secrets konfiguriert sein.

### Standard-Preise (DEFAULT_PRICING_CONFIG)

```typescript
{
  hourlyRate: 150,              // CHF pro Stunde
  vehiclePrices: {
    transporter: 150,           // Tagespauschale
    truck_3_5t: 250,
    truck_7_5t: 400,
    truck_18t: 600,
  },
  distanceSurchargeRate: 2,     // CHF pro km ueber Schwelle
  distanceSurchargeThreshold: 30, // km
  packingServiceRate: 50,       // CHF pro m³
  externalLiftCost: 600,        // CHF pauschal
  disposalCost: 300,            // CHF pauschal
  pianoTransportCost: 400,      // CHF pauschal
  storageCostPerM3: 80,         // CHF pro m³/Monat
  vatRate: 8.1,                 // Schweizer MwSt.
}
```

### Firmenspezifische Preise (via Datenbank)

```sql
INSERT INTO moving_calculation_presets (company_id, name, pricing_config)
VALUES (
  'company-uuid',
  'Premium Preise',
  '{
    "hourlyRate": 180,
    "vehiclePrices": {"transporter": 180, "truck_3_5t": 300, ...},
    ...
  }'
);
```

---

## Best Practices

1. **Immer Pufferzeit einplanen**: Die automatische 10-15% Pufferzeit beruecksichtigt unvorhergesehene Verzoegerungen.

2. **Gebäudeinfo genau erfassen**: Enge Treppenhäuser und fehlende Aufzuege erhoehen die Tragezeit erheblich.

3. **Distanz korrekt schätzen**: Beruecksichtigen Sie Verkehr und Stosszeiten bei der Fahrzeit.

4. **Zusatzleistungen pruefen**: Bei Klavieren oder Tresoren immer Spezialtransport anbieten.

5. **Preise regelmässig aktualisieren**: Nutzen Sie die Preset-Funktion fuer aktuelle Marktpreise.

---

## Changelog

### v1.2.0 (2026-01-18)
- **NEU:** `MovingCalculatorWithLead` Komponente fuer Anfrage-Integration
- **NEU:** `useLeadDataMapper` Hook fuer Lead-zu-Calculator Datenmapping
- **NEU:** Automatische Inventar-Uebernahme aus Anfrage-Formularen
- **NEU:** Automatische Addresss- und Gebäudedaten-Uebernahme
- Vollständige Integration mit bestehenden Anfrage-Daten

### v1.1.0 (2026-01-18)
- **NEU:** Google Places Addressseingabe fuer Auszug & Einzug
- **NEU:** Automatische Distanz- und Fahrzeitberechnung via Google Distance Matrix API
- **NEU:** Koordinaten-basierte Berechnung fuer hoehere Genauigkeit
- 5 Tabs statt 4: Inventar → Addresssen → Auszug → Einzug → Extras
- AddressData Type fuer vollständige Addresssinformationen

### v1.0.0 (2026-01-18)
- Initiale Version
- 13 Moebelkategorien mit 100+ Artikeln
- Vollständige Kosten- und Zeitberechnung
- Supabase-Integration mit RPC-Funktion
- Responsive Design fuer Mobile und Desktop
