// useMovingCalculator.ts - Custom Hook for Moving Calculator State Management

import { useState, useMemo, useCallback } from 'react';
import {
  InventorySelection,
  InventoryItem,
  BuildingInfo,
  MovingDetails,
  ExtraServices,
  CalculationResult,
  PricingConfig,
  AddressData,
} from './types';
import { 
  calculateMovingCost, 
  safeQuantity, 
  safeDistance, 
  safeMinutes,
  safeFloor,
  safeParkingDistance,
} from './calculation-utils';
import { DEFAULT_PRICING_CONFIG } from './inventory-data';

// Maximum number of inventory items to prevent memory issues
const MAX_INVENTORY_ITEMS = 500;
const MAX_QUANTITY_PER_ITEM = 99;

const DEFAULT_BUILDING_INFO: BuildingInfo = {
  floor: 0,
  hasElevator: false,
  elevatorSize: undefined,
  parkingDistance: 10,
  stairwellType: 'standard',
  hasTightCorners: false,
  needsExternalLift: false,
};

const DEFAULT_EXTRA_SERVICES: ExtraServices = {
  packingService: false,
  externalLift: false,
  disposal: false,
  pianoTransport: false,
  storage: false,
};

export interface UseMovingCalculatorReturn {
  // State
  inventory: InventorySelection[];
  origin: BuildingInfo;
  destination: BuildingInfo;
  originAddress: AddressData | null;
  destinationAddress: AddressData | null;
  distanceKm: number;
  drivingTimeMinutes: number;
  additionalStops: number;
  extraServices: ExtraServices;
  result: CalculationResult | null;

  // Inventory Actions
  addItem: (item: InventoryItem, categoryId: string) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearInventory: () => void;
  getItemQuantity: (itemId: string) => number;

  // Building Info Actions
  setOrigin: (data: BuildingInfo) => void;
  setDestination: (data: BuildingInfo) => void;

  // Address Actions
  setOriginAddress: (address: AddressData | null) => void;
  setDestinationAddress: (address: AddressData | null) => void;

  // Moving Details Actions
  setDistanceKm: (km: number) => void;
  setDrivingTimeMinutes: (minutes: number) => void;
  setAdditionalStops: (stops: number) => void;

  // Extra Services Actions
  setExtraServices: (services: ExtraServices) => void;

  // Utility
  reset: () => void;
}

