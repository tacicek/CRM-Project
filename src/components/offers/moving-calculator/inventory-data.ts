// inventory-data.ts - Swiss Moving Inventory Categories and Default Pricing

import { InventoryCategory, PricingConfig, PricingTemplate, TeamRate } from './types';

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  {
    id: 'boxes',
    name_de: 'Kartons',
    items: [
      { id: 'box_std', name_de: 'Umzugskarton (Standard 60L)', volume_m3: 0.1, assembly_time_minutes: 0 },
      { id: 'box_book', name_de: 'Bücherkarton (Klein/Schwer)', volume_m3: 0.06, assembly_time_minutes: 0 },
      { id: 'box_clothes', name_de: 'Kleiderbox (Hängend)', volume_m3: 0.3, assembly_time_minutes: 2 },
      { id: 'suitcase', name_de: 'Koffer / Reisetasche', volume_m3: 0.1, assembly_time_minutes: 0 },
    ],
  },
  {
    id: 'living_room',
    name_de: 'Wohnzimmer',
    items: [
      { id: 'sofa_3', name_de: 'Sofa (3-Sitzer)', volume_m3: 2.5, assembly_time_minutes: 10 },
      { id: 'sofa_2', name_de: 'Sofa (2-Sitzer)', volume_m3: 2.0, assembly_time_minutes: 5 },
      { id: 'sofa_corner', name_de: 'Ecksofa (L-Form)', volume_m3: 3.5, assembly_time_minutes: 20 },
      { id: 'armchair', name_de: 'Sessel', volume_m3: 0.8, assembly_time_minutes: 0 },
      { id: 'coffee_table', name_de: 'Couchtisch', volume_m3: 0.3, assembly_time_minutes: 0 },
      { id: 'tv_stand', name_de: 'TV-Möbel / Lowboard', volume_m3: 0.5, assembly_time_minutes: 0 },
      { id: 'bookshelf', name_de: 'Bücherregal (pro lfd. Meter)', volume_m3: 0.4, assembly_time_minutes: 15 },
      { id: 'display_cabinet', name_de: 'Vitrine', volume_m3: 0.8, assembly_time_minutes: 20 },
      { id: 'floor_lamp', name_de: 'Stehlampe', volume_m3: 0.2, assembly_time_minutes: 0 },
      { id: 'carpet_small', name_de: 'Teppich (klein)', volume_m3: 0.1, assembly_time_minutes: 0 },
      { id: 'carpet_large', name_de: 'Teppich (gross)', volume_m3: 0.3, assembly_time_minutes: 0 },
    ],
  },
  {
    id: 'bedroom',
    name_de: 'Schlafzimmer',
    items: [
      { id: 'bed_double', name_de: 'Doppelbett (inkl. Matratze)', volume_m3: 2.2, assembly_time_minutes: 30 },
      { id: 'bed_single', name_de: 'Einzelbett', volume_m3: 1.2, assembly_time_minutes: 15 },
      { id: 'bed_boxspring', name_de: 'Boxspringbett', volume_m3: 3.0, assembly_time_minutes: 45 },
      { id: 'wardrobe_1m', name_de: 'Kleiderschrank (1-türig / ca. 50-60cm)', volume_m3: 0.8, assembly_time_minutes: 20 },
      { id: 'wardrobe_2m', name_de: 'Kleiderschrank (2-türig / ca. 100cm)', volume_m3: 1.5, assembly_time_minutes: 40 },
      { id: 'wardrobe_3m', name_de: 'Kleiderschrank (3-türig / ca. 150cm)', volume_m3: 2.3, assembly_time_minutes: 60 },
      { id: 'wardrobe_pax', name_de: 'PAX Schrank (IKEA) pro Modul', volume_m3: 0.6, assembly_time_minutes: 30 },
      { id: 'nightstand', name_de: 'Nachttisch', volume_m3: 0.15, assembly_time_minutes: 0 },
      { id: 'dresser', name_de: 'Kommode', volume_m3: 0.5, assembly_time_minutes: 10 },
      { id: 'mirror_large', name_de: 'Standspiegel', volume_m3: 0.2, assembly_time_minutes: 0 },
    ],
  },
  {
    id: 'dining',
    name_de: 'Esszimmer',
    items: [
      { id: 'dining_table_4', name_de: 'Esstisch (4 Personen)', volume_m3: 1.2, assembly_time_minutes: 15 },
      { id: 'dining_table_6', name_de: 'Esstisch (6 Personen)', volume_m3: 1.8, assembly_time_minutes: 20 },
      { id: 'dining_table_8', name_de: 'Esstisch (8+ Personen)', volume_m3: 2.5, assembly_time_minutes: 25 },
      { id: 'chair', name_de: 'Stuhl', volume_m3: 0.25, assembly_time_minutes: 0 },
      { id: 'bench', name_de: 'Sitzbank', volume_m3: 0.5, assembly_time_minutes: 0 },
      { id: 'sideboard', name_de: 'Buffet / Sideboard', volume_m3: 1.0, assembly_time_minutes: 15 },
      { id: 'bar_cabinet', name_de: 'Barschrank', volume_m3: 0.6, assembly_time_minutes: 10 },
    ],
  },
  {
    id: 'kitchen',
    name_de: 'Küche',
    items: [
      { id: 'fridge_small', name_de: 'Kühlschrank (klein)', volume_m3: 0.3, assembly_time_minutes: 5 },
      { id: 'fridge_large', name_de: 'Kühlschrank (gross / Side-by-Side)', volume_m3: 0.8, assembly_time_minutes: 10 },
      { id: 'freezer', name_de: 'Gefrierschrank', volume_m3: 0.5, assembly_time_minutes: 5 },
      { id: 'dishwasher', name_de: 'Geschirrspüler', volume_m3: 0.4, assembly_time_minutes: 15 },
      { id: 'microwave', name_de: 'Mikrowelle', volume_m3: 0.1, assembly_time_minutes: 0 },
      { id: 'kitchen_table', name_de: 'Küchentisch', volume_m3: 0.5, assembly_time_minutes: 10 },
      { id: 'kitchen_cabinet', name_de: 'Küchenschrank (freistehend)', volume_m3: 0.6, assembly_time_minutes: 15 },
    ],
  },
  {
    id: 'office',
    name_de: 'Büro',
    items: [
      { id: 'desk_small', name_de: 'Schreibtisch (klein)', volume_m3: 0.6, assembly_time_minutes: 10 },
      { id: 'desk_large', name_de: 'Schreibtisch (gross / L-Form)', volume_m3: 1.2, assembly_time_minutes: 20 },
      { id: 'desk_standing', name_de: 'Stehpult / Höhenverstellbar', volume_m3: 0.8, assembly_time_minutes: 25 },
      { id: 'office_chair', name_de: 'Bürostuhl (Drehstuhl)', volume_m3: 0.4, assembly_time_minutes: 0 },
      { id: 'file_cabinet', name_de: 'Aktenschrank', volume_m3: 0.6, assembly_time_minutes: 0 },
      { id: 'bookshelf_office', name_de: 'Regal (Büro)', volume_m3: 0.5, assembly_time_minutes: 15 },
      { id: 'printer', name_de: 'Drucker / Scanner', volume_m3: 0.15, assembly_time_minutes: 0 },
      { id: 'computer', name_de: 'Computer / Monitor', volume_m3: 0.2, assembly_time_minutes: 5 },
    ],
  },
  {
    id: 'bathroom',
    name_de: 'Bad & Waschraum',
    items: [
      { id: 'washing_machine', name_de: 'Waschmaschine', volume_m3: 0.5, assembly_time_minutes: 15 },
      { id: 'dryer', name_de: 'Tumbler (Wäschetrockner)', volume_m3: 0.5, assembly_time_minutes: 10 },
      { id: 'washer_dryer', name_de: 'Waschturm (Kombi)', volume_m3: 1.0, assembly_time_minutes: 20 },
      { id: 'bathroom_cabinet', name_de: 'Badezimmerschrank', volume_m3: 0.3, assembly_time_minutes: 10 },
      { id: 'mirror_bathroom', name_de: 'Badezimmerspiegel', volume_m3: 0.1, assembly_time_minutes: 5 },
    ],
  },
  {
    id: 'children',
    name_de: 'Kinderzimmer',
    items: [
      { id: 'bed_child', name_de: 'Kinderbett', volume_m3: 0.8, assembly_time_minutes: 20 },
      { id: 'bed_bunk', name_de: 'Etagenbett', volume_m3: 1.5, assembly_time_minutes: 45 },
      { id: 'bed_baby', name_de: 'Babybett / Gitterbett', volume_m3: 0.5, assembly_time_minutes: 15 },
      { id: 'wardrobe_child', name_de: 'Kinderschrank', volume_m3: 1.0, assembly_time_minutes: 30 },
      { id: 'desk_child', name_de: 'Kinderschreibtisch', volume_m3: 0.5, assembly_time_minutes: 15 },
      { id: 'toy_box', name_de: 'Spielzeugkiste', volume_m3: 0.2, assembly_time_minutes: 0 },
      { id: 'changing_table', name_de: 'Wickeltisch', volume_m3: 0.5, assembly_time_minutes: 15 },
      { id: 'stroller', name_de: 'Kinderwagen', volume_m3: 0.3, assembly_time_minutes: 0 },
    ],
  },
  {
    id: 'electronics',
    name_de: 'Elektrogeräte',
    items: [
      { id: 'tv_small', name_de: 'Fernseher (bis 42")', volume_m3: 0.15, assembly_time_minutes: 5 },
      { id: 'tv_large', name_de: 'Fernseher (43-65")', volume_m3: 0.25, assembly_time_minutes: 10 },
      { id: 'tv_xl', name_de: 'Fernseher (65"+)', volume_m3: 0.4, assembly_time_minutes: 15 },
      { id: 'stereo', name_de: 'Stereoanlage / HiFi', volume_m3: 0.2, assembly_time_minutes: 5 },
      { id: 'speaker', name_de: 'Lautsprecher (Paar)', volume_m3: 0.15, assembly_time_minutes: 0 },
      { id: 'game_console', name_de: 'Spielkonsole', volume_m3: 0.05, assembly_time_minutes: 0 },
      { id: 'vacuum', name_de: 'Staubsauger', volume_m3: 0.1, assembly_time_minutes: 0 },
      { id: 'air_conditioner', name_de: 'Klimagerät (mobil)', volume_m3: 0.3, assembly_time_minutes: 0 },
    ],
  },
  {
    id: 'outdoor',
    name_de: 'Garten & Balkon',
    items: [
      { id: 'garden_table', name_de: 'Gartentisch', volume_m3: 0.8, assembly_time_minutes: 10 },
      { id: 'garden_chair', name_de: 'Gartenstuhl', volume_m3: 0.2, assembly_time_minutes: 0 },
      { id: 'garden_bench', name_de: 'Gartenbank', volume_m3: 0.4, assembly_time_minutes: 0 },
      { id: 'lounger', name_de: 'Sonnenliege', volume_m3: 0.5, assembly_time_minutes: 0 },
      { id: 'parasol', name_de: 'Sonnenschirm', volume_m3: 0.3, assembly_time_minutes: 5 },
      { id: 'grill', name_de: 'Grill (Gas/Kohle)', volume_m3: 0.4, assembly_time_minutes: 10 },
      { id: 'plant_pot_large', name_de: 'Pflanzentopf (gross)', volume_m3: 0.2, assembly_time_minutes: 0 },
      { id: 'lawnmower', name_de: 'Rasenmäher', volume_m3: 0.3, assembly_time_minutes: 0 },
    ],
  },
  {
    id: 'sports',
    name_de: 'Sport & Hobby',
    items: [
      { id: 'bike', name_de: 'Fahrrad', volume_m3: 0.5, assembly_time_minutes: 5 },
      { id: 'ebike', name_de: 'E-Bike', volume_m3: 0.5, assembly_time_minutes: 5 },
      { id: 'bike_child', name_de: 'Kinderfahrrad', volume_m3: 0.3, assembly_time_minutes: 0 },
      { id: 'ski_set', name_de: 'Ski-Set (Paar)', volume_m3: 0.15, assembly_time_minutes: 0 },
      { id: 'snowboard', name_de: 'Snowboard', volume_m3: 0.1, assembly_time_minutes: 0 },
      { id: 'golf_bag', name_de: 'Golfbag', volume_m3: 0.15, assembly_time_minutes: 0 },
      { id: 'fitness_bench', name_de: 'Hantelbank', volume_m3: 0.5, assembly_time_minutes: 20 },
      { id: 'treadmill', name_de: 'Laufband', volume_m3: 0.8, assembly_time_minutes: 30 },
      { id: 'home_trainer', name_de: 'Heimtrainer / Crosstrainer', volume_m3: 0.6, assembly_time_minutes: 20 },
    ],
  },
  {
    id: 'special',
    name_de: 'Spezielles',
    items: [
      { id: 'piano_upright', name_de: 'Klavier (Pianino)', volume_m3: 1.5, assembly_time_minutes: 0 },
      { id: 'piano_grand', name_de: 'Flügel', volume_m3: 3.0, assembly_time_minutes: 0 },
      { id: 'safe_small', name_de: 'Tresor (klein)', volume_m3: 0.2, assembly_time_minutes: 0 },
      { id: 'safe_large', name_de: 'Tresor (gross)', volume_m3: 0.5, assembly_time_minutes: 0 },
      { id: 'aquarium', name_de: 'Aquarium', volume_m3: 0.3, assembly_time_minutes: 30 },
      { id: 'art_frame_large', name_de: 'Bild / Kunstwerk (gross)', volume_m3: 0.2, assembly_time_minutes: 10 },
      { id: 'wine_fridge', name_de: 'Weinkühlschrank', volume_m3: 0.4, assembly_time_minutes: 5 },
      { id: 'pool_table', name_de: 'Billardtisch', volume_m3: 2.5, assembly_time_minutes: 90 },
      { id: 'massage_chair', name_de: 'Massagesessel', volume_m3: 1.0, assembly_time_minutes: 15 },
    ],
  },
  {
    id: 'storage',
    name_de: 'Lager & Keller',
    items: [
      { id: 'shelf_metal', name_de: 'Metallregal', volume_m3: 0.5, assembly_time_minutes: 15 },
      { id: 'storage_box', name_de: 'Aufbewahrungsbox', volume_m3: 0.1, assembly_time_minutes: 0 },
      { id: 'tool_cabinet', name_de: 'Werkzeugschrank', volume_m3: 0.6, assembly_time_minutes: 20 },
      { id: 'workbench', name_de: 'Werkbank', volume_m3: 0.8, assembly_time_minutes: 30 },
      { id: 'ladder', name_de: 'Leiter', volume_m3: 0.2, assembly_time_minutes: 0 },
      { id: 'tires', name_de: 'Autoreifen (4 Stück)', volume_m3: 0.4, assembly_time_minutes: 0 },
    ],
  },
];

