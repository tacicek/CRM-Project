// types/umzug.ts - Umzug (Moving) Form Types

export type PropertyType = 'haus' | 'wohnung' | 'wg_zimmer' | 'lager' | 'buero';

export type FloorLevel = 
  | 'basement' 
  | 'ground_floor' 
  | 'raised_ground' 
  | 'floor_1' 
  | 'floor_2' 
  | 'floor_3' 
  | 'floor_4' 
  | 'floor_5_plus';

export type LiftType = 'none' | 'small_elevator' | 'large_elevator' | 'cargo_elevator';

export type StepsRange = 'steps_0_10' | 'steps_11_30' | 'steps_31_50' | 'steps_51_plus';

export type FlexibilityType = 'fixed' | 'flex_3_days' | 'flex_1_week' | 'flex_2_weeks';

export type Anrede = 'herr' | 'frau' | 'divers';

export interface Address {
  land: string; // CH, DE, AT, FR, IT, LI
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  kanton?: string;
}

export interface LiftInfo {
  vorhanden: boolean;
  typ?: LiftType;
  kapazitaet_personen?: number;
  kapazitaet_kg?: number;
  dimensionen?: {
    breite_cm: number;
    tiefe_cm: number;
    hoehe_cm: number;
  };
}

export interface ParkingInfo {
  distanz_meter: number;
  stufen: StepsRange;
  weg_beeintraechtigt: boolean;
  beeintraechtigung_details?: string;
}

export interface PropertyExtras {
  // Haus specific
  garage?: boolean;
  garten?: boolean;
  keller?: boolean;
  estrich?: boolean;
  
  // Büro specific
  anzahl_arbeitsplaetze?: number;
  server_equipment?: boolean;
  wochenend_umzug?: boolean;
  
  // Lager specific
  lager_groesse_m3?: number;
  regale?: boolean;
}

export interface PropertyDetails {
  // Basic Info
  property_type: PropertyType;
  anzahl_zimmer: number;
  anzahl_stockwerke: number;
  wohnflaeche_m2: number;
  
  // Address
  adresse: Address;
  
  // Floor & Access
  stockwerk: FloorLevel;
  
  // Lift Information
  lift: LiftInfo;
  
  // Parking & Access
  parkplatz: ParkingInfo;
  
  // Property-specific (conditional)
  zusatz: PropertyExtras;
}

export interface InventoryItem {
  kategorie: string;
  name: string;
  anzahl: number;
  gewicht_kg?: number;
  spezial?: boolean;
  aufpreis_chf?: number;
}

export interface InventoryCategory {
  name: string;
  items: InventoryItem[];
}

export interface AdditionalServices {
  verpackung: {
    aktiv: boolean;
    umfang: 'alles' | 'nur_fragiles';
  };
  auspacken: boolean;
  moebelmontage: boolean;
  entsorgung: {
    aktiv: boolean;
    volumen_m3: number;
  };
  endreinigung: boolean;
  zwischenlagerung: {
    aktiv: boolean;
    dauer_wochen: number;
  };
  moebellift: {
    aktiv: boolean;
    standort: 'auszug' | 'einzug' | 'beide';
  };
}

export interface CustomerInfo {
  anrede: Anrede;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  kontaktzeit?: string;
}

export interface MovingDetails {
  datum: string; // ISO date
  flexibilitaet: FlexibilityType;
  startzeit: string; // HH:MM or 'flexibel'
}

export interface UmzugAnfrage {
  // Service
  service_type: 'umzug_privat' | 'umzug_firma';
  
  // Properties
  auszug: PropertyDetails; // Current/FROM
  einzug: PropertyDetails; // New/TO
  
  // Moving Details
  umzug_details: MovingDetails;
  
  // Inventory
  inventar: {
    items: InventoryItem[];
    geschaetzte_kartons: number;
    schwere_gegenstaende: InventoryItem[];
  };
  
  // Additional Services
  zusatzleistungen: AdditionalServices;
  
  // Contact
  kunde: CustomerInfo;
  
  // Notes
  bemerkungen?: string;
  
  // Offerten Anzahl
  max_companies: 1 | 3 | 5;
  
