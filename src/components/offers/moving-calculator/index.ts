// index.ts - Moving Calculator Module Exports

// Main Components
export { MovingCalculator } from './MovingCalculator';
export { MovingCalculatorWithLead } from './MovingCalculatorWithLead';

// Sub-Components
export { InventorySelector } from './InventorySelector';
export { BuildingInfoForm } from './BuildingInfoForm';
export { AddressDistanceForm } from './AddressDistanceForm';
export { DistanceForm } from './DistanceForm';
export { ExtraServicesForm } from './ExtraServicesForm';
export { PricingSummary } from './PricingSummary';

// Custom Hooks
export { useMovingCalculator } from './useMovingCalculator';
export type { UseMovingCalculatorReturn } from './useMovingCalculator';

export { useLeadDataMapper } from './useLeadDataMapper';
export type { UseLeadDataMapperReturn, UnmatchedItem } from './useLeadDataMapper';

// Types
export type {
  InventoryItem,
  InventoryCategory,
  InventorySelection,
  ElevatorSize,
  StairwellType,
  VehicleType,
  AddressData,
  BuildingInfo,
  MovingDetails,
  ExtraServices,
  TimeBreakdown,
  CostBreakdown,
  CalculationResult,
  PricingConfig,
  // New team-based pricing types
  TeamRate,
  Surcharges,
  FloorSurcharges,
  EquipmentCosts,
  TimeMultipliers,
  PricingTemplate,
} from './types';

// Data
export { 
  INVENTORY_CATEGORIES, 
  DEFAULT_PRICING_CONFIG,
  // New pricing templates and helpers
  PRICING_TEMPLATES,
  getTeamRate,
  calculateEffectiveHourlyRate,
  validatePricingConfig,
  compareToMarketStandard,
} from './inventory-data';

// Utility Functions
export {
  calculateNetVolume,
  calculateTruckVolume,
  calculateAssemblyTime,
  calculateCarryingTime,
  calculateTimeBreakdown,
  calculateCostBreakdown,
  calculateMovingCost,
  recommendVehicle,
  recommendCrewSize,
  formatTime,
  formatCHF,
  getVehicleName,
  getVehicleCapacity,
  // Safe number utilities
  safeNumber,
  safeQuantity,
  safeDistance,
  safeMinutes,
  safeFloor,
  safeParkingDistance,
  // Test utilities
  runPricingTests,
  quickPriceCheck,
} from './calculation-utils';

export type { PricingTestCase } from './calculation-utils';
