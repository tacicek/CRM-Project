// types/raeumung.ts - TypeScript interfaces for Räumung/Entsorgung wizard form

// Service Types
export type RaeumungsArt = 
  | 'household_dissolution'  // Haushaltsauflösung
  | 'apartment_clearance'    // Wohnungsräumung
  | 'house_clearance'        // Hausräumung
  | 'decluttering'           // Entrümpelung
  | 'death_clearance'        // Todesfallräumung
  | 'estate_clearance'       // Nachlassräumung
  | 'hoarder_clearance'      // Messieräumung
  | 'forced_eviction'        // Zwangsräumung
  | 'cellar_clearance'       // Kellerräumung
  | 'attic_clearance'        // Estrichräumung
  | 'garage_clearance'       // Garageräumung
  | 'office_clearance'       // Büroräumung
  | 'company_dissolution'    // Firmenauflösung
  | 'storage_clearance';     // Lagerräumung

export type PropertyType = 
  | 'apartment'
  | 'house'
  | 'multi_family'
  | 'townhouse'
  | 'office_building'
  | 'warehouse'
  | 'cellar_only'
  | 'attic_only'
  | 'garage_only';

export type ConditionLevel = 'normal' | 'dirty' | 'very_dirty' | 'extreme';
export type UrgencyLevel = 'normal' | 'urgent' | 'very_urgent' | 'emergency';
export type ClearanceScope = 'complete' | 'partial';
export type FloorLevel = 'basement' | 'ground_floor' | 'floor_1' | 'floor_2' | 'floor_3' | 'floor_4' | 'floor_5_plus';
export type LiftType = 'klein' | 'gross' | 'warenlift';
export type StepsRange = 'steps_0_10' | 'steps_11_30' | 'steps_31_50' | 'steps_51_plus';
export type RequesterRole = 'owner' | 'tenant' | 'property_manager' | 'heir' | 'landlord' | 'authority' | 'other';
export type CleaningType = 'besenrein' | 'abgabegarantie';

// Property Details
export interface PropertyDetails {
  type: PropertyType;
  zimmer_anzahl?: number;
  flaeche_m2: number;
  stockwerke?: number;
  fuellgrad?: number; // 0-100%
}

// Address
export interface RaeumungAddress {
  land: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  kanton: string;
}

// Access & Logistics
export interface AccessDetails {
  stockwerk: FloorLevel;
  lift_vorhanden: boolean;
  lift_typ?: LiftType;
  parkplatz_distanz_m: number;
  stufen: StepsRange;
  hindernisse: {
    enger_treppenhaus: boolean;
    enger_flur: boolean;
    schwieriger_zugang: boolean;
    parkverbot: boolean;
    details?: string;
  };
}

// Inventory Items
export interface MoebelInventar {
  sofas: number;
  betten: number;
  schraenke: number;
  tische: number;
  regale: number;
}

export interface ElektroInventar {
  kuehlschrank: number;
  waschmaschine: number;
  fernseher: number;
  computer: number;
  sonstige: number;
}

export interface SondermuellInventar {
  farben: number;
  chemikalien: number;
  batterien: number;
  medikamente: number;
  oele: number;
}

export interface SchwereInventar {
  klavier: number;
  tresor: number;
  aquarium: number;
  billardtisch: number;
  sauna: number;
}

// Clearance Scope
export interface ClearanceScopeDetails {
  scope: ClearanceScope;
  bereiche?: string[]; // For partial clearance
  inventar: {
    moebel: MoebelInventar;
    elektro: ElektroInventar;
    sondermuell: SondermuellInventar;
    schwer: SchwereInventar;
  };
  kartons_anzahl: number;
  volumen_m3: number;
}

// Condition Assessment (for Messie/Todesfall/Zwangsräumung)
export interface ConditionAssessment {
  allgemein: ConditionLevel;
  besonderheiten: {
    muellberge: boolean;
    ungeziefer: boolean;
    schimmel: boolean;
    geruch: boolean;
    gesundheitsgefahr: boolean;
    tierkot: boolean;
    bauliche_schaeden: boolean;
  };
  fuellgrad_prozent: number;
  schutzausruestung: 'ja' | 'nein' | 'unsicher';
}