// =============================================================================
// SWISS MARKET PRICING TEMPLATES
// Based on Delta Umzug and Swiss moving industry standards
// =============================================================================

/**
 * Delta Umzug Reference Pricing (Swiss Market Standard)
 * Source: https://www.delta-umzug.ch/preise/
 * 
 * Team-based pricing where truck + workers are billed together:
 * - 1 LKW + 1 Helfer: 120 CHF/Std
 * - 1 LKW + 2 Helfer: 180 CHF/Std
 * - 1 LKW + 3 Helfer: 230 CHF/Std
 * - 2 LKW + 4 Helfer: 290 CHF/Std
 * - 2 LKW + 5 Helfer: 350 CHF/Std
 * - 2 LKW + 6 Helfer: 420 CHF/Std
 */

// Default pricing config - Swiss market standard (Delta Umzug style)
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  // Basic settings
  currency: 'CHF',
  vatRate: 8.1, // Swiss MwSt.
  minimumHours: 4, // Minimum 4 hours billable
  minimumCharge: 480, // Minimum CHF 480 (4h × 120 CHF smallest team)
  
  // Team-based pricing (PRIMARY - use this for calculations)
  // This matches Delta Umzug pricing structure
  teamRates: [
    { trucks: 1, workers: 1, hourlyRate: 120, label: '1 LKW + 1 Helfer' },
    { trucks: 1, workers: 2, hourlyRate: 180, label: '1 LKW + 2 Helfer' },
    { trucks: 1, workers: 3, hourlyRate: 230, label: '1 LKW + 3 Helfer' },
    { trucks: 2, workers: 4, hourlyRate: 290, label: '2 LKW + 4 Helfer' },
    { trucks: 2, workers: 5, hourlyRate: 350, label: '2 LKW + 5 Helfer' },
    { trucks: 2, workers: 6, hourlyRate: 420, label: '2 LKW + 6 Helfer' },
  ],
  
  // Legacy per-person pricing (DEPRECATED - kept for backward compatibility)
  // DO NOT USE for new calculations - use teamRates instead
  hourlyRate: 60, // Per person rate (used only if teamRates not applicable)
  vehiclePrices: {
    transporter: 80, // Per day
    truck_3_5t: 120,
    truck_7_5t: 180,
    truck_18t: 250,
  },
  
  // Distance pricing
  distanceSurchargeRate: 2.50, // CHF per km over threshold
  distanceSurchargeThreshold: 20, // km before surcharge applies
  
  // Surcharges for special items
  surcharges: {
    heavyItemOver100kg: 50, // Per item over 100kg
    pianoUpright: 350, // Klavier
    pianoGrand: 650, // Flügel
    safeSmall: 150, // Tresor klein (<100kg)
    safeLarge: 350, // Tresor gross (>100kg)
    aquarium: 200, // Aquarium
    poolTable: 450, // Billardtisch
  },
  
  // Floor-based surcharges
  floorSurcharges: {
    perFloorWithoutElevator: 30, // CHF per floor without elevator
    perFloorWithElevator: 10, // CHF per floor with elevator
    groundFloorBase: 0, // No surcharge for ground floor
  },
  
  // Equipment rental costs
  equipment: {
    moebelliftSingleLocation: 350, // One location only
    moebelliftBothLocations: 550, // Load + unload locations
    packingMaterialPerM3: 25, // Packing materials per m³
  },
  
  // Extra services
  packingServiceRate: 45, // CHF per m³ for packing service
  externalLiftCost: 550, // Flat rate for external lift (same as equipment)
  disposalCost: 35, // Per m³ for disposal
  pianoTransportCost: 350, // Legacy flat rate (use surcharges instead)
  storageCostPerM3: 45, // CHF per m³ per month
  
  // Time-based multipliers
  multipliers: {
    weekend: 1.25, // 25% increase on weekends
    evening: 1.15, // 15% increase after 18:00
    holiday: 1.50, // 50% increase on holidays
    express: 1.30, // 30% increase for same-day/next-day
  },
};