  // Meta
  id?: string;
  anfrage_nummer?: string;
  status: 'neu' | 'in_bearbeitung' | 'angebote_versendet' | 'abgeschlossen';
  created_at?: string;
  updated_at?: string;
  
  // Calculated (backend)
  geschaetzte_dauer_stunden?: number;
  geschaetzter_preis_chf?: number;
  distanz_km?: number;
}

// Form state for wizard
export interface UmzugFormState {
  currentStep: number;
  data: Partial<UmzugAnfrage>;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

// Default empty property details
export const createEmptyPropertyDetails = (): PropertyDetails => ({
  property_type: 'wohnung',
  anzahl_zimmer: 3,
  anzahl_stockwerke: 1,
  wohnflaeche_m2: 70,
  adresse: {
    land: 'CH',
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
  },
  stockwerk: 'floor_1',
  lift: {
    vorhanden: false,
  },
  parkplatz: {
    distanz_meter: 10,
    stufen: 'steps_0_10',
    weg_beeintraechtigt: false,
  },
  zusatz: {},
});

// Default empty form data
export const createEmptyUmzugAnfrage = (): Partial<UmzugAnfrage> => ({
  service_type: 'umzug_privat',
  auszug: createEmptyPropertyDetails(),
  einzug: createEmptyPropertyDetails(),
  umzug_details: {
    datum: '',
    flexibilitaet: 'flex_3_days',
    startzeit: 'flexibel',
  },
  inventar: {
    items: [],
    geschaetzte_kartons: 0,
    schwere_gegenstaende: [],
  },
  zusatzleistungen: {
    verpackung: { aktiv: false, umfang: 'alles' },
    auspacken: false,
    moebelmontage: false,
    entsorgung: { aktiv: false, volumen_m3: 0 },
    endreinigung: false,
    zwischenlagerung: { aktiv: false, dauer_wochen: 0 },
    moebellift: { aktiv: false, standort: 'beide' },
  },
  kunde: {
    anrede: 'herr',
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
  },
  bemerkungen: '',
  max_companies: 3,
  status: 'neu',
});

// Property type labels (German)
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  haus: 'Haus',
  wohnung: 'Wohnung',
  wg_zimmer: 'WG-Zimmer',
  lager: 'Lager',
  buero: 'Büro',
};

// Floor level labels (German)
export const FLOOR_LEVEL_LABELS: Record<FloorLevel, string> = {
  basement: 'Untergeschoss',
  ground_floor: 'Erdgeschoss',
  raised_ground: 'Hochparterre',
  floor_1: '1. Stock',
  floor_2: '2. Stock',
  floor_3: '3. Stock',
  floor_4: '4. Stock',
  floor_5_plus: '5.+ Stock',
};

// Lift type labels with capacity (German)
export const LIFT_TYPE_LABELS: Record<LiftType, { label: string; capacity: string; weight: string }> = {
  none: { label: 'Kein Lift', capacity: '', weight: '' },
  small_elevator: { label: 'Kleiner Personenlift', capacity: 'bis 4 Pers.', weight: '~300kg' },
  large_elevator: { label: 'Grosser Personenlift', capacity: 'bis 8 Pers.', weight: '~630kg' },
  cargo_elevator: { label: 'Warenlift / Lastenlift', capacity: '13+ Pers.', weight: '1000kg+' },
};

// Steps range labels (German)
export const STEPS_RANGE_LABELS: Record<StepsRange, string> = {
  steps_0_10: '0-10 Stufen',
  steps_11_30: '11-30 Stufen',
  steps_31_50: '31-50 Stufen',
  steps_51_plus: '51+ Stufen',
};

