// calculation-utils.ts - Moving Cost Calculation Logic

import {
  BuildingInfo,
  InventorySelection,
  MovingDetails,
  ExtraServices,
  CalculationResult,
  PricingConfig,
  VehicleType,
  TimeBreakdown,
  CostBreakdown,
} from './types';

// =====================================
// Safe Number Utilities
// =====================================

/**
 * Safely parse a number with bounds checking
 * Returns a valid number within min/max bounds, or the default value
 */
export function safeNumber(
  value: number | string | null | undefined,
  options: { min?: number; max?: number; default?: number; allowFloat?: boolean } = {}
): number {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, default: defaultVal = 0, allowFloat = true } = options;
  
  // Handle null, undefined, NaN
  if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
    return defaultVal;
  }
  
  // Parse string to number if needed
  let num = typeof value === 'string' ? parseFloat(value) : value;
  
  // Check for NaN after parsing
  if (isNaN(num)) {
    return defaultVal;
  }
  
  // Round if not allowing floats
  if (!allowFloat) {
    num = Math.floor(num);
  }
  
  // Clamp to bounds
  return Math.max(min, Math.min(max, num));
}

/**
 * Safely parse an integer quantity (for inventory items)
 */
export function safeQuantity(value: number | string | null | undefined): number {
  return safeNumber(value, { min: 0, max: 9999, default: 0, allowFloat: false });
}

/**
 * Safely parse a distance value (km)
 */
export function safeDistance(value: number | string | null | undefined): number {
  return safeNumber(value, { min: 0, max: 10000, default: 0, allowFloat: true });
}

/**
 * Safely parse a time value (minutes)
 */
export function safeMinutes(value: number | string | null | undefined): number {
  return safeNumber(value, { min: 0, max: 10000, default: 0, allowFloat: false });
}

/**
 * Safely parse a floor number
 */
export function safeFloor(value: number | string | null | undefined): number {
  return safeNumber(value, { min: -2, max: 50, default: 0, allowFloat: false });
}

/**
 * Safely parse a parking distance (meters)
 */
export function safeParkingDistance(value: number | string | null | undefined): number {
  return safeNumber(value, { min: 0, max: 1000, default: 10, allowFloat: false });
}

/**
 * Calculate total net volume from inventory
 */
export function calculateNetVolume(inventory: InventorySelection[]): number {
  return inventory.reduce((sum, item) => sum + item.item.volume_m3 * item.quantity, 0);
}

/**
 * Calculate truck volume with buffer
 */
export function calculateTruckVolume(netVolume: number, bufferPercentage: number = 10): number {
  return netVolume * (1 + bufferPercentage / 100);
}

/**
 * Calculate total assembly/disassembly time
 */
export function calculateAssemblyTime(inventory: InventorySelection[]): number {
  return inventory.reduce((sum, item) => sum + item.item.assembly_time_minutes * item.quantity, 0);
}

/**
 * Calculate carrying time based on building factors
 * Formula considers: floor, elevator, parking distance, stairwell type, tight corners
 */
export function calculateCarryingTime(
  netVolume: number,
  origin: BuildingInfo,
  destination: BuildingInfo
): number {
  // Base time: ~6 minutes per m³ (loading + unloading)
  let baseTime = (netVolume / 10) * 60;

  // Floor factors (minutes per floor)
  const originFloorTime = origin.hasElevator
    ? origin.floor * 5 // With elevator: 5 min per floor
    : origin.floor * 15; // Without elevator: 15 min per floor

  const destinationFloorTime = destination.hasElevator
    ? destination.floor * 5
    : destination.floor * 15;

  // Parking distance penalty (over 10m)
  const originParkingTime =
    origin.parkingDistance > 10
      ? Math.ceil((origin.parkingDistance - 10) / 20) * 10
      : 0;

  const destinationParkingTime =
    destination.parkingDistance > 10
      ? Math.ceil((destination.parkingDistance - 10) / 20) * 10
      : 0;

  // Stairwell multiplier (only applies without elevator)
  // Capped at 1.5x to prevent excessive compounding
  let stairwellMultiplier = 1;

  if (!origin.hasElevator) {
    if (origin.stairwellType === 'narrow') stairwellMultiplier += 0.15;
    if (origin.hasTightCorners) stairwellMultiplier += 0.10;
  }

  if (!destination.hasElevator) {
    if (destination.stairwellType === 'narrow') stairwellMultiplier += 0.15;
    if (destination.hasTightCorners) stairwellMultiplier += 0.10;
  }
  
  // Cap the multiplier at 1.5x to prevent unrealistic time estimates
  stairwellMultiplier = Math.min(stairwellMultiplier, 1.5);

  // Elevator size factor (small elevator = more trips)
  if (origin.hasElevator && origin.elevatorSize === 'small') {
    baseTime *= 1.2;
  }
  if (destination.hasElevator && destination.elevatorSize === 'small') {
    baseTime *= 1.2;
  }

  const totalTime =
    (baseTime + originFloorTime + destinationFloorTime + originParkingTime + destinationParkingTime) *
    stairwellMultiplier;

  return Math.round(totalTime);
}