// Additional Services
export interface AdditionalServicesRaeumung {
  demontage: boolean;
  entsorgung: boolean; // Default true
  recycling: boolean;
  endreinigung: {
    aktiv: boolean;
    typ?: CleaningType;
  };
  renovation: boolean;
  wertanrechnung: boolean;
  dokumentensicherung: boolean;
  einlagerung: {
    aktiv: boolean;
    dauer_wochen?: number;
  };
  // Todesfall/Nachlass specific
  wertsachen_sicherung?: boolean;
  inventarliste?: boolean;
  // Zwangsräumung specific
  behoerden_koordination?: boolean;
  pflicht_einlagerung?: boolean;
  raeumungsprotokoll?: boolean;
}

// Timing
export interface TimingDetails {
  dringlichkeit: UrgencyLevel;
  wunschdatum: string;
  flexibilitaet: 'fixed' | 'flex_3_days' | 'flex_1_week' | 'fully_flexible';
  besichtigung_gewuenscht: boolean;
  besichtigung_termine?: string[];
}

// Contact
export interface RequesterInfo {
  rolle: RequesterRole;
  anrede: 'herr' | 'frau' | 'divers';
  vorname: string;
  nachname: string;
  firma?: string;
  email: string;
  telefon: string;
  kontaktzeit?: string;
}

// Main Form Data
export interface RaeumungAnfrage {
  // Step 1 - Service Type
  raeumungs_art: RaeumungsArt;
  
  // Step 2 - Property Details
  property: PropertyDetails;
  
  // Step 3 - Address
  adresse: RaeumungAddress;
  
  // Step 4 - Access & Logistics
  zugang: AccessDetails;
  
  // Step 5 - Clearance Scope
  umfang: ClearanceScopeDetails;
  
  // Step 6 - Condition (Conditional)
  zustand?: ConditionAssessment;
  
  // Step 7 - Additional Services
  zusatzleistungen: AdditionalServicesRaeumung;
  
  // Step 8 - Timing
  termin: TimingDetails;
  
  // Step 9 - Contact
  anfragender: RequesterInfo;
  
  // Step 10 - Notes & Agreements
  bemerkungen?: string;
  agb_akzeptiert: boolean;
  berechtigung_bestaetigt: boolean;
  gerichtsbefehl_vorhanden?: boolean; // For Zwangsräumung
  
  // Offerten Anzahl
  max_companies: 1 | 3 | 5;
  
  // Meta
  id?: string;
  anfrage_nummer?: string;
  status: 'neu' | 'besichtigung_geplant' | 'offerte_erstellt' | 'in_bearbeitung' | 'abgeschlossen';
  created_at?: string;
  updated_at?: string;
  
  // Calculated
  geschaetzter_aufwand_stunden?: number;
  geschaetzter_preis_chf?: number;
}

// Service Type Configuration
export interface ServiceTypeConfigItem {
  label: string;
  labelShort?: string;
  icon: string;
  description?: string;
  sensitive: boolean;
  showConditionStep: boolean;
  defaultRole: RequesterRole;
  specialServices: string[];
  category: 'standard' | 'sensitive' | 'commercial' | 'special';
}

