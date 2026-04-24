// Klaviertransport (Piano Transport) Types
// For offerio.ch - Piano and Large Instrument Transport in Switzerland

export type ServiceType = 'transport' | 'storage' | 'disposal' | 'internal_move';

export type InstrumentType = 
  | 'digitalpiano'
  | 'spinett'
  | 'pianino_small'
  | 'pianino_medium'
  | 'pianino_large'
  | 'stutzfluegel'
  | 'salonfluegel'
  | 'halbkonzertfluegel'
  | 'konzertfluegel'
  | 'cembalo'
  | 'orgel'
  | 'other';

export type FloorLevel = 
  | 'ground_floor'
  | 'floor_1'
  | 'floor_2'
  | 'floor_3'
  | 'floor_4'
  | 'floor_5_plus'
  | 'basement';

export type StaircaseType = 'wide' | 'normal' | 'narrow' | 'spiral';
export type LiftFitStatus = 'fits_easily' | 'fits_tight' | 'does_not_fit' | 'unsure';
export type EquipmentType = 'none' | 'furniture_lift' | 'crane' | 'platform' | 'assessment';
export type DemontageType = 'no' | 'legs_only' | 'full' | 'unsure';
export type InstrumentAge = 'new' | 'recent' | 'used' | 'vintage' | 'antique' | 'unknown';
export type ValueRange = 'under_5k' | '5k_15k' | '15k_30k' | '30k_50k' | '50k_100k' | 'over_100k' | 'unknown';
export type Flexibility = 'fixed' | 'flex_3_days' | 'flex_1_week' | 'fully_flexible';
export type TimeSlot = 'morning' | 'afternoon' | 'flexible';
export type Salutation = 'herr' | 'frau' | 'divers';
export type TuningTime = 'direkt' | 'nach_2_3_wochen' | 'spaeter';
export type StorageDuration = '1_2_weeks' | '1_month' | '2_3_months' | '3_6_months' | 'over_6_months';

// Instrument specification for display and pricing
export interface InstrumentSpec {
  label: string;
  labelShort: string;
  category: 'klavier' | 'fluegel' | 'sonstige';
  weight_min: number;
  weight_max: number;
  dimension_key: string;
  base_price: number;
  floor_price: number;
  needs_demontage: boolean;
  is_grand: boolean;
  icon: string;
}