/**
 * Calculate complete time breakdown
 */
export function calculateTimeBreakdown(
  inventory: InventorySelection[],
  movingDetails: MovingDetails,
  netVolume: number
): TimeBreakdown {
  const assemblyTime = calculateAssemblyTime(inventory);
  const carryingTime = calculateCarryingTime(netVolume, movingDetails.origin, movingDetails.destination);
  const drivingTime = movingDetails.drivingTimeMinutes + movingDetails.additionalStops * 15;

  // Buffer: 10% standard, 15% for complex moves
  const isComplex =
    movingDetails.origin.floor > 4 ||
    movingDetails.destination.floor > 4 ||
    movingDetails.origin.hasTightCorners ||
    movingDetails.destination.hasTightCorners ||
    movingDetails.origin.needsExternalLift ||
    movingDetails.destination.needsExternalLift;

  const bufferPercentage = isComplex ? 15 : 10;
  const bufferTime = Math.round(((assemblyTime + carryingTime + drivingTime) * bufferPercentage) / 100);
  const totalTime = assemblyTime + carryingTime + drivingTime + bufferTime;

  return {
    assemblyTime,
    carryingTime,
    drivingTime,
    bufferTime,
    totalTime,
  };
}

/**
 * Recommend vehicle type based on truck volume
 */
export function recommendVehicle(truckVolume: number): VehicleType {
  if (truckVolume <= 10) return 'transporter';
  if (truckVolume <= 20) return 'truck_3_5t';
  if (truckVolume <= 35) return 'truck_7_5t';
  return 'truck_18t';
}

/**
 * Recommend crew size based on volume and time
 */
export function recommendCrewSize(truckVolume: number, totalTimeHours: number): number {
  if (truckVolume <= 15 && totalTimeHours <= 6) return 2;
  if (truckVolume <= 30 && totalTimeHours <= 10) return 3;
  if (truckVolume <= 50) return 4;
  return 5;
}

/**
 * Get the appropriate team rate for the given crew size
 * Uses team-based pricing (Delta Umzug style) if available
 * 
 * Selection logic:
 * 1. Try exact match (same workers AND at least needed trucks)
 * 2. Try closest match with at least enough workers
 * 3. Use largest available team as fallback
 */
function getTeamHourlyRate(config: PricingConfig, recommendedCrew: number, truckCount: number = 1): number {
  const debug = typeof window !== 'undefined' && (window as unknown as { DEBUG_PRICING?: boolean }).DEBUG_PRICING;
  
  // Check if team rates are available
  if (config.teamRates && config.teamRates.length > 0) {
    // Sort by workers ascending for closest match logic
    const sortedByWorkers = [...config.teamRates].sort((a, b) => a.workers - b.workers);
    
    // 1. Find exact match first (workers AND trucks)
    let match = config.teamRates.find(r => r.workers === recommendedCrew && r.trucks === truckCount);
    let matchType = 'exact';
    
    // 2. If no exact match, find team with exact workers but any truck count
    if (!match) {
      match = config.teamRates.find(r => r.workers === recommendedCrew);
      matchType = 'workers-only';
    }
    
    // 3. If still no match, find the smallest team with enough workers
    if (!match) {
      match = sortedByWorkers.find(r => r.workers >= recommendedCrew);
      matchType = 'closest-larger';
    }
    
    // 4. If still no match (requested crew larger than any team), use largest team
    if (!match) {
      match = sortedByWorkers[sortedByWorkers.length - 1];
      matchType = 'largest-available';
    }
    
    if (debug) {
      console.log('[getTeamHourlyRate] Input:', { recommendedCrew, truckCount });
      console.log('[getTeamHourlyRate] Match Type:', matchType);
      console.log('[getTeamHourlyRate] Selected Team:', match);
      console.log('[getTeamHourlyRate] Hourly Rate:', match.hourlyRate, 'CHF');
    }
    
    return match.hourlyRate;
  }
  
  // Fallback to legacy per-person pricing (DEPRECATED)
  // This maintains backward compatibility but should not be used
  console.warn('[getTeamHourlyRate] Using legacy per-person pricing. Consider switching to team rates.');
  const legacyRate = (config.hourlyRate || 60) * recommendedCrew;
  
  if (debug) {
    console.log('[getTeamHourlyRate] LEGACY MODE:', { hourlyRate: config.hourlyRate, crew: recommendedCrew, total: legacyRate });
  }
  
  return legacyRate;
}