// =============================================================================
// PRICING TEMPLATES
// Companies can choose from these templates or customize their own
// =============================================================================

export const PRICING_TEMPLATES: PricingTemplate[] = [
  {
    id: 'swiss_standard',
    name: 'Schweizer Standard',
    description: 'Marktübliche Preise basierend auf Delta Umzug (120-420 CHF/Std)',
    isMarketStandard: true,
    config: DEFAULT_PRICING_CONFIG,
  },
  {
    id: 'budget_friendly',
    name: 'Budget-freundlich',
    description: 'Günstigere Preise für preisbewusste Kunden (100-350 CHF/Std)',
    config: {
      ...DEFAULT_PRICING_CONFIG,
      minimumHours: 3,
      minimumCharge: 300,
      teamRates: [
        { trucks: 1, workers: 1, hourlyRate: 100, label: '1 LKW + 1 Helfer' },
        { trucks: 1, workers: 2, hourlyRate: 150, label: '1 LKW + 2 Helfer' },
        { trucks: 1, workers: 3, hourlyRate: 195, label: '1 LKW + 3 Helfer' },
        { trucks: 2, workers: 4, hourlyRate: 245, label: '2 LKW + 4 Helfer' },
        { trucks: 2, workers: 5, hourlyRate: 295, label: '2 LKW + 5 Helfer' },
        { trucks: 2, workers: 6, hourlyRate: 350, label: '2 LKW + 6 Helfer' },
      ],
    },
  },
  {
    id: 'premium_service',
    name: 'Premium Service',
    description: 'Höhere Preise für Premium-Qualität und -Service (150-500 CHF/Std)',
    config: {
      ...DEFAULT_PRICING_CONFIG,
      minimumHours: 4,
      minimumCharge: 600,
      teamRates: [
        { trucks: 1, workers: 1, hourlyRate: 150, label: '1 LKW + 1 Helfer' },
        { trucks: 1, workers: 2, hourlyRate: 220, label: '1 LKW + 2 Helfer' },
        { trucks: 1, workers: 3, hourlyRate: 285, label: '1 LKW + 3 Helfer' },
        { trucks: 2, workers: 4, hourlyRate: 360, label: '2 LKW + 4 Helfer' },
        { trucks: 2, workers: 5, hourlyRate: 430, label: '2 LKW + 5 Helfer' },
        { trucks: 2, workers: 6, hourlyRate: 500, label: '2 LKW + 6 Helfer' },
      ],
      surcharges: {
        ...DEFAULT_PRICING_CONFIG.surcharges,
        pianoUpright: 450,
        pianoGrand: 800,
      },
    },
  },
];