// Instrument specifications lookup
export const instrumentSpecs: Record<InstrumentType, InstrumentSpec> = {
  digitalpiano: {
    label: 'E-Piano / Digitalpiano',
    labelShort: 'E-Piano',
    category: 'sonstige',
    weight_min: 30,
    weight_max: 80,
    dimension_key: 'Variabel',
    base_price: 200,
    floor_price: 15,
    needs_demontage: false,
    is_grand: false,
    icon: '🎹'
  },
  spinett: {
    label: 'Kleinklavier / Spinett',
    labelShort: 'Spinett',
    category: 'klavier',
    weight_min: 150,
    weight_max: 180,
    dimension_key: 'H: ~110cm',
    base_price: 300,
    floor_price: 30,
    needs_demontage: false,
    is_grand: false,
    icon: '🎹'
  },
  pianino_small: {
    label: 'Pianino (klein)',
    labelShort: 'Kleines Klavier',
    category: 'klavier',
    weight_min: 170,
    weight_max: 220,
    dimension_key: 'H: 110-120cm',
    base_price: 320,
    floor_price: 35,
    needs_demontage: false,
    is_grand: false,
    icon: '🎹'
  },
  pianino_medium: {
    label: 'Pianino (mittel)',
    labelShort: 'Standard Klavier',
    category: 'klavier',
    weight_min: 200,
    weight_max: 260,
    dimension_key: 'H: 120-130cm',
    base_price: 350,
    floor_price: 40,
    needs_demontage: false,
    is_grand: false,
    icon: '🎹'
  },
  pianino_large: {
    label: 'Konzertklavier (gross)',
    labelShort: 'Konzertklavier',
    category: 'klavier',
    weight_min: 250,
    weight_max: 300,
    dimension_key: 'H: 130cm+',
    base_price: 380,
    floor_price: 50,
    needs_demontage: false,
    is_grand: false,
    icon: '🎹'
  },
  stutzfluegel: {
    label: 'Stutzflügel',
    labelShort: 'Stutzflügel',
    category: 'fluegel',
    weight_min: 280,
    weight_max: 350,
    dimension_key: 'L: 150-180cm',
    base_price: 450,
    floor_price: 60,
    needs_demontage: true,
    is_grand: true,
    icon: '🎼'
  },
  salonfluegel: {
    label: 'Salonflügel',
    labelShort: 'Salonflügel',
    category: 'fluegel',
    weight_min: 320,
    weight_max: 450,
    dimension_key: 'L: 180-210cm',
    base_price: 550,
    floor_price: 70,
    needs_demontage: true,
    is_grand: true,
    icon: '🎼'
  },
  halbkonzertfluegel: {
    label: 'Halbkonzertflügel',
    labelShort: 'Halbkonzertflügel',
    category: 'fluegel',
    weight_min: 400,
    weight_max: 500,
    dimension_key: 'L: 210-240cm',
    base_price: 700,
    floor_price: 90,
    needs_demontage: true,
    is_grand: true,
    icon: '🎼'
  },
  konzertfluegel: {
    label: 'Konzertflügel',
    labelShort: 'Konzertflügel',
    category: 'fluegel',
    weight_min: 480,
    weight_max: 700,
    dimension_key: 'L: 240-310cm',
    base_price: 900,
    floor_price: 120,
    needs_demontage: true,
    is_grand: true,
    icon: '🎼'
  },
  cembalo: {
    label: 'Cembalo / Hammerklavier',
    labelShort: 'Cembalo',
    category: 'sonstige',
    weight_min: 80,
    weight_max: 150,
    dimension_key: 'Variabel',
    base_price: 400,
    floor_price: 40,
    needs_demontage: false,
    is_grand: false,
    icon: '🎻'
  },
  orgel: {
    label: 'Orgel / Harmonium',
    labelShort: 'Orgel',
    category: 'sonstige',
    weight_min: 100,
    weight_max: 500,
    dimension_key: 'Variabel',
    base_price: 600,
    floor_price: 80,
    needs_demontage: true,
    is_grand: false,
    icon: '🎶'
  },
  other: {
    label: 'Anderes Grossinstrument',
    labelShort: 'Sonstiges',
    category: 'sonstige',
    weight_min: 100,
    weight_max: 500,
    dimension_key: 'Variabel',
    base_price: 400,
    floor_price: 50,
    needs_demontage: false,
    is_grand: false,
    icon: '🎵'
  }
};

// Common piano brands
export const pianoBrands = {
  premium: [
    'Steinway & Sons',
    'Bösendorfer',
    'Fazioli',
    'C. Bechstein',
    'Blüthner'
  ],
  professional: [
    'Yamaha',
    'Kawai',
    'Schimmel',
    'Seiler',
    'Grotrian-Steinweg',
    'Sauter',
    'August Förster',
    'Petrof',
    'Estonia'
  ],
  midrange: [
    'Boston',
    'Essex',
    'W. Hoffmann',
    'Zimmermann',
    'Rönisch',
    'Irmler'
  ],
  digital: [
    'Yamaha',
    'Roland',
    'Kawai',
    'Casio',
    'Nord',
    'Korg',
    'Kurzweil'
  ]
};

// Floor labels
export const floorLabels: Record<FloorLevel, string> = {
  ground_floor: 'Erdgeschoss',
  floor_1: '1. Stock',
  floor_2: '2. Stock',
  floor_3: '3. Stock',
  floor_4: '4. Stock',
  floor_5_plus: '5.+ Stock',
  basement: 'Untergeschoss'
};

// Service type labels
export const serviceTypeLabels: Record<ServiceType, { label: string; description: string; icon: string }> = {
  transport: { label: 'Klaviertransport', description: 'Transport von A nach B', icon: '🚚' },
  storage: { label: 'Klavierlagerung', description: 'Klimatisierte Einlagerung', icon: '📦' },
  disposal: { label: 'Klavierentsorgung', description: 'Fachgerechte Entsorgung', icon: '♻️' },
  internal_move: { label: 'Verschiebung im Haus', description: 'Innerhalb des Gebäudes', icon: '🏠' }
};

