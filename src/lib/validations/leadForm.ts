import { z } from "zod";

// Swiss phone number regex (accepts +41, 0041, or local formats)
const phoneRegex = /^(\+41|0041|0)\s?[1-9]\d{1,2}\s?\d{3}\s?\d{2}\s?\d{2}$/;

// Swiss PLZ regex (4 digits)
const plzRegex = /^\d{4}$/;

// Service types
const serviceTypes = [
  "umzug_privat",
  "umzug_firma",
  "klaviertransport",
  "moebellift",
  "reinigung_end",
  "reinigung_grund",
  "raeumung_wohnung",
  "transport_moebel",
  "lagerung",
  "entsorgung",
  "malerarbeit",
  "usm_transport",
  "wasserbett_transport",
] as const;

// Piano types for Klaviertransport
const pianoTypes = ["klavier", "fluegel", "stutzfluegel", "e_piano", "keyboard"] as const;

// Staircase types
const staircaseTypes = ["gerade", "kurvig", "wendel", "keine"] as const;


// Step 1: Service validation
export const step1Schema = z.object({
  serviceType: z.enum(serviceTypes, {
    errorMap: () => ({ message: "Bitte wählen Sie einen Service aus." }),
  }),
});

// Step 2: Address validation (base schema)
const addressBaseSchema = z.object({
  fromPlz: z.string()
    .min(1, "PLZ ist erforderlich")
    .regex(plzRegex, "Ungültige PLZ (4 Ziffern)"),
  fromCity: z.string()
    .min(1, "Ort ist erforderlich")
    .max(100, "Ort ist zu lang"),
  fromStreet: z.string().max(200, "Strasse ist zu lang").optional(),
  fromHouseNumber: z.string().max(20, "Hausnummer ist zu lang").optional(),
  fromFloor: z.string().optional(),
  fromHasLift: z.boolean(),
  toPlz: z.string()
    .regex(plzRegex, "Ungültige PLZ (4 Ziffern)")
    .optional()
    .or(z.literal("")),
  toCity: z.string().max(100, "Ort ist zu lang").optional(),
  toStreet: z.string().max(200, "Strasse ist zu lang").optional(),
  toHouseNumber: z.string().max(20, "Hausnummer ist zu lang").optional(),
  toFloor: z.string().optional(),
  toHasLift: z.boolean(),
});

export const step2Schema = addressBaseSchema;

// Step 3: Umzug specific validation
export const step3UmzugSchema = z.object({
  rooms: z.string()
    .min(1, "Anzahl Zimmer ist erforderlich"),
  livingSpace: z.string()
    .min(1, "Wohnfläche ist erforderlich")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 10 && Number(val) <= 10000,
      "Wohnfläche muss zwischen 10 und 10'000 m² liegen"
    ),
  specialItems: z.array(z.string()).max(10, "Maximal 10 spezielle Gegenstände").optional(),
  packingServiceNeeded: z.boolean().optional(),
  cleaningServiceNeeded: z.boolean().optional(),
  storageNeeded: z.boolean().optional(),
});

// Step 3: Reinigung specific validation
// Field names must match the form data fields in LeadFormWizard.tsx
export const step3ReinigungSchema = z.object({
  rooms: z.string()
    .min(1, "Anzahl Zimmer ist erforderlich"),
  livingSpace: z.string()
    .min(1, "Wohnfläche ist erforderlich")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 10 && Number(val) <= 10000,
      "Wohnfläche muss zwischen 10 und 10'000 m² liegen"
    ),
  reinigungBathrooms: z.string()
    .min(1, "Anzahl Badezimmer ist erforderlich"),
  reinigungKitchen: z.boolean().optional(),
  reinigungWindows: z.boolean().optional(),
  reinigungBalcony: z.boolean().optional(),
});

// Step 3: Räumung specific validation
// Field names must match the form data fields in LeadFormWizard.tsx
export const step3RaeumungSchema = z.object({
  rooms: z.string()
    .min(1, "Anzahl Zimmer ist erforderlich"),
  livingSpace: z.string()
    .min(1, "Wohnfläche ist erforderlich")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 10 && Number(val) <= 10000,
      "Wohnfläche muss zwischen 10 und 10'000 m² liegen"
    ),
  raeumungType: z.string()
    .min(1, "Art der Räumung ist erforderlich"),
  raeumungVolume: z.string()
    .min(1, "Geschätztes Volumen ist erforderlich"),
  raeumungHasHeavyItems: z.boolean().optional(),
  raeumungNeedsDisposal: z.boolean().optional(),
});

