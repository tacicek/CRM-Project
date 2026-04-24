// Möbellift (Furniture Lift Rental) Types
// For offerio.ch - Swiss lead management platform

// Service type options
export type ServiceType = 'with_operator' | 'self_service' | 'pickup';

// Purpose/use case
export type Purpose = 'umzug' | 'einzelstueck' | 'baumaterial' | 'handwerker' | 'entsorgung' | 'sonstiges';

// Direction of transport
export type Direction = 'up' | 'down' | 'both';

// Floor levels
export type FloorLevel = 'floor_1' | 'floor_2' | 'floor_3' | 'floor_4' | 'floor_5' | 'floor_6' | 'floor_7_plus' | 'roof';

// Access point types
export type AccessPoint = 'window' | 'balcony' | 'roof_window' | 'terrace';

// Space availability
export type SpaceAvailability = 'sufficient' | 'limited' | 'very_limited' | 'unsure';

// Parking situation
export type ParkingSituation = 'parking_available' | 'no_parking_zone' | 'street_side' | 'unsure';

// Power availability
export type PowerAvailability = 'power_available' | 'no_power' | 'unsure';

// Rental duration
export type Duration = 'short' | 'half_day' | 'full_day' | 'multi_day';

// Preferred time slots
export type TimeSlot = 'early' | 'morning' | 'afternoon' | 'flexible';

// Flexibility options
export type Flexibility = 'fixed' | 'flex_2_days' | 'flex_1_week' | 'fully_flexible';

// Apartment size
export type ApartmentSize = '1_room' | '2_room' | '3_room' | '4_room' | '5_room' | '6_plus_room' | 'house';

// Load size estimation
export type LoadSize = 'small' | 'medium' | 'large' | 'very_large';

// Item weight categories
export type ItemWeight = 'light' | 'medium' | 'heavy' | 'very_heavy';

// Single item types
export type SingleItemType = 
  | 'sofa' 
  | 'wardrobe' 
  | 'bed' 
  | 'piano' 
  | 'grand_piano' 
  | 'appliance' 
  | 'fridge' 
  | 'whirlpool' 
  | 'safe' 
  | 'fitness' 
  | 'pool_table' 
  | 'aquarium' 
  | 'other';

// Building material types
export type MaterialType = 
  | 'windows_doors' 
  | 'drywall' 
  | 'insulation' 
  | 'wood_panels' 
  | 'bricks' 
  | 'roof_tiles' 
  | 'solar_panels' 
  | 'sanitary' 
  | 'other';

// Contact preference
export type ContactPreference = 'phone' | 'email' | 'whatsapp' | 'any';

// Salutation
export type Salutation = 'herr' | 'frau' | 'firma' | 'divers';

// Lift types for recommendation
export type LiftType = 'anhaengerlift' | 'selbstfahrer' | 'stecklift' | 'portabel';

// Location details interface
export interface LocationDetails {
  adresse: {
    strasse: string;
    hausnummer: string;
    plz: string;
    ort: string;
    land: string;
  };
  stockwerk: FloorLevel;
  geschaetzte_hoehe_m: number;
  zugang: AccessPoint;
  oeffnung: {
    breite_cm: number;
    hoehe_cm: number;
  };
}

// Site conditions interface
export interface SiteConditions {
  stellflaeche: SpaceAvailability;
  hindernisse: {
    baeume: boolean;
    stromleitungen: boolean;
    vordach: boolean;
    parkierte_fahrzeuge: boolean;
    baustelle: boolean;
    enge_zufahrt: boolean;
    hang: boolean;
    keine: boolean;
  };
  parkplatz: ParkingSituation;
  strom: PowerAvailability;
}

// Transport items for Umzug
export interface UmzugTransport {
  wohnungsgroesse: ApartmentSize;
  menge: LoadSize;
}

// Transport items for Einzelstück
export interface EinzelstueckTransport {
  typ: SingleItemType;
  gewicht: ItemWeight;
  masse?: {
    laenge_cm: number;
    breite_cm: number;
    hoehe_cm: number;
  };
  beschreibung?: string;
}

// Transport items for Baumaterial
export interface BaumaterialTransport {
  art: MaterialType;
  menge: number;
  einheit: string;
}