// Location details interface
export interface LocationDetails {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: string;
  stockwerk: FloorLevel;
  lift_vorhanden: boolean;
  lift_passt?: LiftFitStatus;
  lift_breite_cm?: number;
  lift_tiefe_cm?: number;
  lift_hoehe_cm?: number;
  lift_tragfaehigkeit_kg?: number;
  treppenhaus: StaircaseType;
  hindernisse: {
    enge_tueren: boolean;
    stufen_vor_gebaeude: boolean;
    schwierige_parkplatz: boolean;
    denkmalgeschuetzt: boolean;
    zufahrt_eingeschraenkt: boolean;
    details?: string;
  };
}

// Additional services interface
export interface AdditionalServices {
  stimmen: {
    aktiv: boolean;
    zeitpunkt?: TuningTime;
  };
  verpackung: boolean;
  lagerung: {
    aktiv: boolean;
    dauer?: StorageDuration;
  };
  versicherung: {
    aktiv: boolean;
    summe?: number;
  };
  entsorgung_alt: boolean;
}

// Contact person on site
export interface KontaktVorOrt {
  name: string;
  telefon: string;
}

// Main form data interface
export interface KlaviertransportAnfrage {
  // Service type
  service_type: ServiceType;
  
  // Instrument details
  instrument_type: InstrumentType;
  instrument_brand?: string;
  instrument_model?: string;
  instrument_age: InstrumentAge;
  instrument_value: ValueRange;
  instrument_notes?: string;
  instrument_photos?: string[];
  
  // Pickup location
  abholort: LocationDetails;
  
  // Delivery location (optional for disposal/storage)
  lieferort?: LocationDetails;
  same_address?: boolean; // For storage return
  
  // Special requirements
  equipment_required: EquipmentType;
  demontage: DemontageType;
  
  // Additional services
  zusatzleistungen: AdditionalServices;
  
  // Schedule
  wunschdatum: string;
  flexibilitaet: Flexibility;
  uhrzeit: TimeSlot;
  
  // Contact
  anrede: Salutation;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  kontaktzeit?: string;
  andere_kontaktperson: boolean;
  kontakt_vor_ort?: KontaktVorOrt;
  
  // Remarks
  bemerkungen?: string;
  
  // Agreements
  agb_akzeptiert: boolean;
  transportfaehig_bestaetigt: boolean;
  berechtigung_bestaetigt: boolean;
  
  // Offerten Anzahl
  max_companies: 1 | 3 | 5;
}

// Form state for wizard
export interface KlaviertransportFormState {
  currentStep: number;
  data: Partial<KlaviertransportAnfrage>;
  isSubmitting: boolean;
  errors: Record<string, string>;
  priceEstimate?: PriceEstimate;
}

// Price estimate interface
export interface PriceEstimate {
  basis: number;
  abholort_floor: number;
  lieferort_floor: number;
  distance: number;
  equipment: number;
  services: {
    stimmen: number;
    verpackung: number;
    lagerung: number;
    versicherung: number;
    entsorgung: number;
  };
  total: number;
}

// Helper functions
export function createEmptyLocationDetails(): LocationDetails {
  return {
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
    land: 'CH',
    stockwerk: 'ground_floor',
    lift_vorhanden: false,
    treppenhaus: 'normal',
    hindernisse: {
      enge_tueren: false,
      stufen_vor_gebaeude: false,
      schwierige_parkplatz: false,
      denkmalgeschuetzt: false,
      zufahrt_eingeschraenkt: false
    }
  };
}

export function createEmptyAdditionalServices(): AdditionalServices {
  return {
    stimmen: { aktiv: false },
    verpackung: false,
    lagerung: { aktiv: false },
    versicherung: { aktiv: false },
    entsorgung_alt: false
  };
}

export function createEmptyKlaviertransportAnfrage(): Partial<KlaviertransportAnfrage> {
  return {
    service_type: 'transport',
    instrument_type: undefined,
    instrument_age: 'unknown',
    instrument_value: 'unknown',
    abholort: createEmptyLocationDetails(),
    lieferort: createEmptyLocationDetails(),
    equipment_required: 'none',
    demontage: 'unsure',
    zusatzleistungen: createEmptyAdditionalServices(),
    wunschdatum: '',
    flexibilitaet: 'flex_1_week',
    uhrzeit: 'flexible',
    anrede: 'herr',
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
    andere_kontaktperson: false,
    agb_akzeptiert: false,
    transportfaehig_bestaetigt: false,
    berechtigung_bestaetigt: false,
    max_companies: 3
  };
}