// Default inventory items by category
export const DEFAULT_INVENTORY: InventoryCategory[] = [
  {
    name: 'Wohnzimmer',
    items: [
      { kategorie: 'Wohnzimmer', name: 'Sofa (2-3 Sitzer)', anzahl: 0 },
      { kategorie: 'Wohnzimmer', name: 'Sofa (4+ Sitzer / Ecksofa)', anzahl: 0 },
      { kategorie: 'Wohnzimmer', name: 'Sessel', anzahl: 0 },
      { kategorie: 'Wohnzimmer', name: 'Couchtisch', anzahl: 0 },
      { kategorie: 'Wohnzimmer', name: 'TV-Möbel', anzahl: 0 },
      { kategorie: 'Wohnzimmer', name: 'Bücherregal', anzahl: 0 },
      { kategorie: 'Wohnzimmer', name: 'Vitrine', anzahl: 0 },
    ],
  },
  {
    name: 'Schlafzimmer',
    items: [
      { kategorie: 'Schlafzimmer', name: 'Einzelbett', anzahl: 0 },
      { kategorie: 'Schlafzimmer', name: 'Doppelbett', anzahl: 0 },
      { kategorie: 'Schlafzimmer', name: 'Kleiderschrank (2-türig)', anzahl: 0 },
      { kategorie: 'Schlafzimmer', name: 'Kleiderschrank (3+ türig)', anzahl: 0 },
      { kategorie: 'Schlafzimmer', name: 'Kommode', anzahl: 0 },
      { kategorie: 'Schlafzimmer', name: 'Nachttisch', anzahl: 0 },
    ],
  },
  {
    name: 'Küche',
    items: [
      { kategorie: 'Küche', name: 'Kühlschrank', anzahl: 0 },
      { kategorie: 'Küche', name: 'Gefrierschrank', anzahl: 0 },
      { kategorie: 'Küche', name: 'Geschirrspüler', anzahl: 0 },
      { kategorie: 'Küche', name: 'Waschmaschine', anzahl: 0 },
      { kategorie: 'Küche', name: 'Trockner', anzahl: 0 },
      { kategorie: 'Küche', name: 'Mikrowelle', anzahl: 0 },
    ],
  },
  {
    name: 'Büro',
    items: [
      { kategorie: 'Büro', name: 'Schreibtisch', anzahl: 0 },
      { kategorie: 'Büro', name: 'Bürostuhl', anzahl: 0 },
      { kategorie: 'Büro', name: 'Aktenschrank', anzahl: 0 },
      { kategorie: 'Büro', name: 'Drucker', anzahl: 0 },
    ],
  },
  {
    name: 'Sonstiges',
    items: [
      { kategorie: 'Sonstiges', name: 'Umzugskartons (Standard)', anzahl: 0 },
      { kategorie: 'Sonstiges', name: 'Umzugskartons (Bücher/Schwer)', anzahl: 0 },
      { kategorie: 'Sonstiges', name: 'Fahrrad', anzahl: 0 },
      { kategorie: 'Sonstiges', name: 'E-Bike / Motorrad', anzahl: 0 },
      { kategorie: 'Sonstiges', name: 'Pflanzen (gross)', anzahl: 0 },
    ],
  },
];

// Special/Heavy items with additional costs
export const SPECIAL_ITEMS: InventoryItem[] = [
  { kategorie: 'Spezial', name: 'Klavier (aufrecht)', anzahl: 0, spezial: true, aufpreis_chf: 250 },
  { kategorie: 'Spezial', name: 'Flügel', anzahl: 0, spezial: true, aufpreis_chf: 550 },
  { kategorie: 'Spezial', name: 'Tresor', anzahl: 0, spezial: true },
  { kategorie: 'Spezial', name: 'Aquarium', anzahl: 0, spezial: true },
  { kategorie: 'Spezial', name: 'Billardtisch', anzahl: 0, spezial: true, aufpreis_chf: 300 },
  { kategorie: 'Spezial', name: 'Whirlpool', anzahl: 0, spezial: true, aufpreis_chf: 400 },
];

// Error messages (German)
export const UMZUG_ERROR_MESSAGES = {
  required: 'Dieses Feld ist erforderlich',
  invalid_email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
  invalid_phone: 'Bitte geben Sie eine gültige Telefonnummer ein',
  invalid_plz: 'Bitte geben Sie eine gültige Postleitzahl ein',
  min_date: 'Das Umzugsdatum muss mindestens 2 Tage in der Zukunft liegen',
  select_property: 'Bitte wählen Sie eine Unterkunftsart',
  select_floor: 'Bitte wählen Sie das Stockwerk',
  select_lift_type: 'Bitte wählen Sie den Lifttyp',
};