// Combined transport items
export interface TransportItems {
  umzug?: UmzugTransport;
  einzelstueck?: EinzelstueckTransport;
  baumaterial?: BaumaterialTransport;
  sonstiges?: string;
}

// Schedule interface
export interface Schedule {
  wunschdatum: string;
  wunschzeit: TimeSlot;
  dauer: Duration;
  flexibilitaet: Flexibility;
}

// Additional services interface
export interface AdditionalServices {
  halteverbot: boolean;
  helfer: {
    aktiv: boolean;
    anzahl: number;
  };
  verpackung: boolean;
  entsorgung: boolean;
  lagerung: boolean;
}

// Customer contact info
export interface CustomerInfo {
  anrede: Salutation;
  vorname: string;
  nachname: string;
  firma?: string;
  email: string;
  telefon: string;
  kontakt_art: ContactPreference;
}

// On-site contact person
export interface OnSiteContact {
  name: string;
  telefon: string;
}

// Main Möbellift Anfrage interface
export interface MoebelliftAnfrage {
  // Service
  service_type: ServiceType;
  zweck: Purpose;
  richtung: Direction;
  
  // Location
  einsatzort: LocationDetails;
  
  // Site conditions
  gegebenheiten: SiteConditions;
  
  // Items
  transport: TransportItems;
  
  // Schedule
  termin: Schedule;
  
  // Additional services
  zusatzleistungen: AdditionalServices;
  
  // Contact
  kunde: CustomerInfo;
  kontakt_vor_ort?: OnSiteContact;
  
  // Photos
  fotos?: string[];
  
  // Agreements
  agb_akzeptiert: boolean;
  stellflaeche_bestaetigt: boolean;
  berechtigung_bestaetigt: boolean;
  
  // Additional notes
  bemerkungen?: string;
  
  // Offerten Anzahl
  max_companies: 1 | 3 | 5;
  
  // Meta
  id?: string;
  anfrage_nummer?: string;
  status: 'neu' | 'in_bearbeitung' | 'offerte_erstellt' | 'bestaetigt' | 'abgeschlossen';
  created_at?: string;
  updated_at?: string;
  
  // Calculated
  geschaetzter_preis_chf?: number;
  empfohlener_lift_typ?: LiftType;
}

// Lift specifications for recommendations
export interface LiftSpec {
  label: string;
  max_height_m: number;
  max_load_kg: number;
  min_space_m: number;
  platform_size: string;
  setup_time_min: number;
  best_for: string[];
  pros: string[];
  cons: string[];
}

export const liftSpecs: Record<LiftType, LiftSpec> = {
  anhaengerlift: {
    label: 'Anhängerlift',
    max_height_m: 30,
    max_load_kg: 400,
    min_space_m: 3,
    platform_size: '2.0 x 1.4 m',
    setup_time_min: 15,
    best_for: ['umzug', 'einzelstueck', 'heavy'],
    pros: ['Schnellster Auf-/Abbau', 'Höchste Tragkraft', 'Professionelle Bedienung'],
    cons: ['Braucht Stellfläche (3x3m)']
  },
  selbstfahrer: {
    label: 'Selbstfahrer-Lift',
    max_height_m: 30,
    max_load_kg: 400,
    min_space_m: 3,
    platform_size: '2.0 x 1.4 m',
    setup_time_min: 10,
    best_for: ['umzug', 'commercial'],
    pros: ['Sehr schneller Aufbau', 'Hohe Tragkraft', 'Manövrierfähig'],
    cons: ['Braucht Stellfläche (3x3m)', 'Höhere Kosten']
  },
  stecklift: {
    label: 'Stecklift / Leiterlift',
    max_height_m: 25,
    max_load_kg: 250,
    min_space_m: 1.5,
    platform_size: '1.5 x 1.0 m',
    setup_time_min: 30,
    best_for: ['limited_space', 'roof_window', 'baumaterial'],
    pros: ['Für enge Stellen (Gärten, Höfe)', 'Erreicht Dachfenster', 'Kein Fahrzeug nötig'],
    cons: ['Längerer Auf-/Abbau', 'Geringere Tragkraft']
  },
  portabel: {
    label: 'Portabler Lift',
    max_height_m: 20,
    max_load_kg: 200,
    min_space_m: 1.5,
    platform_size: '1.2 x 0.8 m',
    setup_time_min: 45,
    best_for: ['light_items', 'difficult_access'],
    pros: ['Flexibel einsetzbar', 'Für schwierige Zugänge'],
    cons: ['Längster Aufbau', 'Geringste Tragkraft']
  }
};