// Get weight display string
export function getWeightDisplay(type: InstrumentType): string {
  const spec = instrumentSpecs[type];
  if (spec.weight_min === spec.weight_max) {
    return `~${spec.weight_min} kg`;
  }
  return `${spec.weight_min}-${spec.weight_max} kg`;
}

// Check if instrument needs furniture lift recommendation
export function needsFurnitureLiftRecommendation(
  instrumentType: InstrumentType, 
  floor: FloorLevel, 
  hasLift: boolean,
  liftFits?: LiftFitStatus
): boolean {
  const spec = instrumentSpecs[instrumentType];
  const floorNum = getFloorNumber(floor);
  
  // Grand pianos on 2+ floors without proper lift
  if (spec.is_grand && floorNum >= 2) {
    if (!hasLift || liftFits === 'does_not_fit') return true;
  }
  
  // Heavy instruments on 3+ floors without lift
  if (spec.weight_max > 200 && floorNum >= 3 && !hasLift) {
    return true;
  }
  
  return false;
}

// Get floor number for calculations
export function getFloorNumber(floor: FloorLevel): number {
  const floorMap: Record<FloorLevel, number> = {
    basement: -1,
    ground_floor: 0,
    floor_1: 1,
    floor_2: 2,
    floor_3: 3,
    floor_4: 4,
    floor_5_plus: 5
  };
  return floorMap[floor];
}

// Calculate price estimate
export function calculatePriceEstimate(data: Partial<KlaviertransportAnfrage>): PriceEstimate {
  const estimate: PriceEstimate = {
    basis: 0,
    abholort_floor: 0,
    lieferort_floor: 0,
    distance: 0,
    equipment: 0,
    services: {
      stimmen: 0,
      verpackung: 0,
      lagerung: 0,
      versicherung: 0,
      entsorgung: 0
    },
    total: 0
  };
  
  if (!data.instrument_type) return estimate;
  
  const spec = instrumentSpecs[data.instrument_type];
  
  // Base price
  estimate.basis = spec.base_price;
  
  // Floor costs for pickup
  if (data.abholort) {
    const floor = getFloorNumber(data.abholort.stockwerk);
    if (floor > 0 && (!data.abholort.lift_vorhanden || data.abholort.lift_passt === 'does_not_fit')) {
      estimate.abholort_floor = floor * spec.floor_price;
    }
  }
  
  // Floor costs for delivery
  if (data.lieferort && data.service_type === 'transport') {
    const floor = getFloorNumber(data.lieferort.stockwerk);
    if (floor > 0 && (!data.lieferort.lift_vorhanden || data.lieferort.lift_passt === 'does_not_fit')) {
      estimate.lieferort_floor = floor * spec.floor_price;
    }
  }
  
  // Equipment costs
  if (data.equipment_required === 'furniture_lift') {
    estimate.equipment = 300;
  } else if (data.equipment_required === 'crane') {
    estimate.equipment = 700;
  } else if (data.equipment_required === 'platform') {
    estimate.equipment = 200;
  }
  
  // Additional services
  if (data.zusatzleistungen) {
    if (data.zusatzleistungen.stimmen?.aktiv) {
      estimate.services.stimmen = 220;
    }
    if (data.zusatzleistungen.verpackung) {
      estimate.services.verpackung = 80;
    }
    if (data.zusatzleistungen.lagerung?.aktiv) {
      estimate.services.lagerung = 150; // Base monthly rate
    }
    if (data.zusatzleistungen.versicherung?.aktiv) {
      const summe = data.zusatzleistungen.versicherung.summe || 10000;
      estimate.services.versicherung = Math.round(summe * 0.015); // 1.5% of value
    }
    if (data.zusatzleistungen.entsorgung_alt) {
      estimate.services.entsorgung = spec.is_grand ? 450 : 300;
    }
  }
  
  // Calculate total
  estimate.total = estimate.basis + 
    estimate.abholort_floor + 
    estimate.lieferort_floor + 
    estimate.distance + 
    estimate.equipment +
    Object.values(estimate.services).reduce((a, b) => a + b, 0);
  
  return estimate;
}