/**
 * Get team rate based on recommended crew and vehicle
 * Finds the best matching team configuration
 */
export function getTeamRate(
  config: PricingConfig,
  recommendedCrew: number,
  truckCount: number = 1
): { rate: TeamRate; hourlyRate: number } {
  const { teamRates } = config;
  
  // Sort by workers descending to find the best match
  const sortedRates = [...teamRates].sort((a, b) => b.workers - a.workers);
  
  // Find exact match first
  let match = sortedRates.find(r => r.workers === recommendedCrew && r.trucks >= truckCount);
  
  // If no exact match, find the closest team with enough workers
  if (!match) {
    match = sortedRates.find(r => r.workers >= recommendedCrew);
  }
  
  // If still no match, use the largest team
  if (!match) {
    match = sortedRates[0];
  }
  
  return {
    rate: match,
    hourlyRate: match.hourlyRate,
  };
}

/**
 * Calculate effective hourly rate for a specific crew size
 * This derives the per-hour rate from team rates for display purposes
 */
export function calculateEffectiveHourlyRate(
  config: PricingConfig,
  workers: number,
  trucks: number = 1
): number {
  const { rate } = getTeamRate(config, workers, trucks);
  return rate.hourlyRate;
}

/**
 * Validate pricing configuration
 * Returns array of warnings/errors
 * 
 * Checks for:
 * - Minimum hours configuration
 * - Team rates within market range (Delta Umzug: 120-420 CHF/hour)
 * - Negative prices
 * - VAT rate validity
 * - Multipliers reasonableness
 * - Minimum charge alignment
 */