export const serviceTypeConfig: Record<RaeumungsArt, ServiceTypeConfigItem> = {
  household_dissolution: {
    label: 'Haushaltsauflösung',
    icon: '🏠📦',
    description: 'Komplette Auflösung eines Haushalts',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'owner',
    specialServices: [],
    category: 'standard',
  },
  apartment_clearance: {
    label: 'Wohnungsräumung',
    icon: '🏢',
    description: 'Räumung einer Wohnung',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'tenant',
    specialServices: [],
    category: 'standard',
  },
  house_clearance: {
    label: 'Hausräumung',
    icon: '🏡',
    description: 'Räumung eines ganzen Hauses',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'owner',
    specialServices: [],
    category: 'standard',
  },
  decluttering: {
    label: 'Entrümpelung',
    icon: '🗑️',
    description: 'Teilweise Räumung / Sperrmüll',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'owner',
    specialServices: [],
    category: 'standard',
  },
  death_clearance: {
    label: 'Todesfallräumung',
    icon: '🕯️',
    description: 'Diskret und respektvoll',
    sensitive: true,
    showConditionStep: false,
    defaultRole: 'heir',
    specialServices: ['wertsachen_sicherung', 'inventarliste'],
    category: 'sensitive',
  },
  estate_clearance: {
    label: 'Nachlassräumung',
    icon: '📜',
    description: 'Erbschaftsräumung',
    sensitive: true,
    showConditionStep: false,
    defaultRole: 'heir',
    specialServices: ['wertsachen_sicherung', 'inventarliste'],
    category: 'sensitive',
  },
  hoarder_clearance: {
    label: 'Messieräumung',
    icon: '⚠️',
    description: 'Vertraulich und ohne Wertung',
    sensitive: true,
    showConditionStep: true,
    defaultRole: 'owner',
    specialServices: [],
    category: 'sensitive',
  },
  forced_eviction: {
    label: 'Zwangsräumung',
    icon: '⚖️',
    description: 'Richterlicher Befehl erforderlich',
    sensitive: true,
    showConditionStep: true,
    defaultRole: 'landlord',
    specialServices: ['behoerden_koordination', 'pflicht_einlagerung', 'raeumungsprotokoll'],
    category: 'special',
  },
  cellar_clearance: {
    label: 'Kellerräumung',
    icon: '🚪',
    description: 'Nur Keller',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'owner',
    specialServices: [],
    category: 'standard',
  },
  attic_clearance: {
    label: 'Estrichräumung',
    icon: '🏚️',
    description: 'Dachboden / Estrich',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'owner',
    specialServices: [],
    category: 'standard',
  },
  garage_clearance: {
    label: 'Garageräumung',
    icon: '🚗',
    description: 'Garage / Autoeinstellhalle',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'owner',
    specialServices: [],
    category: 'standard',
  },
  office_clearance: {
    label: 'Büroräumung',
    icon: '🏢💼',
    description: 'Büro oder Geschäftsräume',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'property_manager',
    specialServices: [],
    category: 'commercial',
  },
  company_dissolution: {
    label: 'Firmenauflösung',
    icon: '🏭',
    description: 'Geschäftsauflösung',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'owner',
    specialServices: [],
    category: 'commercial',
  },
  storage_clearance: {
    label: 'Lagerräumung',
    icon: '📦',
    description: 'Lagerraum oder Einheit',
    sensitive: false,
    showConditionStep: false,
    defaultRole: 'owner',
    specialServices: [],
    category: 'standard',
  },
};

// Clearance areas for partial clearance
export const clearanceAreas = [
  { id: 'wohnzimmer', label: 'Wohnzimmer' },
  { id: 'schlafzimmer', label: 'Schlafzimmer' },
  { id: 'kueche', label: 'Küche' },
  { id: 'badezimmer', label: 'Badezimmer' },
  { id: 'kinderzimmer', label: 'Kinderzimmer' },
  { id: 'buero', label: 'Büro/Arbeitszimmer' },
  { id: 'keller', label: 'Keller' },
  { id: 'estrich', label: 'Estrich/Dachboden' },
  { id: 'garage', label: 'Garage' },
  { id: 'garten', label: 'Garten/Terrasse' },
  { id: 'balkon', label: 'Balkon' },
];

