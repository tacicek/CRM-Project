/**
 * Centralized service type labels for consistent display across the app
 */

export const SERVICE_LABELS: Record<string, string> = {
  // Umzug
  umzug: "Umzug",
  umzug_privat: "Privatumzug",
  umzug_firma: "Firmenumzug",
  umzug_international: "Internationaler Umzug",
  
  // Transport
  transport: "Transport",
  transport_moebel: "Möbeltransport",
  transport_klavier: "Klaviertransport",
  klaviertransport: "Klaviertransport",
  moebellift: "Möbellift",
  
  // Reinigung
  reinigung: "Reinigung",
  reinigung_end: "Reinigungsanfrage",
  reinigung_grund: "Grundreinigung",
  reinigung_fenster: "Fensterreinigung",
  
  // Räumung
  raeumung: "Räumung",
  raeumung_wohnung: "Wohnungsräumung",
  raeumung_haus: "Hausräumung",
  
  // Entsorgung
  entsorgung: "Entsorgung",
  
  // Lagerung
  lagerung: "Lagerung",
  
  // Renovation / Malerarbeit
  renovation: "Renovation",
  malerarbeiten: "Malerarbeiten",
  malerarbeit: "Malerarbeit",
  
  // Spezialtransporte
  spezialtransport: "Spezialtransport",
  usm_transport: "USM Transport",
  wasserbett_transport: "Wasserbett Transport",
};

/**
 * Get a human-readable label for a service type
 * @param serviceType - The service type key (e.g., "umzug_privat")
 * @returns The German label (e.g., "Privatumzug")
 */
export const getServiceLabel = (serviceType: string): string => {
  return SERVICE_LABELS[serviceType] || formatServiceType(serviceType);
};

/**
 * Fallback formatter for unknown service types
 * Converts snake_case to Title Case
 */
const formatServiceType = (serviceType: string): string => {
  return serviceType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Service options for forms and selects
 */
export const SERVICE_OPTIONS = [
  { value: "umzug_privat", label: "Privatumzug" },
  { value: "umzug_firma", label: "Firmenumzug" },
  { value: "umzug_international", label: "Internationaler Umzug" },
  { value: "reinigung_end", label: "Reinigungsanfrage" },
  { value: "reinigung_grund", label: "Grundreinigung" },
  { value: "reinigung_fenster", label: "Fensterreinigung" },
  { value: "raeumung_wohnung", label: "Wohnungsräumung" },
  { value: "raeumung_haus", label: "Hausräumung" },
  { value: "transport_moebel", label: "Möbeltransport" },
  { value: "klaviertransport", label: "Klaviertransport" },
  { value: "moebellift", label: "Möbellift" },
  { value: "spezialtransport", label: "Spezialtransport" },
  { value: "usm_transport", label: "USM Transport" },
  { value: "wasserbett_transport", label: "Wasserbett Transport" },
  { value: "entsorgung", label: "Entsorgung" },
  { value: "lagerung", label: "Lagerung" },
  { value: "malerarbeit", label: "Malerarbeit" },
];

/**
 * Service categories for grouped displays
 */
export const SERVICE_CATEGORIES = [
  { 
    id: "umzug", 
    label: "Umzug", 
    description: "Privat- und Firmenumzüge",
    services: [
      { id: "umzug_privat", label: "Privatumzug" },
      { id: "umzug_firma", label: "Firmenumzug" },
      { id: "umzug_international", label: "Internationaler Umzug" },
    ]
  },
  { 
    id: "reinigung", 
    label: "Reinigung", 
    description: "End- und Grundreinigung",
    services: [
      { id: "reinigung_end", label: "Reinigungsanfrage" },
      { id: "reinigung_grund", label: "Grundreinigung" },
      { id: "reinigung_fenster", label: "Fensterreinigung" },
    ]
  },
  { 
    id: "raeumung", 
    label: "Räumung", 
    description: "Wohnungs- und Hausräumung",
    services: [
      { id: "raeumung_wohnung", label: "Wohnungsräumung" },
      { id: "raeumung_haus", label: "Hausräumung" },
    ]
  },
  { 
    id: "transport", 
    label: "Transport", 
    description: "Möbel- und Spezialtransporte",
    services: [
      { id: "transport_moebel", label: "Möbeltransport" },
      { id: "klaviertransport", label: "Klaviertransport" },
      { id: "moebellift", label: "Möbellift" },
      { id: "usm_transport", label: "USM Transport" },
      { id: "wasserbett_transport", label: "Wasserbett Transport" },
    ]
  },
  { 
    id: "lagerung", 
    label: "Lagerung", 
    description: "Möbel- und Lagerlösungen",
    services: [
      { id: "lagerung", label: "Lagerung" },
    ]
  },
  { 
    id: "entsorgung", 
    label: "Entsorgung", 
    description: "Entrümpelung und Entsorgung",
    services: [
      { id: "entsorgung", label: "Entsorgung" },
    ]
  },
  { 
    id: "malerarbeit", 
    label: "Malerarbeit", 
    description: "Maler- und Renovationsarbeiten",
    services: [
      { id: "malerarbeit", label: "Malerarbeit" },
    ]
  },
];