// Step 3: Entsorgung specific validation
// Field names must match the form data fields in LeadFormWizard.tsx
export const step3EntsorgungSchema = z.object({
  entsorgungType: z.string()
    .min(1, "Art der Entsorgung ist erforderlich"),
  entsorgungVolume: z.string()
    .min(1, "Geschätztes Volumen ist erforderlich"),
  entsorgungItems: z.string()
    .min(10, "Bitte beschreiben Sie, was entsorgt werden soll (mind. 10 Zeichen)")
    .max(1000, "Beschreibung ist zu lang"),
});

// Step 3: Lagerung specific validation
// Field names must match the form data fields in LeadFormWizard.tsx
export const step3LagerungSchema = z.object({
  lagerungDuration: z.string()
    .min(1, "Lagerdauer ist erforderlich"),
  lagerungVolume: z.string()
    .min(1, "Geschätztes Volumen ist erforderlich"),
  lagerungAccessFrequency: z.string()
    .min(1, "Zugriffshäufigkeit ist erforderlich"),
  lagerungItems: z.string()
    .min(10, "Bitte beschreiben Sie, was eingelagert werden soll (mind. 10 Zeichen)")
    .max(1000, "Beschreibung ist zu lang"),
  lagerungClimateControlled: z.boolean().optional(),
});

// Step 3: Klaviertransport specific validation
export const step3KlaviertransportSchema = z.object({
  pianoType: z.enum(pianoTypes, {
    errorMap: () => ({ message: "Bitte wählen Sie einen Instrument-Typ aus." }),
  }),
  pianoBrand: z.string().max(100, "Marke ist zu lang").optional(),
  pianoWeightKg: z.string()
    .refine(
      (val) => val === "" || val === undefined || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 2000),
      "Gewicht muss zwischen 0 und 2000 kg liegen"
    )
    .optional(),
  staircaseType: z.enum(staircaseTypes, {
    errorMap: () => ({ message: "Bitte wählen Sie eine Treppenart aus." }),
  }),
  staircaseWidthCm: z.string()
    .refine(
      (val) => val === "" || val === undefined || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 500),
      "Treppenbreite muss zwischen 0 und 500 cm liegen"
    )
    .optional(),
  staircaseTurns: z.string()
    .refine(
      (val) => val === "" || val === undefined || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 20),
      "Anzahl Kurven muss zwischen 0 und 20 liegen"
    )
    .optional(),
  windowAccessPossible: z.boolean().optional(),
});

// Step 3: Möbellift specific validation
export const step3MoebelliftSchema = z.object({
  moebelliftFloor: z.string().min(1, "Stockwerk ist erforderlich"),
  moebelliftItemDescription: z.string().min(1, "Bitte beschreiben Sie, was transportiert werden soll"),
  moebelliftItemDimensions: z.string().max(100, "Masse sind zu lang").optional(),
});

// Step 3: Möbeltransport specific validation
export const step3MoebeltransportSchema = z.object({
  specialItems: z.array(z.string()).max(10, "Maximal 10 spezielle Gegenstände").optional(),
  itemsDescription: z.string().max(1000, "Beschreibung ist zu lang").optional(),
});

// Step 3: USM Transport specific validation
export const step3UsmTransportSchema = z.object({
  usmItemCount: z.string().min(1, "Anzahl der USM-Elemente ist erforderlich"),
  usmItemDescription: z.string()
    .min(10, "Bitte beschreiben Sie die USM-Möbel (mind. 10 Zeichen)")
    .max(1000, "Beschreibung ist zu lang"),
  usmNeedsAssembly: z.boolean().optional(),
  usmNeedsDisassembly: z.boolean().optional(),
});

// Step 3: Wasserbett Transport specific validation
export const step3WasserbettSchema = z.object({
  wasserbettSize: z.string().min(1, "Bettgrösse ist erforderlich"),
  wasserbettBrand: z.string().max(100, "Marke ist zu lang").optional(),
  wasserbettNeedsDraining: z.boolean().optional(),
  wasserbettNeedsRefilling: z.boolean().optional(),
  wasserbettHasHeater: z.boolean().optional(),
});

// Step 3: Malerarbeit specific validation
export const step3MalerarbeitSchema = z.object({
  malerarbeitType: z.string().min(1, "Art der Malerarbeit ist erforderlich"),
  malerarbeitRooms: z.string().min(1, "Anzahl Räume ist erforderlich"),
  malerarbeitArea: z.string()
    .min(1, "Fläche ist erforderlich")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 10000,
      "Fläche muss zwischen 1 und 10'000 m² liegen"
    ),
  malerarbeitDescription: z.string()
    .min(10, "Bitte beschreiben Sie die gewünschten Arbeiten (mind. 10 Zeichen)")
    .max(1000, "Beschreibung ist zu lang"),
  malerarbeitCeilings: z.boolean().optional(),
  malerarbeitWallpaper: z.boolean().optional(),
});

