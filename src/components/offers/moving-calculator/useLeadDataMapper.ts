// useLeadDataMapper.ts - Maps Lead/Anfrage data to Moving Calculator format

import { useState, useCallback } from 'react';
import { devLog, devWarn } from '@/lib/devLog';
import { supabase } from '@/integrations/supabase/client';
import {
  InventorySelection,
  AddressData,
  BuildingInfo,
  ExtraServices,
} from './types';
import { INVENTORY_CATEGORIES } from './inventory-data';

// Lead data structure from database
interface LeadData {
  id: string;
  // Customer
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  // From (Auszug)
  from_street: string | null;
  from_house_number: string | null;
  from_plz: string | null;
  from_city: string | null;
  from_floor: number | null;
  from_has_lift: boolean | null;
  from_rooms: number | null;
  from_living_space_m2: number | null;
  from_distance_to_parking: number | null;
  // To (Einzug)
  to_street: string | null;
  to_house_number: string | null;
  to_plz: string | null;
  to_city: string | null;
  to_floor: number | null;
  to_has_lift: boolean | null;
  to_distance_to_parking: number | null;
  // Inventory
  inventory_items: LeadInventoryItem[] | null;
  // Detailed form data
  detailed_form_data: DetailedFormData | null;
  // Services
  packing_service_needed: boolean | null;
  cleaning_service_needed: boolean | null;
  storage_needed: boolean | null;
  piano_type: string | null;
  // Distance
  distance_km: number | null;
  estimated_duration_minutes: number | null;
}

interface LeadInventoryItem {
  kategorie: string;
  name: string;
  anzahl: number;
  gewicht_kg?: number;
  spezial?: boolean;
  aufpreis_chf?: number;
}

interface AnalysisDetectedItem {
  name: string;
  count: number;
  category?: string;
  special?: boolean;
  weight_kg?: number | null;
}

interface BesichtigungAnalysisData {
  detected_items?: AnalysisDetectedItem[] | string | null;
  special_items?: string[] | null;
  special_requirements?: string[] | null;
  from_access_difficulty?: 'einfach' | 'mittel' | 'schwierig' | null;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
  from_parking_distance?: 'direkt' | 'nah' | 'weit' | null;
}

interface DetailedFormData {
  auszug?: {
    adresse?: {
      strasse?: string;
      hausnummer?: string;
      plz?: string;
      ort?: string;
      kanton?: string;
    };
    stockwerk?: number;
    aufzug?: {
      vorhanden?: boolean;
      groesse?: 'klein' | 'mittel' | 'gross';
    };
    parkplatz?: {
      distanz_meter?: number;
    };
    treppenhaus?: {
      breite?: 'eng' | 'normal' | 'breit';
      enge_kurven?: boolean;
    };
  };
  einzug?: {
    adresse?: {
      strasse?: string;
      hausnummer?: string;
      plz?: string;
      ort?: string;
      kanton?: string;
    };
    stockwerk?: number;
    aufzug?: {
      vorhanden?: boolean;
      groesse?: 'klein' | 'mittel' | 'gross';
    };
    parkplatz?: {
      distanz_meter?: number;
    };
    treppenhaus?: {
      breite?: 'eng' | 'normal' | 'breit';
      enge_kurven?: boolean;
    };
  };
  inventar?: {
    items?: LeadInventoryItem[];
    geschaetzte_kartons?: number;
    schwere_gegenstaende?: LeadInventoryItem[];
  };
  zusatzleistungen?: {
    verpackung?: { aktiv?: boolean };
    entsorgung?: { aktiv?: boolean };
    moebellift?: { aktiv?: boolean };
    zwischenlagerung?: { aktiv?: boolean };
  };
}