// Swiss Cantons
export const swissCantons = [
  { code: 'ZH', name: 'Zürich' },
  { code: 'BE', name: 'Bern' },
  { code: 'LU', name: 'Luzern' },
  { code: 'UR', name: 'Uri' },
  { code: 'SZ', name: 'Schwyz' },
  { code: 'OW', name: 'Obwalden' },
  { code: 'NW', name: 'Nidwalden' },
  { code: 'GL', name: 'Glarus' },
  { code: 'ZG', name: 'Zug' },
  { code: 'FR', name: 'Freiburg' },
  { code: 'SO', name: 'Solothurn' },
  { code: 'BS', name: 'Basel-Stadt' },
  { code: 'BL', name: 'Basel-Landschaft' },
  { code: 'SH', name: 'Schaffhausen' },
  { code: 'AR', name: 'Appenzell Ausserrhoden' },
  { code: 'AI', name: 'Appenzell Innerrhoden' },
  { code: 'SG', name: 'St. Gallen' },
  { code: 'GR', name: 'Graubünden' },
  { code: 'AG', name: 'Aargau' },
  { code: 'TG', name: 'Thurgau' },
  { code: 'TI', name: 'Tessin' },
  { code: 'VD', name: 'Waadt' },
  { code: 'VS', name: 'Wallis' },
  { code: 'NE', name: 'Neuenburg' },
  { code: 'GE', name: 'Genf' },
  { code: 'JU', name: 'Jura' },
];

// Helper functions
export const createEmptyRaeumungAnfrage = (): Partial<RaeumungAnfrage> => ({
  raeumungs_art: 'apartment_clearance',
  property: {
    type: 'apartment',
    zimmer_anzahl: 3,
    flaeche_m2: 70,
    stockwerke: 1,
    fuellgrad: 50,
  },
  adresse: {
    land: 'CH',
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
    kanton: '',
  },
  zugang: {
    stockwerk: 'ground_floor',
    lift_vorhanden: false,
    parkplatz_distanz_m: 20,
    stufen: 'steps_0_10',
    hindernisse: {
      enger_treppenhaus: false,
      enger_flur: false,
      schwieriger_zugang: false,
      parkverbot: false,
    },
  },
  umfang: {
    scope: 'complete',
    inventar: {
      moebel: { sofas: 0, betten: 0, schraenke: 0, tische: 0, regale: 0 },
      elektro: { kuehlschrank: 0, waschmaschine: 0, fernseher: 0, computer: 0, sonstige: 0 },
      sondermuell: { farben: 0, chemikalien: 0, batterien: 0, medikamente: 0, oele: 0 },
      schwer: { klavier: 0, tresor: 0, aquarium: 0, billardtisch: 0, sauna: 0 },
    },
    kartons_anzahl: 0,
    volumen_m3: 10,
  },
  zusatzleistungen: {
    demontage: false,
    entsorgung: true,
    recycling: true,
    endreinigung: { aktiv: false },
    renovation: false,
    wertanrechnung: true,
    dokumentensicherung: false,
    einlagerung: { aktiv: false },
  },
  termin: {
    dringlichkeit: 'normal',
    wunschdatum: '',
    flexibilitaet: 'flex_1_week',
    besichtigung_gewuenscht: true,
  },
  anfragender: {
    rolle: 'owner',
    anrede: 'herr',
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
  },
  agb_akzeptiert: false,
  berechtigung_bestaetigt: false,
  max_companies: 3,
  status: 'neu',
});

// Check if service type is sensitive
export const isSensitiveService = (art: RaeumungsArt): boolean => {
  return serviceTypeConfig[art]?.sensitive ?? false;
};

// Check if service type requires condition assessment
export const requiresConditionAssessment = (art: RaeumungsArt): boolean => {
  return serviceTypeConfig[art]?.showConditionStep ?? false;
};

// Get default role for service type
export const getDefaultRole = (art: RaeumungsArt): RequesterRole => {
  return serviceTypeConfig[art]?.defaultRole ?? 'owner';
};

// Get special services for service type
export const getSpecialServices = (art: RaeumungsArt): string[] => {
  return serviceTypeConfig[art]?.specialServices ?? [];
};


