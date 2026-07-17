// types.ts - Swiss Moving Calculator Type Definitions

export interface InventoryItem {
  id: string;
  name_de: string;
  volume_m3: number;
  assembly_time_minutes: number;
}

export interface InventoryCategory {
  id: string;
  name_de: string;
  items: InventoryItem[];
}

export interface InventorySelection {
  item: InventoryItem;
  category_id: string;
  quantity: number;
}

export type ElevatorSize = 'small' | 'standard' | 'large';
export type StairwellType = 'narrow' | 'standard' | 'wide';
export type VehicleType = 'transporter' | 'truck_3_5t' | 'truck_7_5t' | 'truck_18t';

export interface AddressData {
  formattedAddress: string;
  street: string;
  houseNumber: string;
  plz: string;
  city: string;
  canton: string;
  country: string;
  lat: number;
  lng: number;
}

export interface BuildingInfo {
  floor: number;
  hasElevator: boolean;
  elevatorSize?: ElevatorSize;
  parkingDistance: number;
  stairwellType: StairwellType;
  hasTightCorners: boolean;
  needsExternalLift: boolean;
}

export interface MovingDetails {
  origin: BuildingInfo;
  destination: BuildingInfo;
  originAddress?: AddressData | null;
  destinationAddress?: AddressData | null;
  distanceKm: number;
  drivingTimeMinutes: number;
  additionalStops: number;
}

export interface ExtraServices {
  packingService: boolean;
  externalLift: boolean;
  disposal: boolean;
  pianoTransport: boolean;
  storage: boolean;
  // Time-based multipliers
  isWeekend?: boolean;
  isEvening?: boolean;
  isHoliday?: boolean;
  isExpress?: boolean;
}

export interface TimeBreakdown {
  assemblyTime: number;
  carryingTime: number;
  drivingTime: number;
  bufferTime: number;
  totalTime: number;
}

export interface CostBreakdown {
  laborCost: number;
  vehicleCost: number;
  distanceSurcharge: number;
  extraServicesCost: number;
  subtotal: number;
  vat: number;
  total: number;
}

export interface CalculationResult {
  netVolume: number;
  truckVolume: number;
  bufferPercentage: number;
  timeBreakdown: TimeBreakdown;
  costBreakdown: CostBreakdown;
  recommendedVehicle: VehicleType;
  recommendedCrew: number;
  inventoryList: InventorySelection[];
  movingDetails: MovingDetails;
  extraServices: ExtraServices;
}

// Team configuration for pricing (truck + workers as one unit)
export interface TeamRate {
  trucks: number;
  workers: number;
  hourlyRate: number; // Combined rate for the team (includes vehicle)
  label?: string; // e.g., "1 LKW + 2 Helfer"
}

// Surcharges for special items and conditions
export interface Surcharges {
  heavyItemOver100kg: number; // Per item surcharge
  pianoUpright: number; // Klavier
  pianoGrand: number; // Flügel
  safeSmall: number; // Tresor klein
  safeLarge: number; // Tresor gross
  aquarium: number;
  poolTable: number;
}

// Floor surcharges
export interface FloorSurcharges {
  perFloorWithoutElevator: number; // CHF per floor without elevator
  perFloorWithElevator: number; // CHF per floor with elevator
  groundFloorBase: number; // Base for ground floor
}

// Equipment costs
export interface EquipmentCosts {
  moebelliftSingleLocation: number; // One location only
  moebelliftBothLocations: number; // Load + unload locations
  packingMaterialPerM3: number; // Packing materials per m³
}

// Time multipliers for special occasions
export interface TimeMultipliers {
  weekend: number; // Saturday/Sunday multiplier (e.g., 1.2 = 20% increase)
  evening: number; // After 18:00 multiplier
  holiday: number; // Public holiday multiplier
  express: number; // Same-day/next-day service
}

// Complete pricing configuration
export interface PricingConfig {
  // Basic settings
  // DB CHECK + Zod both accept CHF|EUR; the type reflects that honestly (default stays CHF).
  currency: "CHF" | "EUR";
  vatRate: number; // Swiss VAT (e.g., 8.1)
  minimumHours: number; // Minimum billable hours (e.g., 4)
  minimumCharge: number; // Minimum total charge
  
  // Team-based pricing (Delta Umzug style)
  // This is the primary pricing model - combined rate for truck + workers
  teamRates: TeamRate[];
  
  // Legacy per-person pricing (for backward compatibility)
  // Will be deprecated - use teamRates instead
  hourlyRate: number;
  vehiclePrices: Record<VehicleType, number>;
  
  // Distance pricing
  distanceSurchargeRate: number; // CHF per km over threshold
  distanceSurchargeThreshold: number; // km before surcharge applies
  
  // Surcharges for special items
  surcharges: Surcharges;
  
  // Floor-based surcharges
  floorSurcharges: FloorSurcharges;
  
  // Equipment rental costs
  equipment: EquipmentCosts;
  
  // Extra services
  packingServiceRate: number; // CHF per m³
  externalLiftCost: number; // Flat rate for external lift
  disposalCost: number; // Flat rate for disposal
  pianoTransportCost: number; // Flat rate (legacy, use surcharges instead)
  storageCostPerM3: number; // CHF per m³ per month
  
  // Time-based multipliers
  multipliers: TimeMultipliers;
}

// Pricing template for quick setup
export interface PricingTemplate {
  id: string;
  name: string;
  description: string;
  config: PricingConfig;
  isMarketStandard?: boolean;
}
