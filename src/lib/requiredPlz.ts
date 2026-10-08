import type { ExtractedData } from "@/types/extractedLead";

/**
 * Welche PLZ ein Import braucht — und woher sie kommt.
 *
 * `leads.from_plz` ist NOT NULL. Welches Formularfeld dort landet, entscheidet
 * `extractedLeadToLeadData` je Servicetyp: Umzug und Klaviertransport lesen
 * `from_plz`, die Einzeladress-Services `address_plz`, Lagerung `pickup_plz`.
 *
 * Die Pflichtpruefung in ManualImport.tsx hatte diese Zuordnung als EIGENE
 * Abschrift — und die kannte `umzug_firma` nicht: ein Firmenumzug fiel in den
 * Einzeladress-Zweig und verlangte `address_plz`, ein Feld, das das Formular fuer
 * Umzuege gar nicht zeigt. Jede Firmenumzug-Anfrage scheiterte mit «PLZ
 * erforderlich», obwohl beide Adressen eine PLZ trugen.
 *
 * Deshalb steht die Zuordnung jetzt hier, einmal, und ein Test haelt sie gegen
 * `extractedLeadToLeadData`: fuer jeden Servicetyp muss das Feld, das diese
 * Tabelle nennt, genau das sein, das als `from_plz` gespeichert wird.
 */

export type PlzSource = "from_plz" | "address_plz" | "pickup_plz";

export const PLZ_SOURCE_BY_SERVICE = {
  umzug_privat: "from_plz",
  umzug_firma: "from_plz",
  klaviertransport: "from_plz",
  reinigung: "address_plz",
  raeumung: "address_plz",
  entsorgung: "address_plz",
  moebellift: "address_plz",
  lagerung: "pickup_plz",
} as const satisfies Record<string, PlzSource>;

export type ImportServiceType = keyof typeof PLZ_SOURCE_BY_SERVICE;

export const isImportServiceType = (value: unknown): value is ImportServiceType =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(PLZ_SOURCE_BY_SERVICE, value);

export const PLZ_LABEL_KEY = {
  from_plz: "lead.plz.from",
  address_plz: "lead.plz.address",
  pickup_plz: "lead.plz.pickup",
} as const satisfies Record<PlzSource, string>;

const SWISS_PLZ = /^\d{4}$/;

export interface RequiredPlz {
  source: PlzSource;
  labelKey: (typeof PLZ_LABEL_KEY)[PlzSource];
  value: string;
  valid: boolean;
}

/**
 * `null` heisst: der Servicetyp ist diesem Import unbekannt. Das ist ein Fehler
 * des Aufrufers (falsche Extraktion), kein Fall fuer eine Ersatz-PLZ.
 */
export const requiredPlz = (data: Pick<ExtractedData, "detected_service_type" | PlzSource>): RequiredPlz | null => {
  const serviceType = data.detected_service_type;
  if (!isImportServiceType(serviceType)) return null;

  const source = PLZ_SOURCE_BY_SERVICE[serviceType];
  const value = (data[source] ?? "").trim();
  return { source, labelKey: PLZ_LABEL_KEY[source], value, valid: SWISS_PLZ.test(value) };
};
