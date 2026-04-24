// Renovation Types

export type RenovationsArt =
  | "komplett"        // Complete renovation
  | "bad"             // Bathroom
  | "kueche"          // Kitchen
  | "boden"           // Flooring
  | "elektro"         // Electrical
  | "sanitaer"        // Plumbing
  | "fenster_tueren"  // Windows & Doors
  | "fassade"         // Facade
  | "dach";           // Roof

export interface RenovationProperty {
  type: "wohnung" | "haus" | "gewerbe";
  flaeche_m2?: number;
  zimmer_anzahl?: number;
  baujahr?: number;
}

export interface RenovationAdresse {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: string;
}

export interface RenovationUmfang {
  beschreibung: string;
  materialien_vorhanden: boolean;
  eigene_vorstellungen?: string;
}

export interface RenovationTermin {
  wunschdatum: string;
  flexibilitaet: "fixed" | "flexible" | "very_flexible";
  dringlichkeit: "normal" | "dringend" | "sofort";
}

export interface RenovationAnfragender {
  anrede: "herr" | "frau" | "firma";
  vorname: string;
  nachname: string;
  firma?: string;
  email: string;
  telefon: string;
  kontaktzeit?: "vormittag" | "nachmittag" | "abend" | "jederzeit";
}

export interface RenovationAnfrage {
  renovations_art: RenovationsArt;
  property: RenovationProperty;
  adresse: RenovationAdresse;
  umfang: RenovationUmfang;
  termin: RenovationTermin;
  anfragender: RenovationAnfragender;
  bemerkungen?: string;
  fotos?: string[];
  agb_akzeptiert: boolean;
  korrekte_angaben_bestaetigt: boolean;
  max_companies: 1 | 3 | 5;
}

export const createEmptyRenovationAnfrage = (): Partial<RenovationAnfrage> => ({
  renovations_art: undefined,
  property: { type: "wohnung", flaeche_m2: undefined, zimmer_anzahl: undefined, baujahr: undefined },
  adresse: { strasse: "", hausnummer: "", plz: "", ort: "", land: "Schweiz" },
  umfang: { beschreibung: "", materialien_vorhanden: false, eigene_vorstellungen: "" },
  termin: { wunschdatum: "", flexibilitaet: "flexible", dringlichkeit: "normal" },
  anfragender: { anrede: "herr", vorname: "", nachname: "", email: "", telefon: "", kontaktzeit: "jederzeit" },
  bemerkungen: "",
  agb_akzeptiert: false,
  korrekte_angaben_bestaetigt: false,
  max_companies: 3,
});

export const getRenovationsArtLabel = (art: RenovationsArt): string => {
  const labels: Record<RenovationsArt, string> = {
    komplett: "Komplettrenovation",
    bad: "Badsanierung",
    kueche: "Küchenumbau",
    boden: "Bodenbeläge",
    elektro: "Elektroinstallation",
    sanitaer: "Sanitärarbeiten",
    fenster_tueren: "Fenster & Türen",
    fassade: "Fassadenarbeitung",
    dach: "Dachsanierung",
  };
  return labels[art] || art;
};