export function useMovingCalculator(
  pricingConfig: PricingConfig = DEFAULT_PRICING_CONFIG
): UseMovingCalculatorReturn {
  // Inventory state
  const [inventory, setInventory] = useState<InventorySelection[]>([]);

  // Building info state
  const [origin, setOrigin] = useState<BuildingInfo>({ ...DEFAULT_BUILDING_INFO });
  const [destination, setDestination] = useState<BuildingInfo>({ ...DEFAULT_BUILDING_INFO });

  // Address state
  const [originAddress, setOriginAddress] = useState<AddressData | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<AddressData | null>(null);

  // Moving details state
  const [distanceKm, setDistanceKmInternal] = useState<number>(0);
  const [drivingTimeMinutes, setDrivingTimeMinutesInternal] = useState<number>(0);
  const [additionalStops, setAdditionalStopsInternal] = useState<number>(0);

  // Safe setters with validation
  const setDistanceKm = useCallback((value: number) => {
    setDistanceKmInternal(safeDistance(value));
  }, []);

  const setDrivingTimeMinutes = useCallback((value: number) => {
    setDrivingTimeMinutesInternal(safeMinutes(value));
  }, []);

  const setAdditionalStops = useCallback((value: number) => {
    setAdditionalStopsInternal(safeQuantity(value));
  }, []);

  // Extra services state
  const [extraServices, setExtraServices] = useState<ExtraServices>({ ...DEFAULT_EXTRA_SERVICES });

  // Add item to inventory with validation
  const addItem = useCallback((item: InventoryItem, categoryId: string) => {
    if (!item?.id || !categoryId) {
      console.warn('[useMovingCalculator] Invalid item or categoryId');
      return;
    }
    
    setInventory((prev) => {
      // Check max inventory items limit
      if (prev.length >= MAX_INVENTORY_ITEMS) {
        console.warn('[useMovingCalculator] Max inventory items reached');
        return prev;
      }
      
      const existing = prev.find((sel) => sel.item.id === item.id);
      if (existing) {
        // Check max quantity per item
        if (existing.quantity >= MAX_QUANTITY_PER_ITEM) {
          console.warn('[useMovingCalculator] Max quantity per item reached');
          return prev;
        }
        return prev.map((sel) =>
          sel.item.id === item.id ? { ...sel, quantity: sel.quantity + 1 } : sel
        );
      }
      return [...prev, { item, category_id: categoryId, quantity: 1 }];
    });
  }, []);

  // Remove item from inventory (decrease quantity or remove)
  const removeItem = useCallback((itemId: string) => {
    setInventory((prev) => {
      const existing = prev.find((sel) => sel.item.id === itemId);
      if (!existing) return prev;
      if (existing.quantity > 1) {
        return prev.map((sel) =>
          sel.item.id === itemId ? { ...sel, quantity: sel.quantity - 1 } : sel
        );
      }
      return prev.filter((sel) => sel.item.id !== itemId);
    });
  }, []);

  // Update item quantity directly with validation
  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    // Validate and sanitize the quantity
    const safeQty = safeQuantity(quantity);
    
    if (safeQty <= 0) {
      setInventory((prev) => prev.filter((sel) => sel.item.id !== itemId));
      return;
    }
    
    // Cap at max quantity
    const cappedQty = Math.min(safeQty, MAX_QUANTITY_PER_ITEM);
    
    setInventory((prev) =>
      prev.map((sel) => (sel.item.id === itemId ? { ...sel, quantity: cappedQty } : sel))
    );
  }, []);

  // Clear all inventory
  const clearInventory = useCallback(() => {
    setInventory([]);
  }, []);

  // Get item quantity
  const getItemQuantity = useCallback(
    (itemId: string): number => {
      return inventory.find((sel) => sel.item.id === itemId)?.quantity ?? 0;
    },
    [inventory]
  );

  // Safe building info setter with validation
  const setOriginSafe = useCallback((data: BuildingInfo) => {
    setOrigin({
      ...data,
      floor: safeFloor(data.floor),
      parkingDistance: safeParkingDistance(data.parkingDistance),
    });
  }, []);

  const setDestinationSafe = useCallback((data: BuildingInfo) => {
    setDestination({
      ...data,
      floor: safeFloor(data.floor),
      parkingDistance: safeParkingDistance(data.parkingDistance),
    });
  }, []);

  // Reset everything
  const reset = useCallback(() => {
    setInventory([]);
    setOrigin({ ...DEFAULT_BUILDING_INFO });
    setDestination({ ...DEFAULT_BUILDING_INFO });
    setOriginAddress(null);
    setDestinationAddress(null);
    setDistanceKmInternal(0);
    setDrivingTimeMinutesInternal(0);
    setAdditionalStopsInternal(0);
    setExtraServices({ ...DEFAULT_EXTRA_SERVICES });
  }, []);

  // Calculate result when dependencies change
  const result: CalculationResult | null = useMemo(() => {
    if (inventory.length === 0) return null;

    const movingDetails: MovingDetails = {
      origin,
      destination,
      distanceKm,
      drivingTimeMinutes,
      additionalStops,
    };

    return calculateMovingCost(inventory, movingDetails, extraServices, pricingConfig);
  }, [inventory, origin, destination, distanceKm, drivingTimeMinutes, additionalStops, extraServices, pricingConfig]);

  return {
    // State
    inventory,
    origin,
    destination,
    originAddress,
    destinationAddress,
    distanceKm,
    drivingTimeMinutes,
    additionalStops,
    extraServices,
    result,

    // Inventory Actions
    addItem,
    removeItem,
    updateQuantity,
    clearInventory,
    getItemQuantity,

    // Building Info Actions (with validation)
    setOrigin: setOriginSafe,
    setDestination: setDestinationSafe,

    // Address Actions
    setOriginAddress,
    setDestinationAddress,

    // Moving Details Actions (with validation)
    setDistanceKm,
    setDrivingTimeMinutes,
    setAdditionalStops,

    // Extra Services Actions
    setExtraServices,

    // Utility
    reset,
  };
}