export function validatePricingConfig(config: PricingConfig): { 
  isValid: boolean; 
  warnings: string[]; 
  errors: string[] 
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // ===== CRITICAL ERRORS =====
  
  // Check team rates exist
  if (!config.teamRates || config.teamRates.length === 0) {
    errors.push('Mindestens ein Team-Tarif muss definiert sein');
  } else {
    // Check for negative prices
    const negativeRates = config.teamRates.filter(r => r.hourlyRate < 0);
    if (negativeRates.length > 0) {
      errors.push('Team-Stundenpreise dürfen nicht negativ sein');
    }
    
    // Check for zero prices
    const zeroRates = config.teamRates.filter(r => r.hourlyRate === 0);
    if (zeroRates.length > 0) {
      errors.push('Team-Stundenpreise dürfen nicht 0 sein');
    }
    
    // Check for invalid worker/truck counts
    const invalidTeams = config.teamRates.filter(r => r.workers < 1 || r.trucks < 1);
    if (invalidTeams.length > 0) {
      errors.push('Teams müssen mindestens 1 LKW und 1 Helfer haben');
    }
  }
  
  // Check minimum charge is not negative
  if (config.minimumCharge < 0) {
    errors.push('Mindestbetrag darf nicht negativ sein');
  }
  
  // ===== WARNINGS =====
  
  // Check minimum hours
  if (config.minimumHours < 2) {
    warnings.push('Minimale Stunden unter 2 ist ungewöhnlich tief');
  }
  if (config.minimumHours > 8) {
    warnings.push('Minimale Stunden über 8 könnte Kunden abschrecken');
  }
  
  // Check team rates against market standards
  if (config.teamRates && config.teamRates.length > 0) {
    const smallestRate = Math.min(...config.teamRates.map(r => r.hourlyRate));
    const largestRate = Math.max(...config.teamRates.map(r => r.hourlyRate));
    
    // Delta Umzug market reference: 120-420 CHF/hour
    if (smallestRate < 80) {
      warnings.push(`Niedrigster Stundenpreis (${smallestRate} CHF) ist deutlich unter Marktstandard (120 CHF) - Könnte nicht kostendeckend sein`);
    }
    if (smallestRate > 180) {
      warnings.push(`Niedrigster Stundenpreis (${smallestRate} CHF) ist über Marktstandard (120 CHF) - Könnte Kunden verlieren`);
    }
    if (largestRate < 300) {
      warnings.push(`Höchster Stundenpreis (${largestRate} CHF) ist unter Marktstandard (420 CHF)`);
    }
    if (largestRate > 600) {
      warnings.push(`Höchster Stundenpreis (${largestRate} CHF) ist deutlich über Marktstandard (420 CHF) - Könnte zu teuer sein`);
    }
    
    // Check rate progression (should increase with team size)
    const sortedRates = [...config.teamRates].sort((a, b) => a.workers - b.workers);
    for (let i = 1; i < sortedRates.length; i++) {
      if (sortedRates[i].hourlyRate < sortedRates[i - 1].hourlyRate) {
        warnings.push(`Team mit ${sortedRates[i].workers} Helfern ist günstiger als Team mit ${sortedRates[i - 1].workers} Helfern - Ungewöhnlich`);
      }
    }
  }
  
  // Check minimum charge alignment with team rates
  if (config.teamRates && config.teamRates.length > 0 && config.minimumCharge > 0) {
    const smallestTeamMinimum = config.teamRates[0]?.hourlyRate * (config.minimumHours || 4);
    if (config.minimumCharge > smallestTeamMinimum * 1.5) {
      warnings.push(`Mindestbetrag (${config.minimumCharge} CHF) ist deutlich höher als kleinster Team-Tarif × Mindeststunden (${smallestTeamMinimum} CHF)`);
    }
  }
  
  // Check VAT rate
  if (config.vatRate !== 8.1 && config.vatRate !== 7.7) {
    warnings.push(`MwSt.-Satz (${config.vatRate}%) entspricht nicht dem Schweizer Satz (8.1% oder 7.7%)`);
  }
  
  // Check multipliers are reasonable
  if (config.multipliers) {
    if (config.multipliers.weekend && (config.multipliers.weekend < 1 || config.multipliers.weekend > 2)) {
      warnings.push(`Wochenend-Multiplikator (${config.multipliers.weekend}x) sollte zwischen 1.0x und 2.0x liegen`);
    }
    if (config.multipliers.evening && (config.multipliers.evening < 1 || config.multipliers.evening > 1.5)) {
      warnings.push(`Abend-Multiplikator (${config.multipliers.evening}x) sollte zwischen 1.0x und 1.5x liegen`);
    }
    if (config.multipliers.holiday && (config.multipliers.holiday < 1 || config.multipliers.holiday > 2.5)) {
      warnings.push(`Feiertag-Multiplikator (${config.multipliers.holiday}x) sollte zwischen 1.0x und 2.5x liegen`);
    }
  }
  
  // Check surcharges are reasonable
  if (config.surcharges) {
    if (config.surcharges.pianoUpright > 800) {
      warnings.push(`Klavier-Zuschlag (${config.surcharges.pianoUpright} CHF) ist sehr hoch`);
    }
    if (config.surcharges.heavyItemOver100kg > 150) {
      warnings.push(`Schwerlast-Zuschlag (${config.surcharges.heavyItemOver100kg} CHF) ist sehr hoch`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Market comparison helper
 * Returns how the config compares to market standards
 */
export function compareToMarketStandard(config: PricingConfig): {
  smallTeamComparison: { yours: number; market: number; diff: number; diffPercent: number };
  largeTeamComparison: { yours: number; market: number; diff: number; diffPercent: number };
  isWithinMarketRange: boolean;
} {
  const MARKET_SMALL_TEAM = 180; // 1 LKW + 2 Helfer
  const MARKET_LARGE_TEAM = 350; // 2 LKW + 5 Helfer
  
  const smallTeamRate = config.teamRates.find(r => r.workers === 2)?.hourlyRate || 
                        config.teamRates[1]?.hourlyRate || 
                        config.hourlyRate * 2;
  
  const largeTeamRate = config.teamRates.find(r => r.workers === 5)?.hourlyRate || 
                        config.teamRates[config.teamRates.length - 2]?.hourlyRate || 
                        config.hourlyRate * 5;
  
  const smallDiff = smallTeamRate - MARKET_SMALL_TEAM;
  const largeDiff = largeTeamRate - MARKET_LARGE_TEAM;
  
  return {
    smallTeamComparison: {
      yours: smallTeamRate,
      market: MARKET_SMALL_TEAM,
      diff: smallDiff,
      diffPercent: Math.round((smallDiff / MARKET_SMALL_TEAM) * 100),
    },
    largeTeamComparison: {
      yours: largeTeamRate,
      market: MARKET_LARGE_TEAM,
      diff: largeDiff,
      diffPercent: Math.round((largeDiff / MARKET_LARGE_TEAM) * 100),
    },
    isWithinMarketRange: Math.abs(smallDiff / MARKET_SMALL_TEAM) <= 0.25 && 
                          Math.abs(largeDiff / MARKET_LARGE_TEAM) <= 0.25,
  };
}
