// Entsorgung (Waste Disposal) Types

export type EntsorgungsArt =
  | "sperrmuell"      // Bulky waste (furniture, mattresses)
  | "elektronik"      // Electronics (E-Waste)
  | "bauschutt"       // Construction debris
  | "gruenabfall"     // Green waste (garden)
  | "haushalt"        // Household waste
  | "gewerbe"         // Commercial waste
  | "sondermuell"     // Hazardous waste
  | "mischmuell";     // Mixed waste

export interface EntsorgungsMenge {
  volumen_m3?: number;          // Volume in cubic meters
  gewicht_kg?: number;          // Estimated weight
  anzahl_teile?: number;        // Number of items
  container_groesse?: "klein" | "mittel" | "gross" | "container_7m3" | "container_10m3" | "container_20m3";
}

export interface EntsorgungsObjekte {
  // Sperrmüll
  moebel?: boolean;
  matratzen?: boolean;
  teppiche?: boolean;
  holz?: boolean;
  
  // Elektronik
  elektrogeraete?: boolean;
  computer?: boolean;
  fernseher?: boolean;
  kuehlschrank?: boolean;
  waschmaschine?: boolean;
  
  // Bauschutt
  beton?: boolean;
  ziegel?: boolean;
  fliesen?: boolean;
  gips?: boolean;
  
  // Grünabfall
  gartenabfall?: boolean;
  baumschnitt?: boolean;
  laub?: boolean;
  
  // Sondermüll
  farben_lacke?: boolean;
  chemikalien?: boolean;
  batterien?: boolean;
  leuchtmittel?: boolean;
  asbest?: boolean;
  
  // Sonstiges
  sonstiges?: string;
}

export interface EntsorgungsAdresse {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: string;
}

export interface EntsorgungsZugang {
  stockwerk: string;
  lift_vorhanden: boolean;
  lift_nutzbar: boolean;
  parkplatz_vorhanden: boolean;
  parkplatz_distanz_m?: number;
  zufahrt_lkw: boolean;
  container_stellplatz: boolean;
  besonderheiten?: string;
}

export interface EntsorgungsZusatzleistungen {
  demontage: boolean;
  verpackung: boolean;
  transport_aus_wohnung: boolean;
  container_lieferung: boolean;
  container_abholung: boolean;
  besenrein: boolean;
  entsorgungsnachweis: boolean;
}

export interface EntsorgungsTermin {
  wunschdatum: string;
  flexibilitaet: "fixed" | "flexible" | "very_flexible";
  dringlichkeit: "normal" | "dringend" | "sofort";
  zeitfenster?: "vormittag" | "nachmittag" | "ganztags";
}

export interface EntsorgungsAnfragender {
  anrede: "herr" | "frau" | "firma";
  vorname: string;
  nachname: string;
  firma?: string;
  email: string;
  telefon: string;
  kontaktzeit?: "vormittag" | "nachmittag" | "abend" | "jederzeit";
}

export interface EntsorgungAnfrage {
  // Service type
  entsorgungs_art: EntsorgungsArt;
  
  // What to dispose
  menge: EntsorgungsMenge;
  objekte: EntsorgungsObjekte;
  
  // Location
  adresse: EntsorgungsAdresse;
  zugang: EntsorgungsZugang;
  
  // Additional services
  zusatzleistungen: EntsorgungsZusatzleistungen;
  
  // Timing
  termin: EntsorgungsTermin;
  
  // Contact
  anfragender: EntsorgungsAnfragender;
  
  // Additional
  bemerkungen?: string;
  fotos?: string[];
  
  // Confirmations
  agb_akzeptiert: boolean;
  korrekte_angaben_bestaetigt: boolean;
  
  // Offer settings
  max_companies: 1 | 3 | 5;
}

export const createEmptyEntsorgungAnfrage = (): Partial<EntsorgungAnfrage> => ({
  entsorgungs_art: undefined,
  menge: {
    volumen_m3: undefined,
    gewicht_kg: undefined,
    anzahl_teile: undefined,
    container_groesse: undefined,
  },
  objekte: {
    moebel: false,
    matratzen: false,
    teppiche: false,
    holz: false,
    elektrogeraete: false,
    computer: false,
    fernseher: false,
    kuehlschrank: false,
    waschmaschine: false,
    beton: false,
    ziegel: false,
    fliesen: false,
    gips: false,
    gartenabfall: false,
    baumschnitt: false,
    laub: false,
    farben_lacke: false,
    chemikalien: false,
    batterien: false,
    leuchtmittel: false,
    asbest: false,
    sonstiges: "",
  },
  adresse: {
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    land: "Schweiz",
  },
  zugang: {
    stockwerk: "ground_floor",
    lift_vorhanden: false,
    lift_nutzbar: false,
    parkplatz_vorhanden: false,
    parkplatz_distanz_m: 0,
    zufahrt_lkw: false,
    container_stellplatz: false,
    besonderheiten: "",
  },
  zusatzleistungen: {
    demontage: false,
    verpackung: false,
    transport_aus_wohnung: false,
    container_lieferung: false,
    container_abholung: false,
    besenrein: false,
    entsorgungsnachweis: false,
  },
  termin: {
    wunschdatum: "",
    flexibilitaet: "flexible",
    dringlichkeit: "normal",
    zeitfenster: "ganztags",
  },
  anfragender: {
    anrede: "herr",
    vorname: "",
    nachname: "",
    firma: "",
    email: "",
    telefon: "",
    kontaktzeit: "jederzeit",
  },
  bemerkungen: "",
  fotos: [],
  agb_akzeptiert: false,
  korrekte_angaben_bestaetigt: false,
  max_companies: 3,
});

// Helper functions
export const getEntsorgungsArtLabel = (art: EntsorgungsArt): string => {
  const labels: Record<EntsorgungsArt, string> = {
    sperrmuell: "Sperrmüll",
    elektronik: "Elektroschrott",
    bauschutt: "Bauschutt",
    gruenabfall: "Grünabfall",
    haushalt: "Haushaltsauflösung",
    gewerbe: "Gewerbeentsorgung",
    sondermuell: "Sondermüll",
    mischmuell: "Mischentsorgung",
  };
  return labels[art] || art;
};

export const getEntsorgungsArtDescription = (art: EntsorgungsArt): string => {
  const descriptions: Record<EntsorgungsArt, string> = {
    sperrmuell: "Möbel, Matratzen, Teppiche und andere sperrige Gegenstände",
    elektronik: "Elektrogeräte, Computer, Fernseher und andere Elektronik",
    bauschutt: "Beton, Ziegel, Fliesen und andere Baumaterialien",
    gruenabfall: "Gartenabfälle, Baumschnitt, Laub und Grünschnitt",
    haushalt: "Komplette Haushaltsauflösung mit verschiedenen Abfallarten",
    gewerbe: "Gewerbliche Abfälle und Betriebsauflösungen",
    sondermuell: "Farben, Lacke, Chemikalien und andere gefährliche Stoffe",
    mischmuell: "Gemischte Abfälle verschiedener Kategorien",
  };
  return descriptions[art] || "";
};

export const requiresSpecialHandling = (art: EntsorgungsArt): boolean => {
  return ["sondermuell", "elektronik", "bauschutt"].includes(art);
};

