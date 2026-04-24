// types/reinigung.ts
// TypeScript interfaces for Übergabereinigung (Handover Cleaning) Multi-Step Wizard

// Property types for Step 1
export type UnterkunftArt = 'haus' | 'wohnung' | 'wg_zimmer' | 'lager' | 'buero';

// Service types
export type ReinigungServiceType = 'uebergabereinigung' | 'unterhaltsreinigung' | 'grundreinigung';

// Flexibility options for appointment
export type TerminFlexibilitaet = 'fest' | 'flexibel_1_woche' | 'flexibel_2_wochen';

// Request status
export type ReinigungStatus = 'neu' | 'in_bearbeitung' | 'angebote_erhalten' | 'abgeschlossen';

// Step 2: Additional Rooms
export interface ZusatzRaeume {
  keller: boolean;
  dachboden: boolean;
  garage: boolean;
  wintergarten: boolean;
  balkon: {
    aktiv: boolean;
    flaeche_m2: number;
    hochdruckreinigung: boolean;
    glas_gelaender: boolean;
  };
}

// Step 3: Special Conditions
export interface Besonderheiten {
  keine: boolean;
  einbauschraenke: boolean;
  stark_verhaerteter_dreck_kueche: boolean;
  waschturm: boolean;
  haustierhaltung: boolean;
  moebel_vorhanden: boolean;
}

// Step 4: Bathroom
export interface Badezimmer {
  duschen_badewannen: number;
  toiletten: number;
  lavabos: number;
  verhaerteter_schmutz: boolean;
}

// Step 5: Windows
export interface Fenster {
  normale_fenster: number;
  fensterwaende: number;
  fenstertueren: number;
  schimmel_entfernen: boolean;
  weitere_typen: {
    dachfenster: number;
    rundfenster: number;
  };
}

// Step 6: Blinds/Shutters
export interface Storen {
  lamellenstoren: number;
  rolllaeden: number;
  fensterlaeden: number;
}

// Step 7: Additional Services
export interface Zusatzleistungen {
  hochdruck_reinigung: boolean;
  kamin_reinigung: boolean;
  teppichboden: {
    aktiv: boolean;
    anzahl_raeume: number;
  };
  fugenreinigung: boolean;
}

// Customer Information
export interface Kunde {
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
}

// Address
export interface Adresse {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  kanton?: string;
}

// Appointment
export interface Termin {
  wunschdatum: string; // ISO date
  flexibilitaet: TerminFlexibilitaet;
  bemerkungen: string;
}

// Complete Reinigung Anfrage interface
export interface ReinigungAnfrage {
  // Step 1 - Service & Property
  service_type: ReinigungServiceType;
  unterkunft_art: UnterkunftArt;
  zimmer_anzahl: number; // 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6+
  wohnflaeche_m2: number;
  
  // Step 2 - Additional Rooms
  zusatz_raeume: ZusatzRaeume;
  
  // Step 3 - Special Conditions
  besonderheiten: Besonderheiten;
  
  // Step 4 - Bathroom
  badezimmer: Badezimmer;
  
  // Step 5 - Windows
  fenster: Fenster;
  
  // Step 6 - Blinds/Shutters
  storen: Storen;
  
  // Step 7 - Additional Services
  zusatzleistungen: Zusatzleistungen;
  
  // Contact Information
  kunde: Kunde;
  
  // Address
  adresse: Adresse;
  
  // Appointment
  termin: Termin;
  
  // Meta
  id?: string;
  anfrage_nummer?: string;
  status: ReinigungStatus;
  created_at?: string;
  updated_at?: string;
}

// Form state for wizard
export interface ReinigungFormState {
  currentStep: number;
  totalSteps: number;
  data: Partial<ReinigungAnfrage>;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

// Default values for form initialization
export const DEFAULT_ZUSATZ_RAEUME: ZusatzRaeume = {
  keller: false,
  dachboden: false,
  garage: false,
  wintergarten: false,
  balkon: {
    aktiv: false,
    flaeche_m2: 0,
    hochdruckreinigung: false,
    glas_gelaender: false,
  },
};

export const DEFAULT_BESONDERHEITEN: Besonderheiten = {
  keine: true,
  einbauschraenke: false,
  stark_verhaerteter_dreck_kueche: false,
  waschturm: false,
  haustierhaltung: false,
  moebel_vorhanden: false,
};

export const DEFAULT_BADEZIMMER: Badezimmer = {
  duschen_badewannen: 1,
  toiletten: 1,
  lavabos: 1,
  verhaerteter_schmutz: false,
};

export const DEFAULT_FENSTER: Fenster = {
  normale_fenster: 0,
  fensterwaende: 0,
  fenstertueren: 0,
  schimmel_entfernen: false,
  weitere_typen: {
    dachfenster: 0,
    rundfenster: 0,
  },
};

export const DEFAULT_STOREN: Storen = {
  lamellenstoren: 0,
  rolllaeden: 0,
  fensterlaeden: 0,
};

export const DEFAULT_ZUSATZLEISTUNGEN: Zusatzleistungen = {
  hochdruck_reinigung: false,
  kamin_reinigung: false,
  teppichboden: {
    aktiv: false,
    anzahl_raeume: 0,
  },
  fugenreinigung: false,
};

export const DEFAULT_KUNDE: Kunde = {
  vorname: '',
  nachname: '',
  email: '',
  telefon: '',
};

export const DEFAULT_ADRESSE: Adresse = {
  strasse: '',
  hausnummer: '',
  plz: '',
  ort: '',
  kanton: '',
};

export const DEFAULT_TERMIN: Termin = {
  wunschdatum: '',
  flexibilitaet: 'flexibel_1_woche',
  bemerkungen: '',
};

// Step validation fields
export const STEP_VALIDATION = {
  step1: ['service_type', 'unterkunft_art', 'wohnflaeche_m2'],
  step2: ['zusatz_raeume'],
  step3: ['besonderheiten'],
  step4: ['badezimmer'],
  step5: ['fenster'],
  step6: ['storen'],
  step7: ['zusatzleistungen'],
  step8: ['kunde', 'adresse', 'termin'],
} as const;

// Room count options
export const ROOM_COUNT_OPTIONS = [
  '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6+'
] as const;

// Property type options with labels and icons
export const PROPERTY_TYPE_OPTIONS = [
  { value: 'haus' as UnterkunftArt, label: 'Haus', icon: 'Home' },
  { value: 'wohnung' as UnterkunftArt, label: 'Wohnung', icon: 'Building' },
  { value: 'wg_zimmer' as UnterkunftArt, label: 'WG-Zimmer', icon: 'Users' },
  { value: 'lager' as UnterkunftArt, label: 'Lager', icon: 'Warehouse' },
  { value: 'buero' as UnterkunftArt, label: 'Büro', icon: 'Briefcase' },
] as const;

// Error messages in German
export const ERROR_MESSAGES = {
  required: 'Dieses Feld ist erforderlich',
  min_area: 'Mindestfläche ist {min} m²',
  max_area: 'Maximale Fläche ist {max} m²',
  select_one: 'Bitte wählen Sie mindestens eine Option',
  invalid_number: 'Bitte geben Sie eine gültige Zahl ein',
  invalid_email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
  invalid_phone: 'Bitte geben Sie eine gültige Telefonnummer ein',
  invalid_plz: 'Bitte geben Sie eine gültige PLZ ein (4 Ziffern)',
} as const;