// Mapping from Umzug form item names to Moving Calculator item IDs
// Uses partial matching - keys can be substrings to match
const ITEM_NAME_MAPPING: Record<string, string> = {
  // Wohnzimmer
  'Sofa 3-Sitzer': 'sofa_3',
  'Sofa (3-Sitzer)': 'sofa_3',
  '3er-Sofa': 'sofa_3',
  '3er Sofa': 'sofa_3',
  'Sofa 2-Sitzer': 'sofa_2',
  'Sofa (2-Sitzer)': 'sofa_2',
  '2er-Sofa': 'sofa_2',
  '2er Sofa': 'sofa_2',
  'Ecksofa': 'sofa_corner',
  'L-Form Sofa': 'sofa_corner',
  'Sessel': 'armchair',
  'Couchtisch': 'coffee_table',
  'TV-Möbel': 'tv_stand',
  'Lowboard': 'tv_stand',
  'Bücherregal': 'bookshelf',
  'Stehlampe': 'floor_lamp',
  'Vitrine': 'display_cabinet',
  // Schlafzimmer
  'Doppelbett': 'bed_double',
  'Einzelbett': 'bed_single',
  'Boxspringbett': 'bed_boxspring',
  'Kleiderschrank 1-türig': 'wardrobe_1m',
  'Kleiderschrank (1-türig)': 'wardrobe_1m',
  'Kleiderschrank 2-türig': 'wardrobe_2m',
  'Kleiderschrank (2-türig)': 'wardrobe_2m',
  'Kleiderschrank 3-türig': 'wardrobe_3m',
  'Kleiderschrank (3-türig)': 'wardrobe_3m',
  'Kleiderschrank': 'wardrobe_2m', // Default to medium
  'Nachttisch': 'nightstand',
  'Kommode': 'dresser',
  // Esszimmer
  'Esstisch 4 Personen': 'dining_table_4',
  'Esstisch (4 Personen)': 'dining_table_4',
  'Esstisch 6 Personen': 'dining_table_6',
  'Esstisch (6 Personen)': 'dining_table_6',
  'Esstisch': 'dining_table_4',
  'Stuhl': 'chair',
  'Stühle': 'chair',
  'Sideboard': 'sideboard',
  'Buffet': 'sideboard',
  // Küche
  'Kühlschrank': 'fridge_large',
  'Gefrierschrank': 'freezer',
  'Gefriertruhe': 'freezer',
  'Geschirrspüler': 'dishwasher',
  'Mikrowelle': 'microwave',
  // Büro
  'Schreibtisch': 'desk_small',
  'Bürostuhl': 'office_chair',
  'Aktenschrank': 'file_cabinet',
  'Drucker': 'printer',
  // Geräte
  'Waschmaschine': 'washing_machine',
  'Tumbler': 'dryer',
  'Wäschetrockner': 'dryer',
  'Trockner': 'dryer',
  'Fernseher': 'tv_large',
  'TV': 'tv_large',
  // Kartons
  'Umzugskarton': 'box_std',
  'Umzugskartons': 'box_std',
  'Umzugskartons (Standard)': 'box_std',
  'Umzugskarton (Standard)': 'box_std',
  'Karton': 'box_std',
  'Bücherkarton': 'box_book',
  'Umzugskartons (Bücher/Schwer)': 'box_book',
  'Kleiderbox': 'box_clothes',
  'Kleiderkarton': 'box_clothes',
  // Transport
  'Fahrrad': 'bike',
  'E-Bike': 'ebike',
  'E-Bike / Motorrad': 'ebike',
  'Pflanzen': 'plant_pot_large',
  'Pflanzen (gross)': 'plant_pot_large',
  // Spezial
  'Klavier (aufrecht)': 'piano_upright',
  'Klavier': 'piano_upright',
  'Flügel': 'piano_grand',
  'Tresor': 'safe_small',
  'Aquarium': 'aquarium',
};


// Represents an item from the lead that couldn't be matched to the calculator inventory
export interface UnmatchedItem {
  name: string;
  kategorie: string;
  anzahl: number;
}

export interface UseLeadDataMapperReturn {
  isLoading: boolean;
  error: string | null;
  leadData: LeadData | null;
  unmatchedItems: UnmatchedItem[];
  loadLeadData: (leadId: string, companyId?: string) => Promise<void>;
  getInventorySelections: () => InventorySelection[];
  getOriginAddress: () => AddressData | null;
  getDestinationAddress: () => AddressData | null;
  getOriginBuildingInfo: () => BuildingInfo;
  getDestinationBuildingInfo: () => BuildingInfo;
  getExtraServices: () => ExtraServices;
  getDistanceKm: () => number;
  getDrivingTimeMinutes: () => number;
}