// Floor height mapping
export const floorHeights: Record<FloorLevel, number> = {
  floor_1: 3,
  floor_2: 6,
  floor_3: 9,
  floor_4: 12,
  floor_5: 15,
  floor_6: 18,
  floor_7_plus: 21,
  roof: 24
};

// Purpose configuration
export interface PurposeConfig {
  label: string;
  description: string;
  icon: string;
}

export const purposeConfig: Record<Purpose, PurposeConfig> = {
  umzug: {
    label: 'Umzug',
    description: 'Kompletter Wohnungsumzug',
    icon: '🏠📦'
  },
  einzelstueck: {
    label: 'Einzelstück',
    description: 'Sofa, Schrank, Klavier etc.',
    icon: '🛋️'
  },
  baumaterial: {
    label: 'Baumaterial',
    description: 'Fenster, Türen, Platten etc.',
    icon: '🧱'
  },
  handwerker: {
    label: 'Handwerker',
    description: 'Werkzeug, Maschinen',
    icon: '🔧'
  },
  entsorgung: {
    label: 'Entsorgung',
    description: 'Räumung, Sperrgut',
    icon: '♻️'
  },
  sonstiges: {
    label: 'Sonstiges',
    description: 'Anderer Einsatzzweck',
    icon: '❓'
  }
};

// Single item configuration
export interface ItemConfig {
  label: string;
  maxWeight: string;
  notes?: string;
}

export const singleItemConfig: Record<SingleItemType, ItemConfig> = {
  sofa: { label: 'Sofa / Couch', maxWeight: '~100kg', notes: 'Masse prüfen' },
  wardrobe: { label: 'Schrank', maxWeight: '~150kg', notes: 'Evtl. Demontage' },
  bed: { label: 'Bett / Matratze', maxWeight: '~80kg' },
  piano: { label: 'Klavier', maxWeight: '200-300kg', notes: 'Schwerlast-Lift nötig' },
  grand_piano: { label: 'Flügel', maxWeight: '300-500kg', notes: 'Spezialausrüstung' },
  appliance: { label: 'Waschmaschine / Trockner', maxWeight: '~80kg' },
  fridge: { label: 'Kühlschrank', maxWeight: '~100kg', notes: 'Nicht kippen' },
  whirlpool: { label: 'Whirlpool / Jacuzzi', maxWeight: '150-400kg', notes: 'Evtl. Kran nötig' },
  safe: { label: 'Tresor / Safe', maxWeight: '100-1000kg', notes: 'Speziallösung' },
  fitness: { label: 'Fitnessgerät', maxWeight: '50-300kg' },
  pool_table: { label: 'Billardtisch', maxWeight: '200-400kg', notes: 'Profi-Handling' },
  aquarium: { label: 'Aquarium', maxWeight: 'Variabel', notes: 'Sehr empfindlich' },
  other: { label: 'Anderes', maxWeight: 'Variabel' }
};

// Helper function to create empty form data
export function createEmptyMoebelliftAnfrage(): MoebelliftAnfrage {
  return {
    service_type: 'with_operator',
    zweck: 'umzug',
    richtung: 'both',
    einsatzort: {
      adresse: {
        strasse: '',
        hausnummer: '',
        plz: '',
        ort: '',
        land: 'CH'
      },
      stockwerk: 'floor_3',
      geschaetzte_hoehe_m: 9,
      zugang: 'window',
      oeffnung: {
        breite_cm: 100,
        hoehe_cm: 150
      }
    },
    gegebenheiten: {
      stellflaeche: 'sufficient',
      hindernisse: {
        baeume: false,
        stromleitungen: false,
        vordach: false,
        parkierte_fahrzeuge: false,
        baustelle: false,
        enge_zufahrt: false,
        hang: false,
        keine: true
      },
      parkplatz: 'parking_available',
      strom: 'power_available'
    },
    transport: {},
    termin: {
      wunschdatum: '',
      wunschzeit: 'morning',
      dauer: 'half_day',
      flexibilitaet: 'flex_2_days'
    },
    zusatzleistungen: {
      halteverbot: false,
      helfer: {
        aktiv: false,
        anzahl: 1
      },
      verpackung: false,
      entsorgung: false,
      lagerung: false
    },
    kunde: {
      anrede: 'herr',
      vorname: '',
      nachname: '',
      email: '',
      telefon: '',
      kontakt_art: 'phone'
    },
    agb_akzeptiert: false,
    stellflaeche_bestaetigt: false,
    berechtigung_bestaetigt: false,
    max_companies: 3,
    status: 'neu'
  };
}