// Step 3: Standard/fallback validation
export const step3StandardSchema = z.object({
  rooms: z.string().optional(),
  livingSpace: z.string()
    .refine(
      (val) => val === "" || val === undefined || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 10000),
      "Wohnfläche muss zwischen 0 und 10'000 m² liegen"
    )
    .optional(),
  specialItems: z.array(z.string()).max(10, "Maximal 10 spezielle Gegenstände").optional(),
});

// Step 4: Timing validation
export const step4Schema = z.object({
  preferredDate: z.string().optional(),
  timeSlot: z.string().optional(),
  isFlexibleDate: z.boolean(),
  description: z.string()
    .max(2000, "Beschreibung ist zu lang (max. 2000 Zeichen)")
    .optional(),
});

// Step 5: Contact validation
export const step5Schema = z.object({
  firstName: z.string()
    .min(1, "Vorname ist erforderlich")
    .max(100, "Vorname ist zu lang")
    .regex(/^[a-zA-ZäöüÄÖÜéèêàâùûôîçÉÈÊÀÂÙÛÔÎÇß\s\-']+$/, "Vorname enthält ungültige Zeichen"),
  lastName: z.string()
    .min(1, "Nachname ist erforderlich")
    .max(100, "Nachname ist zu lang")
    .regex(/^[a-zA-ZäöüÄÖÜéèêàâùûôîçÉÈÊÀÂÙÛÔÎÇß\s\-']+$/, "Nachname enthält ungültige Zeichen"),
  email: z.string()
    .min(1, "E-Mail ist erforderlich")
    .email("Ungültige E-Mail-Adresse")
    .max(255, "E-Mail ist zu lang"),
  phone: z.string()
    .min(1, "Telefonnummer ist erforderlich")
    .regex(phoneRegex, "Ungültige Schweizer Telefonnummer (z.B. +41 79 123 45 67)"),
  maxCompanies: z.enum(["3", "5"]),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Sie müssen die AGB akzeptieren." }),
  }),
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: "Sie müssen die Datenschutzerklärung akzeptieren." }),
  }),
});

// Full form schema
export const leadFormSchema = step1Schema
  .merge(step2Schema)
  .merge(step3StandardSchema)
  .merge(step4Schema)
  .merge(step5Schema);

export type LeadFormData = z.infer<typeof leadFormSchema>;

// Helper to get service category
const getServiceCategory = (serviceType: string): string => {
  if (serviceType.startsWith("umzug_")) return "umzug";
  if (serviceType.startsWith("reinigung_")) return "reinigung";
  if (serviceType === "raeumung_wohnung") return "raeumung";
  if (serviceType === "transport_moebel") return "transport";
  if (serviceType === "klaviertransport") return "klaviertransport";
  if (serviceType === "moebellift") return "moebellift";
  if (serviceType === "lagerung") return "lagerung";
  if (serviceType === "entsorgung") return "entsorgung";
  if (serviceType === "malerarbeit") return "malerarbeit";
  if (serviceType === "usm_transport") return "usm_transport";
  if (serviceType === "wasserbett_transport") return "wasserbett_transport";
  return "standard";
};

// Validation helper for each step with service-specific logic
export const validateStep = (step: number, data: Record<string, unknown>) => {
  if (step === 3) {
    const serviceType = data.serviceType as string;
    const category = getServiceCategory(serviceType);
    let schema;
    
    switch (category) {
      case "umzug":
        schema = step3UmzugSchema;
        break;
      case "reinigung":
        schema = step3ReinigungSchema;
        break;
      case "raeumung":
        schema = step3RaeumungSchema;
        break;
      case "entsorgung":
        schema = step3EntsorgungSchema;
        break;
      case "lagerung":
        schema = step3LagerungSchema;
        break;
      case "klaviertransport":
        schema = step3KlaviertransportSchema;
        break;
      case "moebellift":
        schema = step3MoebelliftSchema;
        break;
      case "transport":
        schema = step3MoebeltransportSchema;
        break;
      case "malerarbeit":
        schema = step3MalerarbeitSchema;
        break;
      case "usm_transport":
        schema = step3UsmTransportSchema;
        break;
      case "wasserbett_transport":
        schema = step3WasserbettSchema;
        break;
      default:
        schema = step3StandardSchema;
    }
    
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, errors: {} };
    }
    
    const errors: Record<string, string> = {};
    result.error.errors.forEach((err) => {
      const path = err.path.join(".");
      errors[path] = err.message;
    });
    
    return { success: false, errors };
  }
  
  const schemas = [null, step1Schema, step2Schema, null, step4Schema, step5Schema];
  const schema = schemas[step];
  
  if (!schema) return { success: true, errors: {} };
  
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, errors: {} };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    errors[path] = err.message;
  });
  
  return { success: false, errors };
};