export function useLeadDataMapper(): UseLeadDataMapperReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [unmatchedItems, setUnmatchedItems] = useState<UnmatchedItem[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<BesichtigungAnalysisData | null>(null);

  // Load lead data from database
  const loadLeadData = useCallback(async (leadId: string, companyId?: string) => {
    setIsLoading(true);
    setError(null);
    setAiAnalysis(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('leads')
        .select(`
          id,
          customer_first_name, customer_last_name, customer_email, customer_phone,
          from_street, from_house_number, from_plz, from_city,
          from_floor, from_has_lift, from_rooms, from_living_space_m2, from_distance_to_parking,
          to_street, to_house_number, to_plz, to_city,
          to_floor, to_has_lift, to_distance_to_parking,
          inventory_items, detailed_form_data,
          packing_service_needed, cleaning_service_needed, storage_needed, piano_type,
          distance_km, estimated_duration_minutes
        `)
        .eq('id', leadId)
        .single();

      if (fetchError) throw fetchError;
      
      setLeadData(data as LeadData);

      // Also load latest KI-Besichtigung analysis for this lead (if company available)
      if (companyId) {
        try {
          const { data: sessionsRaw, error: sessionsError } = await supabase.rpc(
            "get_company_besichtigung_sessions" as never,
            { p_company_id: companyId } as never
          );

          if (!sessionsError && sessionsRaw) {
            const sessions = typeof sessionsRaw === "string" ? JSON.parse(sessionsRaw) : sessionsRaw;
            if (Array.isArray(sessions) && sessions.length > 0) {
              const matchedSession = sessions.find(
                (s: { lead_id?: string; status?: string }) =>
                  s.lead_id === leadId && (s.status === "analyzed" || s.status === "completed")
              );

              if (matchedSession?.id) {
                const { data: analysisRaw } = await supabase.rpc(
                  "get_besichtigung_analysis" as never,
                  { p_session_id: matchedSession.id } as never
                );

                if (analysisRaw) {
                  const parsed = typeof analysisRaw === "string" ? JSON.parse(analysisRaw) : analysisRaw;
                  setAiAnalysis(parsed as BesichtigungAnalysisData);
                }
              }
            }
          }
        } catch (analysisError) {
          // Keep mapper resilient - calculator must still work without AI analysis.
          devWarn("[LeadDataMapper] Could not load KI-Besichtigung analysis:", analysisError);
        }
      }
    } catch (err) {
      console.error('Error loading lead data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lead data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper function to find best matching item
  const findMatchingItem = (leadItemName: string, _leadKategorie: string): { item: typeof INVENTORY_CATEGORIES[0]['items'][0]; categoryId: string } | null => {
    const normalizedName = leadItemName.toLowerCase().trim();
    
    // 1. Try exact match in mapping
    const exactMappedId = ITEM_NAME_MAPPING[leadItemName];
    if (exactMappedId) {
      for (const category of INVENTORY_CATEGORIES) {
        const item = category.items.find(i => i.id === exactMappedId);
        if (item) return { item, categoryId: category.id };
      }
    }
    
    // 2. Try partial match in mapping keys
    for (const [mappingKey, itemId] of Object.entries(ITEM_NAME_MAPPING)) {
      if (normalizedName.includes(mappingKey.toLowerCase()) || mappingKey.toLowerCase().includes(normalizedName)) {
        for (const category of INVENTORY_CATEGORIES) {
          const item = category.items.find(i => i.id === itemId);
          if (item) return { item, categoryId: category.id };
        }
      }
    }
    
    // 3. Try direct name matching against inventory items
    for (const category of INVENTORY_CATEGORIES) {
      // First try exact substring match
      for (const item of category.items) {
        const itemNameLower = item.name_de.toLowerCase();
        if (itemNameLower === normalizedName || 
            normalizedName.includes(itemNameLower) || 
            itemNameLower.includes(normalizedName)) {
          return { item, categoryId: category.id };
        }
      }
    }
    
    // 4. Try word-by-word matching for better fuzzy matching
    const leadWords = normalizedName.split(/[\s\-/()]+/).filter(w => w.length > 2);
    for (const category of INVENTORY_CATEGORIES) {
      for (const item of category.items) {
        const itemWords = item.name_de.toLowerCase().split(/[\s\-/()]+/).filter(w => w.length > 2);
        const matchingWords = leadWords.filter(lw => itemWords.some(iw => iw.includes(lw) || lw.includes(iw)));
        if (matchingWords.length >= 1 && matchingWords.length >= leadWords.length * 0.5) {
          return { item, categoryId: category.id };
        }
      }
    }
    
    return null;
  };

  // Map lead inventory items to Moving Calculator format
  const getInventorySelections = useCallback((): InventorySelection[] => {
    if (!leadData) return [];

    const selections: InventorySelection[] = [];
    const processedItemIds = new Set<string>();
    const newUnmatchedItems: UnmatchedItem[] = [];
    
    // Get inventory from detailed_form_data or inventory_items
    const inventoryItems = leadData.detailed_form_data?.inventar?.items || 
                          leadData.inventory_items || 
                          [];
    
    const specialItems = leadData.detailed_form_data?.inventar?.schwere_gegenstaende || [];
    
    // Merge AI-detected items into lead inventory for auto-prefill.
    const aiDetectedRaw = aiAnalysis?.detected_items;
    const parsedAiDetected = (() => {
      try {
        return typeof aiDetectedRaw === 'string' ? JSON.parse(aiDetectedRaw) : aiDetectedRaw;
      } catch {
        return [];
      }
    })();
    const aiDetectedItems: LeadInventoryItem[] = (
      parsedAiDetected || []
    ).map((item: AnalysisDetectedItem) => ({
      kategorie: item.category || 'sonstiges',
      name: item.name,
      anzahl: Math.max(1, item.count || 1),
      gewicht_kg: item.weight_kg ?? undefined,
      spezial: !!item.special,
    }));

    const aiSpecialItems: LeadInventoryItem[] = (aiAnalysis?.special_items || []).map((name) => ({
      kategorie: 'spezial',
      name,
      anzahl: 1,
      spezial: true,
    }));

    // Merge by item name to avoid duplicate double-counting from multiple sources.
    const mergedByName = new Map<string, LeadInventoryItem>();
    const mergeItem = (item: LeadInventoryItem) => {
      const key = item.name.toLowerCase().trim();
      const existing = mergedByName.get(key);
      if (!existing) {
        mergedByName.set(key, { ...item });
      } else {
        mergedByName.set(key, {
          ...existing,
          anzahl: Math.max(existing.anzahl || 0, item.anzahl || 0),
          spezial: existing.spezial || item.spezial || false,
          gewicht_kg: existing.gewicht_kg ?? item.gewicht_kg,
        });
      }
    };

    [...inventoryItems, ...specialItems, ...aiDetectedItems, ...aiSpecialItems].forEach(mergeItem);
    const allItems = Array.from(mergedByName.values());

    for (const leadItem of allItems) {
      if (!leadItem.anzahl || leadItem.anzahl <= 0) continue;

      const match = findMatchingItem(leadItem.name, leadItem.kategorie);
      
      if (match) {
        // Check if we already added this item
        if (processedItemIds.has(match.item.id)) {
          // Add to existing quantity
          const existingSelection = selections.find(s => s.item.id === match.item.id);
          if (existingSelection) {
            existingSelection.quantity += leadItem.anzahl;
          }
        } else {
          selections.push({
            item: match.item,
            category_id: match.categoryId,
            quantity: leadItem.anzahl,
          });
          processedItemIds.add(match.item.id);
        }
      } else {
        // Track unmatched items for user notification (surfaced in the UI via newUnmatchedItems)
        devWarn('[LeadDataMapper] No match found for item:', leadItem.name, 'in category:', leadItem.kategorie);
        newUnmatchedItems.push({
          name: leadItem.name,
          kategorie: leadItem.kategorie,
          anzahl: leadItem.anzahl,
        });
      }
    }

    // Add kartons if specified and not already added
    const kartonCount = leadData.detailed_form_data?.inventar?.geschaetzte_kartons || 0;
    if (kartonCount > 0 && !processedItemIds.has('box_std')) {
      const boxesCategory = INVENTORY_CATEGORIES.find(c => c.id === 'boxes');
      const stdBox = boxesCategory?.items.find(i => i.id === 'box_std');
      if (stdBox) {
        selections.push({
          item: stdBox,
          category_id: 'boxes',
          quantity: kartonCount,
        });
      }
    }

    // Update unmatched items state
    setUnmatchedItems(newUnmatchedItems);

    devLog('[LeadDataMapper] Mapped', selections.length, 'items from lead data');
    if (newUnmatchedItems.length > 0) {
      devWarn('[LeadDataMapper] Unmatched items:', newUnmatchedItems);
    }
    
    return selections;
  }, [aiAnalysis, leadData]);

  // Get origin address
  const getOriginAddress = useCallback((): AddressData | null => {
    if (!leadData) return null;

    const detailed = leadData.detailed_form_data?.auszug?.adresse;
    
    if (!leadData.from_plz && !detailed?.plz) return null;

    return {
      formattedAddress: `${detailed?.strasse || leadData.from_street || ''} ${detailed?.hausnummer || leadData.from_house_number || ''}, ${detailed?.plz || leadData.from_plz || ''} ${detailed?.ort || leadData.from_city || ''}, Schweiz`.trim(),
      street: detailed?.strasse || leadData.from_street || '',
      houseNumber: detailed?.hausnummer || leadData.from_house_number || '',
      plz: detailed?.plz || leadData.from_plz || '',
      city: detailed?.ort || leadData.from_city || '',
      canton: detailed?.kanton || '',
      country: 'CH',
      lat: 0,
      lng: 0,
    };
  }, [leadData]);

  // Get destination address
  const getDestinationAddress = useCallback((): AddressData | null => {
    if (!leadData) return null;

    const detailed = leadData.detailed_form_data?.einzug?.adresse;
    
    if (!leadData.to_plz && !detailed?.plz) return null;

    return {
      formattedAddress: `${detailed?.strasse || leadData.to_street || ''} ${detailed?.hausnummer || leadData.to_house_number || ''}, ${detailed?.plz || leadData.to_plz || ''} ${detailed?.ort || leadData.to_city || ''}, Schweiz`.trim(),
      street: detailed?.strasse || leadData.to_street || '',
      houseNumber: detailed?.hausnummer || leadData.to_house_number || '',
      plz: detailed?.plz || leadData.to_plz || '',
      city: detailed?.ort || leadData.to_city || '',
      canton: detailed?.kanton || '',
      country: 'CH',
      lat: 0,
      lng: 0,
    };
  }, [leadData]);

  // Helper to convert stockwerk string to number
  const stockwerkToNumber = (stockwerk?: string): number => {
    if (!stockwerk) return 0;
    const mapping: Record<string, number> = {
      'basement': -1,
      'ground_floor': 0,
      'raised_ground': 1,
      'floor_1': 1,
      'floor_2': 2,
      'floor_3': 3,
      'floor_4': 4,
      'floor_5_plus': 5,
    };
    return mapping[stockwerk] ?? 0;
  };

  // Get origin building info
  const getOriginBuildingInfo = useCallback((): BuildingInfo => {
    if (!leadData) {
      return {
        floor: 0,
        hasElevator: false,
        elevatorSize: undefined,
        parkingDistance: 10,
        stairwellType: 'standard',
        hasTightCorners: false,
        needsExternalLift: false,
      };
    }

    const detailed = leadData.detailed_form_data?.auszug;
    
    const elevatorSizeMap: Record<string, 'small' | 'standard' | 'large'> = {
      'klein': 'small',
      'mittel': 'standard',
      'gross': 'large',
    };

    const stairwellMap: Record<string, 'narrow' | 'standard' | 'wide'> = {
      'eng': 'narrow',
      'normal': 'standard',
      'breit': 'wide',
    };

    // Get floor - prefer numeric from_floor, then convert stockwerk string
    const floor = aiAnalysis?.from_floor ?? leadData.from_floor ?? stockwerkToNumber(detailed?.stockwerk);

    const parkingDistanceMap: Record<string, number> = {
      direkt: 5,
      nah: 25,
      weit: 60,
    };
    const accessDifficulty = aiAnalysis?.from_access_difficulty;

    return {
      floor,
      hasElevator: aiAnalysis?.from_has_lift ?? detailed?.aufzug?.vorhanden ?? leadData.from_has_lift ?? false,
      elevatorSize: detailed?.aufzug?.groesse ? elevatorSizeMap[detailed.aufzug.groesse] : undefined,
      parkingDistance:
        (aiAnalysis?.from_parking_distance ? parkingDistanceMap[aiAnalysis.from_parking_distance] : undefined)
        ?? detailed?.parkplatz?.distanz_meter
        ?? leadData.from_distance_to_parking
        ?? 10,
      stairwellType: accessDifficulty === 'schwierig'
        ? 'narrow'
        : (detailed?.treppenhaus?.breite ? stairwellMap[detailed.treppenhaus.breite] : 'standard'),
      hasTightCorners: accessDifficulty === 'schwierig' || detailed?.treppenhaus?.enge_kurven || false,
      needsExternalLift: false,
    };
  }, [aiAnalysis, leadData]);

  // Get destination building info
  const getDestinationBuildingInfo = useCallback((): BuildingInfo => {
    if (!leadData) {
      return {
        floor: 0,
        hasElevator: false,
        elevatorSize: undefined,
        parkingDistance: 10,
        stairwellType: 'standard',
        hasTightCorners: false,
        needsExternalLift: false,
      };
    }

    const detailed = leadData.detailed_form_data?.einzug;
    
    const elevatorSizeMap: Record<string, 'small' | 'standard' | 'large'> = {
      'klein': 'small',
      'mittel': 'standard',
      'gross': 'large',
    };

    const stairwellMap: Record<string, 'narrow' | 'standard' | 'wide'> = {
      'eng': 'narrow',
      'normal': 'standard',
      'breit': 'wide',
    };

    // Get floor - prefer numeric to_floor, then convert stockwerk string
    const floor = leadData.to_floor ?? stockwerkToNumber(detailed?.stockwerk);

    return {
      floor,
      hasElevator: detailed?.aufzug?.vorhanden ?? leadData.to_has_lift ?? false,
      elevatorSize: detailed?.aufzug?.groesse ? elevatorSizeMap[detailed.aufzug.groesse] : undefined,
      parkingDistance: detailed?.parkplatz?.distanz_meter ?? leadData.to_distance_to_parking ?? 10,
      stairwellType: detailed?.treppenhaus?.breite ? stairwellMap[detailed.treppenhaus.breite] : 'standard',
      hasTightCorners: detailed?.treppenhaus?.enge_kurven ?? false,
      needsExternalLift: false,
    };
  }, [leadData]);

  // Get extra services
  const getExtraServices = useCallback((): ExtraServices => {
    if (!leadData) {
      return {
        packingService: false,
        externalLift: false,
        disposal: false,
        pianoTransport: false,
        storage: false,
      };
    }

    const detailed = leadData.detailed_form_data?.zusatzleistungen;

    const reqText = (aiAnalysis?.special_requirements || []).join(' ').toLowerCase();
    const aiSpecialItemsText = (aiAnalysis?.special_items || []).join(' ').toLowerCase();

    return {
      packingService: detailed?.verpackung?.aktiv ?? leadData.packing_service_needed ?? false,
      externalLift:
        detailed?.moebellift?.aktiv ??
        (
          reqText.includes('möbellift') ||
          reqText.includes('moebellift') ||
          reqText.includes('lift erforderlich')
        ),
      disposal: detailed?.entsorgung?.aktiv ?? reqText.includes('entsorgung'),
      pianoTransport:
        !!leadData.piano_type ||
        aiSpecialItemsText.includes('klavier') ||
        aiSpecialItemsText.includes('flügel') ||
        aiSpecialItemsText.includes('piano'),
      storage: detailed?.zwischenlagerung?.aktiv ?? leadData.storage_needed ?? false,
    };
  }, [aiAnalysis, leadData]);

  // Get distance
  const getDistanceKm = useCallback((): number => {
    return leadData?.distance_km ?? 0;
  }, [leadData]);

  // Get driving time
  const getDrivingTimeMinutes = useCallback((): number => {
    return leadData?.estimated_duration_minutes ?? 0;
  }, [leadData]);

  return {
    isLoading,
    error,
    leadData,
    unmatchedItems,
    loadLeadData,
    getInventorySelections,
    getOriginAddress,
    getDestinationAddress,
    getOriginBuildingInfo,
    getDestinationBuildingInfo,
    getExtraServices,
    getDistanceKm,
    getDrivingTimeMinutes,
  };
}