// Duration estimation based on inputs
export function estimateDuration(data: MoebelliftAnfrage): Duration {
  if (data.zweck === 'umzug' && data.transport.umzug) {
    const roomMap: Record<ApartmentSize, Duration> = {
      '1_room': 'short',
      '2_room': 'short',
      '3_room': 'half_day',
      '4_room': 'half_day',
      '5_room': 'full_day',
      '6_plus_room': 'full_day',
      'house': 'full_day'
    };
    return roomMap[data.transport.umzug.wohnungsgroesse] || 'half_day';
  }
  
  if (data.zweck === 'einzelstueck') {
    return 'short';
  }
  
  if (data.zweck === 'baumaterial' && data.transport.baumaterial) {
    const qty = data.transport.baumaterial.menge || 0;
    if (qty <= 10) return 'short';
    if (qty <= 30) return 'half_day';
    return 'full_day';
  }
  
  return 'half_day';
}

// Lift type recommendation based on conditions
export function recommendLiftType(data: MoebelliftAnfrage): LiftType {
  const space = data.gegebenheiten.stellflaeche;
  const access = data.einsatzort.zugang;
  const floor = data.einsatzort.stockwerk;
  const weight = data.transport.einzelstueck?.gewicht;
  
  // Need Stecklift for very limited space
  if (space === 'very_limited') {
    return 'stecklift';
  }
  
  // Need Stecklift for roof windows (can angle)
  if (access === 'roof_window') {
    return 'stecklift';
  }
  
  // Need Anhängerlift for heavy items
  if (weight === 'very_heavy') {
    return 'anhaengerlift';
  }
  
  // Need Anhängerlift for high floors
  if (['floor_6', 'floor_7_plus', 'roof'].includes(floor)) {
    return 'anhaengerlift';
  }
  
  // Use Stecklift for limited space
  if (space === 'limited') {
    return 'stecklift';
  }
  
  // Default: Anhängerlift (most versatile)
  return 'anhaengerlift';
}

// Price estimation (rough)
export function estimatePrice(data: MoebelliftAnfrage): number {
  let basePrice = 0;
  
  // Base price by service type and duration
  const durationPrices = {
    short: { with_operator: 250, self_service: 180, pickup: 150 },
    half_day: { with_operator: 420, self_service: 300, pickup: 230 },
    full_day: { with_operator: 720, self_service: 480, pickup: 380 },
    multi_day: { with_operator: 650, self_service: 430, pickup: 340 } // per day
  };
  
  basePrice = durationPrices[data.termin.dauer][data.service_type];
  
  // Floor surcharge
  const floorSurcharge: Record<FloorLevel, number> = {
    floor_1: 0, floor_2: 0, floor_3: 0,
    floor_4: 50, floor_5: 80,
    floor_6: 120, floor_7_plus: 150, roof: 180
  };
  basePrice += floorSurcharge[data.einsatzort.stockwerk];
  
  // Additional services
  if (data.zusatzleistungen.halteverbot) basePrice += 180;
  if (data.zusatzleistungen.helfer.aktiv) {
    const hours = data.termin.dauer === 'short' ? 2 : data.termin.dauer === 'half_day' ? 4 : 8;
    basePrice += data.zusatzleistungen.helfer.anzahl * 50 * hours;
  }
  if (data.zusatzleistungen.verpackung) basePrice += 80;
  if (data.zusatzleistungen.entsorgung) basePrice += 120;
  if (data.zusatzleistungen.lagerung) basePrice += 100;
  
  return Math.round(basePrice);
}