/**
 * Determine number of trucks needed based on volume
 */
function determineTruckCount(truckVolume: number): number {
  // Each large truck can hold ~35m³
  if (truckVolume <= 35) return 1;
  if (truckVolume <= 70) return 2;
  return 3;
}

/**
 * Calculate complete cost breakdown
 * Uses team-based pricing (Delta Umzug style) for accurate Swiss market pricing
 */
export function calculateCostBreakdown(
  timeBreakdown: TimeBreakdown,
  recommendedVehicle: VehicleType,
  movingDetails: MovingDetails,
  extraServices: ExtraServices,
  netVolume: number,
  recommendedCrew: number,
  config: PricingConfig,
  truckVolume?: number,
  debug: boolean = false
): CostBreakdown {
  // Calculate total hours with minimum hours enforcement
  const rawHours = timeBreakdown.totalTime / 60;
  const minimumHours = config.minimumHours || 4;
  const totalHours = Math.max(rawHours, minimumHours);
  
  // Determine truck count from volume
  const truckCount = truckVolume ? determineTruckCount(truckVolume) : 1;
  
  // Get team-based hourly rate (includes truck + workers)
  const teamHourlyRate = getTeamHourlyRate(config, recommendedCrew, truckCount);
  
  // Calculate labor cost using team rate
  // This is the PRIMARY cost calculation - team rate × hours
  const laborCost = Math.round(totalHours * teamHourlyRate);
  
  // Debug logging for pricing investigation
  if (debug || (typeof window !== 'undefined' && (window as unknown as { DEBUG_PRICING?: boolean }).DEBUG_PRICING)) {
    console.log('=== PRICING CALCULATION DEBUG ===');
    console.log('Team Configuration:', { truckCount, recommendedCrew });
    console.log('Team Hourly Rate:', teamHourlyRate, 'CHF');
    console.log('Raw Hours:', rawHours.toFixed(2));
    console.log('Minimum Hours:', minimumHours);
    console.log('Hours Used:', totalHours.toFixed(2));
    console.log('Labor Cost:', laborCost, 'CHF');
  }

  // Vehicle cost is now INCLUDED in team rate (set to 0 to avoid double-counting)
  // Only add vehicle cost if using legacy pricing (teamRates not available)
  const vehicleCost = (config.teamRates && config.teamRates.length > 0) 
    ? 0 // Team rate includes vehicle
    : config.vehiclePrices[recommendedVehicle]; // Legacy pricing

  // Distance surcharge (over threshold)
  const distanceSurcharge =
    movingDetails.distanceKm > config.distanceSurchargeThreshold
      ? Math.round((movingDetails.distanceKm - config.distanceSurchargeThreshold) * config.distanceSurchargeRate)
      : 0;

  // Floor surcharges (if configured)
  let floorSurcharge = 0;
  if (config.floorSurcharges) {
    const originFloorCost = movingDetails.origin.hasElevator
      ? movingDetails.origin.floor * config.floorSurcharges.perFloorWithElevator
      : movingDetails.origin.floor * config.floorSurcharges.perFloorWithoutElevator;
    
    const destFloorCost = movingDetails.destination.hasElevator
      ? movingDetails.destination.floor * config.floorSurcharges.perFloorWithElevator
      : movingDetails.destination.floor * config.floorSurcharges.perFloorWithoutElevator;
    
    floorSurcharge = Math.round(originFloorCost + destFloorCost);
  }

  // Extra services cost
  let extraServicesCost = 0;
  
  if (extraServices.packingService) {
    extraServicesCost += Math.round(netVolume * config.packingServiceRate);
  }
  
  if (extraServices.externalLift) {
    // Use equipment cost if available, otherwise fallback
    const liftCost = config.equipment?.moebelliftBothLocations || config.externalLiftCost;
    extraServicesCost += liftCost;
  }
  
  if (extraServices.disposal) {
    // Calculate based on volume if disposal is per m³
    const disposalRate = config.disposalCost || 35;
    extraServicesCost += Math.round(netVolume * (disposalRate / 10)); // Assume ~10% of volume for disposal
  }
  
  if (extraServices.pianoTransport) {
    // Use surcharges if available
    const pianoCost = config.surcharges?.pianoUpright || config.pianoTransportCost;
    extraServicesCost += pianoCost;
  }
  
  if (extraServices.storage) {
    extraServicesCost += Math.round(netVolume * config.storageCostPerM3);
  }

  // Calculate subtotal
  const subtotal = laborCost + vehicleCost + distanceSurcharge + floorSurcharge + extraServicesCost;
  
  // Apply minimum charge if configured
  const minimumCharge = config.minimumCharge || 0;
  let adjustedSubtotal = Math.max(subtotal, minimumCharge);
  
  // Apply time-based multipliers (weekend, evening, holiday, express)
  // These are applied AFTER minimum charge but BEFORE VAT
  let totalMultiplier = 1.0;
  const appliedMultipliers: string[] = [];
  
  if (config.multipliers) {
    if (extraServices.isWeekend && config.multipliers.weekend > 1) {
      totalMultiplier *= config.multipliers.weekend;
      appliedMultipliers.push(`Weekend: ${((config.multipliers.weekend - 1) * 100).toFixed(0)}%`);
    }
    if (extraServices.isEvening && config.multipliers.evening > 1) {
      totalMultiplier *= config.multipliers.evening;
      appliedMultipliers.push(`Evening: ${((config.multipliers.evening - 1) * 100).toFixed(0)}%`);
    }
    if (extraServices.isHoliday && config.multipliers.holiday > 1) {
      totalMultiplier *= config.multipliers.holiday;
      appliedMultipliers.push(`Holiday: ${((config.multipliers.holiday - 1) * 100).toFixed(0)}%`);
    }
    if (extraServices.isExpress && config.multipliers.express > 1) {
      totalMultiplier *= config.multipliers.express;
      appliedMultipliers.push(`Express: ${((config.multipliers.express - 1) * 100).toFixed(0)}%`);
    }
  }
  
  // Apply combined multiplier
  if (totalMultiplier > 1) {
    adjustedSubtotal = Math.round(adjustedSubtotal * totalMultiplier);
  }
  
  // Calculate VAT (IMPORTANT: vatRate is stored as 8.1, so we divide by 100)
  const vatRate = config.vatRate || 8.1;
  const vat = Math.round(adjustedSubtotal * (vatRate / 100) * 100) / 100;
  const total = Math.round((adjustedSubtotal + vat) * 100) / 100;
  
  // Debug logging continuation
  if (debug || (typeof window !== 'undefined' && (window as unknown as { DEBUG_PRICING?: boolean }).DEBUG_PRICING)) {
    console.log('Vehicle Cost (legacy):', vehicleCost, 'CHF');
    console.log('Distance Surcharge:', distanceSurcharge, 'CHF');
    console.log('Floor Surcharge:', floorSurcharge, 'CHF');
    console.log('Extra Services:', extraServicesCost, 'CHF');
    console.log('Subtotal (before minimum):', subtotal, 'CHF');
    console.log('Minimum Charge:', minimumCharge, 'CHF');
    console.log('Multipliers Applied:', appliedMultipliers.length > 0 ? appliedMultipliers.join(', ') : 'None');
    console.log('Total Multiplier:', totalMultiplier.toFixed(2) + 'x');
    console.log('Adjusted Subtotal (after multipliers):', adjustedSubtotal, 'CHF');
    console.log('VAT Rate:', vatRate, '%');
    console.log('VAT Amount:', vat, 'CHF');
    console.log('TOTAL:', total, 'CHF');
    console.log('================================');
  }

  return {
    laborCost,
    vehicleCost,
    distanceSurcharge,
    extraServicesCost: extraServicesCost + floorSurcharge, // Include floor surcharge in extras
    subtotal: adjustedSubtotal,
    vat,
    total,
  };
}

