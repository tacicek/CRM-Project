/**
 * Single source of truth for service type labels and normalization.
 * 
 * IMPORTANT: When adding a new service type, add it here ONLY.
 * All edge functions import from this module.
 * 
 * Previously duplicated in:
 * - match-lead/index.ts (2 copies!)
 * - notify-companies/index.ts
 * - accept-lead/index.ts
 * - vapi-webhook/index.ts
 * - n8n-lead-webhook/index.ts
 */

/**
 * Service type display labels (German) for UI, emails, and notifications.
 */
export const serviceDisplayLabels: Record<string, string> = {
  // Umzug variants
  umzug: "Umzug",
  umzug_privat: "Privatumzug",
  umzug_firma: "Firmenumzug",
  umzug_buero: "Büroumzug",
  umzug_international: "Internationaler Umzug",
  privatumzug: "Privatumzug",
  firmenumzug: "Firmenumzug",
  bueroumzug: "Büroumzug",
  seniorenumzug: "Seniorenumzug",
  studentenumzug: "Studentenumzug",
  // Reinigung variants
  reinigung: "Reinigung",
  reinigung_end: "Reinigungsanfrage",
  reinigung_grund: "Grundreinigung",
  reinigung_fenster: "Fensterreinigung",
  endreinigung: "Endreinigung",
  grundreinigung: "Grundreinigung",
  unterhaltsreinigung: "Unterhaltsreinigung",
  uebergabereinigung: "Übergabereinigung",
  baureinigung: "Baureinigung",
  buroreinigung: "Büroreinigung",
  // Räumung variants
  raeumung: "Räumung",
  raeumung_wohnung: "Wohnungsräumung",
  raeumung_haus: "Hausräumung",
  raeumung_keller: "Kellerräumung",
  raeumung_dachboden: "Dachbodenräumung",
  kellerraeumung: "Kellerräumung",
  wohnungsraeumung: "Wohnungsräumung",
  hausraeumung: "Hausräumung",
  estrichraeumung: "Estrichräumung",
  nachlassraeumung: "Nachlassräumung",
  messieraeumung: "Messie-Räumung",
  // Klaviertransport variants
  klaviertransport: "Klaviertransport",
  klaviertransport_transport: "Klaviertransport",
  klaviertransport_storage: "Klaviereinlagerung",
  klaviertransport_disposal: "Klavierentsorgung",
  klaviertransport_internal_move: "Klavierumstellung",
  // Other services
  entsorgung: "Entsorgung",
  entsorgung_moebel: "Möbelentsorgung",
  entsorgung_elektro: "Elektroentsorgung",
  entsorgung_sperrgut: "Sperrgutentsorgung",
  lagerung: "Lagerung",
  lagerung_einlagerung: "Einlagerung",
  lagerung_zwischenlagerung: "Zwischenlagerung",
  lagerung_selfstorage: "Self-Storage",
  moebellift: "Möbellift",
  moebellift_mieten: "Möbellift mieten",
  moebellift_service: "Möbellift-Service",
  moebeltransport: "Möbeltransport",
  transport_moebel: "Möbeltransport",
  // Spezialtransport
  spezialtransport: "Spezialtransport",
  // Renovation / Malerarbeiten
  renovation: "Renovation",
  malerarbeiten: "Malerarbeiten",
  malerarbeit: "Malerarbeiten",
};

/**
 * Get a human-readable label for a service type.
 * Falls back to converting snake_case to Title Case.
 */
export function getServiceDisplayLabel(type: string): string {
  if (serviceDisplayLabels[type.toLowerCase()]) {
    return serviceDisplayLabels[type.toLowerCase()];
  }
  // Fallback: convert snake_case to Title Case
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Normalize service type for company matching.
 * Maps specific service variants to their base category for matching with company_services.
 */
export function normalizeServiceTypeForMatching(serviceType: string): string {
  const mappings: Record<string, string> = {
    // REINIGUNG variants -> reinigung
    reinigung_end: "reinigung",
    reinigung_grund: "reinigung",
    reinigung_fenster: "reinigung",
    endreinigung: "reinigung",
    grundreinigung: "reinigung",
    unterhaltsreinigung: "reinigung",
    uebergabereinigung: "reinigung",
    baureinigung: "reinigung",
    buroreinigung: "reinigung",
    fensterreinigung: "reinigung",

    // UMZUG variants -> umzug
    umzug_privat: "umzug",
    umzug_firma: "umzug",
    umzug_buero: "umzug",
    umzug_international: "umzug",
    privatumzug: "umzug",
    firmenumzug: "umzug",
    bueroumzug: "umzug",
    seniorenumzug: "umzug",
    studentenumzug: "umzug",

    // RAEUMUNG variants -> raeumung
    raeumung_wohnung: "raeumung",
    raeumung_haus: "raeumung",
    raeumung_keller: "raeumung",
    raeumung_dachboden: "raeumung",
    raeumung_estrich: "raeumung",
    raeumung_buero: "raeumung",
    kellerraeumung: "raeumung",
    wohnungsraeumung: "raeumung",
    hausraeumung: "raeumung",
    estrichraeumung: "raeumung",
    nachlassraeumung: "raeumung",
    messieraeumung: "raeumung",

    // KLAVIERTRANSPORT variants -> klaviertransport
    klaviertransport_transport: "klaviertransport",
    klaviertransport_storage: "klaviertransport",
    klaviertransport_disposal: "klaviertransport",
    klaviertransport_internal_move: "klaviertransport",
    klaviertransport_tuning: "klaviertransport",
    fluegeltransport: "klaviertransport",
    piano_transport: "klaviertransport",

    // MOEBELLIFT variants -> moebellift
    moebellift_mieten: "moebellift",
    moebellift_service: "moebellift",
    moebellift_miete: "moebellift",
    aussenlift: "moebellift",
    moebelaufzug: "moebellift",

    // ENTSORGUNG variants -> entsorgung
    entsorgung_moebel: "entsorgung",
    entsorgung_elektro: "entsorgung",
    entsorgung_sperrgut: "entsorgung",
    entsorgung_bauschutt: "entsorgung",
    moebelentsorgung: "entsorgung",
    sperrmuell: "entsorgung",
    elektroentsorgung: "entsorgung",

    // LAGERUNG variants -> lagerung
    lagerung_kurz: "lagerung",
    lagerung_lang: "lagerung",
    einlagerung: "lagerung",
    zwischenlagerung: "lagerung",
    moebeleinlagerung: "lagerung",
    selfstorage: "lagerung",

    // RENOVATION / MALERARBEITEN variants
    renovation: "renovation",
    malerarbeiten: "malerarbeiten",
    malerarbeit: "malerarbeiten",
    maler: "malerarbeiten",
    anstrich: "malerarbeiten",
    tapezieren: "malerarbeiten",
    renovierung: "renovation",
    sanierung: "renovation",

    // MOEBELTRANSPORT variants -> moebeltransport
    transport_moebel: "moebeltransport",
    usm_transport: "moebeltransport",
    wasserbett_transport: "moebeltransport",
    einzeltransport: "moebeltransport",
    schwertransport: "moebeltransport",
    kunsttransport: "moebeltransport",

    // SPEZIALTRANSPORT — stays as-is (own service category)
    // Companies must have spezialtransport in their company_services
  };

  return mappings[serviceType.toLowerCase()] || serviceType;
}