/**
 * Main calculation function - calculates complete moving cost
 * Uses team-based pricing (Delta Umzug style) for accurate Swiss market pricing
 */
export function calculateMovingCost(
  inventory: InventorySelection[],
  movingDetails: MovingDetails,
  extraServices: ExtraServices,
  config: PricingConfig
): CalculationResult {
  const netVolume = calculateNetVolume(inventory);
  const bufferPercentage = 10;
  const truckVolume = calculateTruckVolume(netVolume, bufferPercentage);
  const timeBreakdown = calculateTimeBreakdown(inventory, movingDetails, netVolume);
  const recommendedVehicle = recommendVehicle(truckVolume);
  const recommendedCrew = recommendCrewSize(truckVolume, timeBreakdown.totalTime / 60);
  
  // Pass truckVolume to determine truck count for team pricing
  const costBreakdown = calculateCostBreakdown(
    timeBreakdown,
    recommendedVehicle,
    movingDetails,
    extraServices,
    netVolume,
    recommendedCrew,
    config,
    truckVolume // Now passed to determine truck count
  );

  return {
    netVolume: Math.round(netVolume * 10) / 10,
    truckVolume: Math.round(truckVolume * 10) / 10,
    bufferPercentage,
    timeBreakdown,
    costBreakdown,
    recommendedVehicle,
    recommendedCrew,
    inventoryList: inventory,
    movingDetails,
    extraServices,
  };
}

// =====================================
// Formatting Utilities
// =====================================

/**
 * Format minutes to human-readable time string
 */
export function formatTime(minutes: number): string {
  // Handle NaN, undefined, null, or negative values
  if (minutes === null || minutes === undefined || isNaN(minutes) || minutes < 0) {
    return '0 Min';
  }
  
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  
  if (hours === 0) return `${mins} Min`;
  if (mins === 0) return `${hours} Std`;
  return `${hours} Std ${mins} Min`;
}

/**
 * Format number as Swiss Francs
 */
export function formatCHF(amount: number): string {
  // Handle NaN, undefined, null values
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'CHF 0.00';
  }
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get human-readable vehicle name
 */
export function getVehicleName(vehicle: VehicleType): string {
  const names: Record<VehicleType, string> = {
    transporter: 'Transporter',
    truck_3_5t: 'LKW 3.5t',
    truck_7_5t: 'LKW 7.5t',
    truck_18t: 'LKW 18t',
  };
  return names[vehicle];
}

/**
 * Get vehicle capacity in m³
 */
export function getVehicleCapacity(vehicle: VehicleType): number {
  const capacities: Record<VehicleType, number> = {
    transporter: 12,
    truck_3_5t: 22,
    truck_7_5t: 40,
    truck_18t: 65,
  };
  return capacities[vehicle];
}

// =====================================
// Test Utilities (for debugging pricing issues)
// =====================================

export interface PricingTestCase {
  name: string;
  input: {
    trucks: number;
    workers: number;
    hours: number;
    isWeekend?: boolean;
    hasPiano?: boolean;
    heavyItems?: number;
  };
  expected: {
    hourlyRate: number;
    laborCost: number;
    subtotalMin: number;
    subtotalMax: number;
    totalMin: number;
    totalMax: number;
  };
}

/**
 * Run pricing test cases to verify calculation accuracy
 * Enable debug mode in browser console: window.DEBUG_PRICING = true
 * Then call: testPricingCalculation()
 */
export function runPricingTests(config: PricingConfig): { 
  passed: number; 
  failed: number; 
  results: Array<{ name: string; passed: boolean; details: string }> 
} {
  const testCases: PricingTestCase[] = [
    {
      name: 'Test Case 1: Basic Move (Delta Umzug Reference)',
      input: { trucks: 1, workers: 2, hours: 5 },
      expected: {
        hourlyRate: 180,
        laborCost: 900,
        subtotalMin: 900,
        subtotalMax: 950,
        totalMin: 970,
        totalMax: 1030,
      },
    },
    {
      name: 'Test Case 2: Minimum Hours Enforcement',
      input: { trucks: 1, workers: 1, hours: 2 }, // below 4h minimum
      expected: {
        hourlyRate: 120,
        laborCost: 480, // 4h × 120
        subtotalMin: 480,
        subtotalMax: 500,
        totalMin: 515,
        totalMax: 545,
      },
    },
    {
      name: 'Test Case 3: Large Team',
      input: { trucks: 2, workers: 6, hours: 8 },
      expected: {
        hourlyRate: 420,
        laborCost: 3360,
        subtotalMin: 3360,
        subtotalMax: 3500,
        totalMin: 3630,
        totalMax: 3800,
      },
    },
  ];

  const results: Array<{ name: string; passed: boolean; details: string }> = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const teamRate = config.teamRates?.find(
      r => r.workers === testCase.input.workers && r.trucks === testCase.input.trucks
    );
    
    const hourlyRate = teamRate?.hourlyRate || 0;
    const hours = Math.max(testCase.input.hours, config.minimumHours || 4);
    const laborCost = hourlyRate * hours;
    const subtotal = Math.max(laborCost, config.minimumCharge || 0);
    const vat = subtotal * ((config.vatRate || 8.1) / 100);
    const total = subtotal + vat;

    const hourlyRateMatch = hourlyRate === testCase.expected.hourlyRate;
    const laborCostMatch = laborCost === testCase.expected.laborCost;
    const subtotalInRange = subtotal >= testCase.expected.subtotalMin && subtotal <= testCase.expected.subtotalMax;
    const totalInRange = total >= testCase.expected.totalMin && total <= testCase.expected.totalMax;
    
    const testPassed = hourlyRateMatch && laborCostMatch && subtotalInRange && totalInRange;

    if (testPassed) {
      passed++;
    } else {
      failed++;
    }

    results.push({
      name: testCase.name,
      passed: testPassed,
      details: `
        Hourly Rate: ${hourlyRate} (expected: ${testCase.expected.hourlyRate}) ${hourlyRateMatch ? '✓' : '✗'}
        Labor Cost: ${laborCost} (expected: ${testCase.expected.laborCost}) ${laborCostMatch ? '✓' : '✗'}
        Subtotal: ${subtotal.toFixed(2)} (range: ${testCase.expected.subtotalMin}-${testCase.expected.subtotalMax}) ${subtotalInRange ? '✓' : '✗'}
        Total: ${total.toFixed(2)} (range: ${testCase.expected.totalMin}-${testCase.expected.totalMax}) ${totalInRange ? '✓' : '✗'}
      `.trim(),
    });
  }

  return { passed, failed, results };
}

/**
 * Quick pricing check - can be called from browser console
 * Usage: checkPricing(2, 5) // 2 workers, 5 hours
 */
export function quickPriceCheck(
  workers: number, 
  hours: number, 
  config: PricingConfig,
  options: { isWeekend?: boolean; trucks?: number } = {}
): void {
  const { isWeekend = false, trucks = 1 } = options;
  
  const teamRate = config.teamRates?.find(r => r.workers === workers) || 
    config.teamRates?.find(r => r.workers >= workers) ||
    config.teamRates?.[config.teamRates.length - 1];
  
  const hourlyRate = teamRate?.hourlyRate || (config.hourlyRate || 60) * workers;
  const effectiveHours = Math.max(hours, config.minimumHours || 4);
  const laborCost = hourlyRate * effectiveHours;
  let subtotal = Math.max(laborCost, config.minimumCharge || 0);
  
  if (isWeekend && config.multipliers?.weekend) {
    subtotal *= config.multipliers.weekend;
  }
  
  const vat = subtotal * ((config.vatRate || 8.1) / 100);
  const total = subtotal + vat;
  
  console.log('=== QUICK PRICE CHECK ===');
  console.log(`Team: ${trucks} truck(s) + ${workers} worker(s)`);
  console.log(`Hourly Rate: ${hourlyRate} CHF`);
  console.log(`Hours: ${hours}h (effective: ${effectiveHours}h)`);
  console.log(`Labor Cost: ${laborCost} CHF`);
  console.log(`Subtotal: ${subtotal.toFixed(2)} CHF${isWeekend ? ' (weekend rate)' : ''}`);
  console.log(`VAT (${config.vatRate || 8.1}%): ${vat.toFixed(2)} CHF`);
  console.log(`TOTAL: ${total.toFixed(2)} CHF`);
  console.log('=========================');
}
