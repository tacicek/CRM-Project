// =============================================================================
// useCompanyPricing Hook
// Manages company-specific pricing configuration
// 
// FEATURES:
// - Zod validation for type safety
// - AbortController for race condition prevention
// - Debounced auto-save draft to localStorage
// - Optimistic updates on save
// - Rate limiting for save button
// - Offline support with localStorage fallback
// =============================================================================

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { z } from 'zod';
import { useDebouncedCallback } from 'use-debounce';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  PricingConfig, 
  TeamRate,
  DEFAULT_PRICING_CONFIG,
  PRICING_TEMPLATES,
  validatePricingConfig,
  compareToMarketStandard
} from '@/components/offers/moving-calculator';
import {
  mergePricingConfig,
  type PricingConfigPatch,
} from '@/components/offers/moving-calculator/pricingMerge';
import { serializePricingConfig } from '@/components/offers/moving-calculator/pricingSerialize';

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY_PREFIX = 'pricing_draft_';
const AUTO_SAVE_DELAY_MS = 1000; // 1 second debounce for draft saves
const SAVE_RATE_LIMIT_MS = 2000; // Minimum 2 seconds between saves

// =============================================================================
// Zod Schemas for Runtime Validation
// =============================================================================

const TeamRateSchema = z.object({
  trucks: z.number().int().min(1).max(10),
  workers: z.number().int().min(1).max(20),
  hourlyRate: z.number().min(0).max(10000),
  label: z.string().optional(),
});

/**
 * Rebuild a validated zod result into the domain `TeamRate`. `TeamRateSchema` validates
 * the values (ints, ranges), but under this project's tsconfig `strict:false` zod's
 * inferred output types every field as optional. This copies the already-validated
 * values into an explicit TeamRate — no cast, no defaulting, no revalidation loss.
 */
const toTeamRate = (r: z.infer<typeof TeamRateSchema>): TeamRate => ({
  trucks: r.trucks,
  workers: r.workers,
  hourlyRate: r.hourlyRate,
  label: r.label,
});

const DbPricingConfigSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  currency: z.enum(['CHF', 'EUR']).default('CHF'),
  vatRate: z.number().min(0).max(30).nullable().default(8.1),
  minimumHours: z.number().int().min(1).max(24).nullable().default(4),
  minimumCharge: z.number().min(0).nullable().default(480),
  teamRates: z.array(TeamRateSchema).min(1).nullable(),
  hourlyRate: z.number().min(0).nullable().default(60),
  vehiclePrices: z.record(z.string(), z.number()).nullable(),
  distanceSurchargeRate: z.number().min(0).nullable().default(2.5),
  distanceSurchargeThreshold: z.number().int().min(0).nullable().default(20),
  surcharges: z.record(z.string(), z.number()).nullable(),
  floorSurcharges: z.record(z.string(), z.number()).nullable(),
  equipment: z.record(z.string(), z.number()).nullable(),
  packingServiceRate: z.number().min(0).nullable().default(45),
  externalLiftCost: z.number().min(0).nullable().default(550),
  disposalCost: z.number().min(0).nullable().default(35),
  pianoTransportCost: z.number().min(0).nullable().default(350),
  storageCostPerM3: z.number().min(0).nullable().default(45),
  multipliers: z.record(z.string(), z.number()).nullable(),
  templateId: z.string().nullable(),
  templateName: z.string().nullable(),
  isActive: z.boolean().default(true),
  updatedAt: z.string().nullable(),
}).passthrough();

type DbPricingConfig = z.infer<typeof DbPricingConfigSchema>;

// =============================================================================
// Hook Return Type
// =============================================================================

interface UseCompanyPricingReturn {
  // State
  pricingConfig: PricingConfig;
  isLoading: boolean;
  isSaving: boolean;
  hasCustomConfig: boolean;
  lastSaved: Date | null;
  error: string | null;
  isOnline: boolean;
  hasDraft: boolean;
  
  // Validation (memoized)
  validation: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
  marketComparison: ReturnType<typeof compareToMarketStandard>;
  
  // Actions
  loadConfig: (companyId: string) => Promise<void>;
  saveConfig: (companyId: string, config: PricingConfig) => Promise<boolean>;
  resetToDefault: () => void;
  applyTemplate: (templateId: string) => void;
  clearError: () => void;
  discardDraft: (companyId: string) => void;
  restoreDraft: (companyId: string) => boolean;
  
  // Partial updates
  updateTeamRate: (index: number, rate: Partial<TeamRate>) => void;
  addTeamRate: () => void;
  removeTeamRate: (index: number) => void;
  updateConfig: (patch: PricingConfigPatch) => void;
  
  // Track changes
  hasUnsavedChanges: boolean;
  markAsSaved: () => void;
  
  // Rate limiting
  canSave: boolean;
  saveCountdown: number;
}

// =============================================================================
// localStorage Helpers
// =============================================================================

function getStorageKey(companyId: string): string {
  return `${STORAGE_KEY_PREFIX}${companyId}`;
}

function saveDraftToStorage(companyId: string, config: PricingConfig): void {
  try {
    const data = {
      config,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(getStorageKey(companyId), JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save draft to localStorage:', e);
  }
}

function loadDraftFromStorage(companyId: string): { config: PricingConfig; savedAt: Date } | null {
  try {
    const raw = localStorage.getItem(getStorageKey(companyId));
    if (!raw) return null;
    
    const data = JSON.parse(raw);
    
    // Validate structure
    if (!data || typeof data !== 'object') return null;
    if (!data.config || typeof data.config !== 'object') return null;
    if (!data.savedAt || typeof data.savedAt !== 'string') return null;
    
    // Validate config has required fields
    const config = data.config;
    if (!Array.isArray(config.teamRates)) return null;
    if (typeof config.vatRate !== 'number') return null;
    
    // Validate savedAt is a valid date
    const savedAt = new Date(data.savedAt);
    if (isNaN(savedAt.getTime())) return null;
    
    return {
      config: config as PricingConfig,
      savedAt,
    };
  } catch (e) {
    // Clear corrupted data
    try {
      localStorage.removeItem(getStorageKey(companyId));
    } catch {
      // Ignore removal errors
    }
    console.warn('Failed to load draft from localStorage:', e);
    return null;
  }
}

function clearDraftFromStorage(companyId: string): void {
  try {
    localStorage.removeItem(getStorageKey(companyId));
  } catch (e) {
    console.warn('Failed to clear draft from localStorage:', e);
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useCompanyPricing(): UseCompanyPricingReturn {
  const { toast } = useToast();
  
  // State
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const [originalConfig, setOriginalConfig] = useState<PricingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasDraft, setHasDraft] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  
  // Rate limiting state
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const [saveCountdown, setSaveCountdown] = useState(0);
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  
  // ==========================================================================
  // Online/Offline Detection
  // ==========================================================================
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Verbindung wiederhergestellt',
        description: 'Sie sind wieder online.',
      });
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'Offline',
        description: 'Änderungen werden lokal gespeichert.',
        variant: 'destructive',
      });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);
  
  // ==========================================================================
  // Rate Limiting Countdown
  // ==========================================================================
  
  // Track if countdown is active
  const isCountdownActive = saveCountdown > 0;
  
  useEffect(() => {
    if (!isCountdownActive) {
      // Clear any existing interval when countdown reaches 0
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }
    
    // Start countdown interval
    countdownIntervalRef.current = window.setInterval(() => {
      setSaveCountdown(prev => Math.max(0, prev - 100));
    }, 100);
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isCountdownActive]);
  
  const canSave = useMemo(() => {
    return saveCountdown <= 0 && !isSaving;
  }, [saveCountdown, isSaving]);
  
  // ==========================================================================
  // Memoized Values (must be defined before useEffects that use them)
  // ==========================================================================
  
  const validation = useMemo(
    () => validatePricingConfig(pricingConfig),
    [pricingConfig]
  );
  
  const marketComparison = useMemo(
    () => compareToMarketStandard(pricingConfig),
    [pricingConfig]
  );
  
  const hasUnsavedChanges = useMemo(() => {
    if (!originalConfig) return false;
    return JSON.stringify(pricingConfig) !== JSON.stringify(originalConfig);
  }, [pricingConfig, originalConfig]);
  
  // ==========================================================================
  // Debounced Draft Save
  // ==========================================================================
  
  const debouncedSaveDraft = useDebouncedCallback(
    (companyId: string, config: PricingConfig) => {
      saveDraftToStorage(companyId, config);
      setHasDraft(true);
    },
    AUTO_SAVE_DELAY_MS
  );
  
  // Auto-save draft when config changes
  useEffect(() => {
    if (currentCompanyId && hasUnsavedChanges) {
      debouncedSaveDraft(currentCompanyId, pricingConfig);
    }
  }, [pricingConfig, currentCompanyId, debouncedSaveDraft, hasUnsavedChanges]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);
  
  // ==========================================================================
  // Actions
  // ==========================================================================
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const markAsSaved = useCallback(() => {
    setOriginalConfig(pricingConfig);
    if (currentCompanyId) {
      clearDraftFromStorage(currentCompanyId);
      setHasDraft(false);
    }
  }, [pricingConfig, currentCompanyId]);
  
  /**
   * Discard local draft
   */
  const discardDraft = useCallback((companyId: string) => {
    clearDraftFromStorage(companyId);
    setHasDraft(false);
    if (originalConfig) {
      setPricingConfig(originalConfig);
    }
    toast({
      title: 'Entwurf verworfen',
      description: 'Lokale Änderungen wurden gelöscht.',
    });
  }, [originalConfig, toast]);
  
  /**
   * Restore draft from localStorage
   */
  const restoreDraft = useCallback((companyId: string): boolean => {
    const draft = loadDraftFromStorage(companyId);
    if (draft) {
      setPricingConfig(draft.config);
      toast({
        title: 'Entwurf wiederhergestellt',
        description: `Vom ${draft.savedAt.toLocaleDateString('de-CH')} ${draft.savedAt.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`,
      });
      return true;
    }
    return false;
  }, [toast]);
  
  /**
   * Load company-specific pricing config from database
   */
  const loadConfig = useCallback(async (companyId: string) => {
    if (!companyId) {
      setError('Keine Firma-ID angegeben');
      return;
    }
    
    setCurrentCompanyId(companyId);
    
    // Check for local draft first
    const draft = loadDraftFromStorage(companyId);
    if (draft) {
      setHasDraft(true);
    }
    
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setIsLoading(true);
    setError(null);
    
    // If offline, try to use draft
    if (!navigator.onLine) {
      if (draft) {
        setPricingConfig(draft.config);
        setOriginalConfig(draft.config);
        setIsLoading(false);
        toast({
          title: 'Offline-Modus',
          description: 'Lokaler Entwurf wird verwendet.',
        });
        return;
      }
      setPricingConfig(DEFAULT_PRICING_CONFIG);
      setOriginalConfig(DEFAULT_PRICING_CONFIG);
      setIsLoading(false);
      setError('Offline - Standardwerte werden verwendet');
      return;
    }
    
    try {
      const { data, error: rpcError } = await supabase.rpc('get_company_pricing_config', {
        p_company_id: companyId
      });
      
      if (signal.aborted) return;
      
      if (rpcError) {
        throw new Error(rpcError.message);
      }
      
      if (data) {
        const parseResult = DbPricingConfigSchema.safeParse(data);
        
        if (!parseResult.success) {
          console.error('Invalid pricing config from DB:', parseResult.error);
          setPricingConfig(DEFAULT_PRICING_CONFIG);
          setOriginalConfig(DEFAULT_PRICING_CONFIG);
          setHasCustomConfig(false);
          setError('Konfiguration ungültig. Standardwerte werden verwendet.');
          return;
        }
        
        const config = mapDbToConfig(parseResult.data);
        setPricingConfig(config);
        setOriginalConfig(config);
        setHasCustomConfig(true);
        setLastSaved(parseResult.data.updatedAt ? new Date(parseResult.data.updatedAt) : null);
        
        // Clear draft if DB config is newer
        if (draft && parseResult.data.updatedAt) {
          const dbDate = new Date(parseResult.data.updatedAt);
          if (dbDate > draft.savedAt) {
            clearDraftFromStorage(companyId);
            setHasDraft(false);
          }
        }
      } else {
        setPricingConfig(DEFAULT_PRICING_CONFIG);
        setOriginalConfig(DEFAULT_PRICING_CONFIG);
        setHasCustomConfig(false);
        setLastSaved(null);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      console.error('Error loading pricing config:', err);
      setError(`Fehler beim Laden: ${message}`);
      
      // Fallback to draft if available
      if (draft) {
        setPricingConfig(draft.config);
        setOriginalConfig(draft.config);
        toast({
          title: 'Lokaler Entwurf geladen',
          description: 'Server nicht erreichbar.',
          variant: 'destructive',
        });
      } else {
        setPricingConfig(DEFAULT_PRICING_CONFIG);
        setOriginalConfig(DEFAULT_PRICING_CONFIG);
      }
      setHasCustomConfig(false);
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [toast]);
  
  /**
   * Save pricing config to database with optimistic updates and rate limiting
   */
  const saveConfig = useCallback(async (companyId: string, config: PricingConfig): Promise<boolean> => {
    if (!companyId) {
      setError('Keine Firma-ID angegeben');
      return false;
    }
    
    // Rate limiting check
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTime;
    if (timeSinceLastSave < SAVE_RATE_LIMIT_MS) {
      const remainingMs = SAVE_RATE_LIMIT_MS - timeSinceLastSave;
      setSaveCountdown(remainingMs);
      toast({
        title: 'Bitte warten',
        description: `Sie können in ${Math.ceil(remainingMs / 1000)} Sekunden erneut speichern.`,
      });
      return false;
    }
    
    // Validate before saving
    const { isValid, errors } = validatePricingConfig(config);
    if (!isValid) {
      setError(errors.join(', '));
      toast({
        title: 'Validierungsfehler',
        description: errors.join(', '),
        variant: 'destructive',
      });
      return false;
    }
    
    if (!config.teamRates || config.teamRates.length === 0) {
      setError('Mindestens ein Team-Tarif muss definiert sein');
      toast({
        title: 'Validierungsfehler',
        description: 'Mindestens ein Team-Tarif muss definiert sein',
        variant: 'destructive',
      });
      return false;
    }
    
    // Optimistic update - save to state immediately
    const previousConfig = pricingConfig;
    const previousOriginal = originalConfig;
    setPricingConfig(config);
    setOriginalConfig(config);
    setHasCustomConfig(true);
    setLastSaved(new Date());
    
    // If offline, save to localStorage only
    if (!navigator.onLine) {
      saveDraftToStorage(companyId, config);
      setHasDraft(true);
      toast({
        title: 'Offline gespeichert',
        description: 'Änderungen werden synchronisiert, wenn Sie wieder online sind.',
      });
      return true;
    }
    
    // Fail closed: serialize BEFORE touching the DB. A config with a non-finite value
    // (NaN/Infinity) never reaches the RPC — no upsert, no audit-log row, draft/original
    // config untouched. Valid configs serialize to exactly the same field/value payload.
    const serialized = serializePricingConfig(config);
    if (!serialized.ok) {
      setError('Ungültige Preiskonfiguration – nicht gespeichert.');
      toast({
        title: 'Fehler',
        description: 'Die Preiskonfiguration enthält ungültige Werte und wurde nicht gespeichert.',
        variant: 'destructive',
      });
      return false;
    }

    setIsSaving(true);
    setError(null);
    setLastSaveTime(now);
    setSaveCountdown(SAVE_RATE_LIMIT_MS);

    try {
      const { data: user } = await supabase.auth.getUser();

      const { error: rpcError } = await supabase.rpc('upsert_company_pricing_config', {
        p_company_id: companyId,
        p_config: serialized.value,
        p_user_id: user?.user?.id || null
      });
      
      if (rpcError) {
        throw new Error(rpcError.message);
      }
      
      // Clear draft on successful save
      clearDraftFromStorage(companyId);
      setHasDraft(false);
      
      toast({
        title: 'Gespeichert',
        description: 'Preiskonfiguration wurde erfolgreich gespeichert.',
      });
      
      return true;
    } catch (err) {
      // Rollback optimistic update on error
      setPricingConfig(previousConfig);
      setOriginalConfig(previousOriginal);
      
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      console.error('Error saving pricing config:', err);
      setError(`Fehler beim Speichern: ${message}`);
      
      // Save to localStorage as fallback
      saveDraftToStorage(companyId, config);
      setHasDraft(true);
      
      toast({
        title: 'Fehler beim Speichern',
        description: `${message}. Änderungen wurden lokal gespeichert.`,
        variant: 'destructive',
      });
      
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [toast, pricingConfig, originalConfig, lastSaveTime]);
  
  /**
   * Reset to default configuration
   */
  const resetToDefault = useCallback(() => {
    setPricingConfig(DEFAULT_PRICING_CONFIG);
  }, []);
  
  /**
   * Apply a pricing template
   */
  const applyTemplate = useCallback((templateId: string) => {
    const template = PRICING_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setPricingConfig(template.config);
      toast({
        title: 'Vorlage angewendet',
        description: `"${template.name}" wurde angewendet. Vergessen Sie nicht zu speichern.`,
      });
    } else {
      setError(`Vorlage "${templateId}" nicht gefunden`);
    }
  }, [toast]);
  
  /**
   * Update a single team rate with validation
   */
  const updateTeamRate = useCallback((index: number, rate: Partial<TeamRate>) => {
    setPricingConfig(prev => {
      if (index < 0 || index >= prev.teamRates.length) {
        console.warn('Invalid team rate index:', index);
        return prev;
      }
      
      const updatedRate = { ...prev.teamRates[index], ...rate };
      
      const parseResult = TeamRateSchema.safeParse(updatedRate);
      if (!parseResult.success) {
        console.warn('Invalid team rate update:', parseResult.error);
        return prev;
      }
      
      const validated = toTeamRate(parseResult.data);
      return {
        ...prev,
        teamRates: prev.teamRates.map((r, i) => (i === index ? validated : r)),
      };
    });
  }, []);
  
  /**
   * Add a new team rate
   */
  const addTeamRate = useCallback(() => {
    setPricingConfig(prev => {
      if (prev.teamRates.length >= 10) {
        toast({
          title: 'Limit erreicht',
          description: 'Maximal 10 Team-Tarife möglich.',
          variant: 'destructive',
        });
        return prev;
      }
      
      const lastRate = prev.teamRates[prev.teamRates.length - 1] || { trucks: 1, workers: 1, hourlyRate: 100 };
      const newRate: TeamRate = {
        trucks: Math.min(lastRate.trucks, 5),
        workers: Math.min(lastRate.workers + 1, 20),
        hourlyRate: Math.min(lastRate.hourlyRate + 50, 10000),
        label: `${lastRate.trucks} LKW + ${Math.min(lastRate.workers + 1, 20)} Helfer`,
      };
      
      return {
        ...prev,
        teamRates: [...prev.teamRates, newRate],
      };
    });
  }, [toast]);
  
  /**
   * Remove a team rate (prevents removing the last one)
   */
  const removeTeamRate = useCallback((index: number) => {
    setPricingConfig(prev => {
      if (prev.teamRates.length <= 1) {
        toast({
          title: 'Nicht möglich',
          description: 'Mindestens ein Team-Tarif muss vorhanden sein.',
          variant: 'destructive',
        });
        return prev;
      }
      
      if (index < 0 || index >= prev.teamRates.length) {
        console.warn('Invalid team rate index:', index);
        return prev;
      }
      
      return {
        ...prev,
        teamRates: prev.teamRates.filter((_, i) => i !== index),
      };
    });
  }, [toast]);
  
  /**
   * Update config with partial values (with safe merging)
   */
  const updateConfig = useCallback((patch: PricingConfigPatch) => {
    // Same functional-setState + deep-merge behaviour as before, now in a pure, tested
    // helper. Precedence (DEFAULT → previous → patch) and the deep-merged group allowlist
    // are unchanged, so sibling fields are preserved exactly as before.
    setPricingConfig(prev => mergePricingConfig(prev, patch));
  }, []);
  
  return {
    pricingConfig,
    isLoading,
    isSaving,
    hasCustomConfig,
    lastSaved,
    error,
    isOnline,
    hasDraft,
    validation,
    marketComparison,
    loadConfig,
    saveConfig,
    resetToDefault,
    applyTemplate,
    clearError,
    discardDraft,
    restoreDraft,
    updateTeamRate,
    addTeamRate,
    removeTeamRate,
    updateConfig,
    hasUnsavedChanges,
    markAsSaved,
    canSave,
    saveCountdown,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function mapDbToConfig(db: DbPricingConfig): PricingConfig {
  return {
    currency: db.currency || 'CHF',
    vatRate: db.vatRate ?? 8.1,
    minimumHours: db.minimumHours ?? 4,
    minimumCharge: db.minimumCharge ?? 480,
    teamRates: (db.teamRates || DEFAULT_PRICING_CONFIG.teamRates).map(toTeamRate),
    hourlyRate: db.hourlyRate ?? 60,
    vehiclePrices: {
      transporter: db.vehiclePrices?.transporter ?? 80,
      truck_3_5t: db.vehiclePrices?.truck_3_5t ?? 120,
      truck_7_5t: db.vehiclePrices?.truck_7_5t ?? 180,
      truck_18t: db.vehiclePrices?.truck_18t ?? 250,
    },
    distanceSurchargeRate: db.distanceSurchargeRate ?? 2.5,
    distanceSurchargeThreshold: db.distanceSurchargeThreshold ?? 20,
    surcharges: {
      heavyItemOver100kg: db.surcharges?.heavyItemOver100kg ?? 50,
      pianoUpright: db.surcharges?.pianoUpright ?? 350,
      pianoGrand: db.surcharges?.pianoGrand ?? 650,
      safeSmall: db.surcharges?.safeSmall ?? 150,
      safeLarge: db.surcharges?.safeLarge ?? 350,
      aquarium: db.surcharges?.aquarium ?? 200,
      poolTable: db.surcharges?.poolTable ?? 450,
    },
    floorSurcharges: {
      perFloorWithoutElevator: db.floorSurcharges?.perFloorWithoutElevator ?? 30,
      perFloorWithElevator: db.floorSurcharges?.perFloorWithElevator ?? 10,
      groundFloorBase: db.floorSurcharges?.groundFloorBase ?? 0,
    },
    equipment: {
      moebelliftSingleLocation: db.equipment?.moebelliftSingleLocation ?? 350,
      moebelliftBothLocations: db.equipment?.moebelliftBothLocations ?? 550,
      packingMaterialPerM3: db.equipment?.packingMaterialPerM3 ?? 25,
    },
    packingServiceRate: db.packingServiceRate ?? 45,
    externalLiftCost: db.externalLiftCost ?? 550,
    disposalCost: db.disposalCost ?? 35,
    pianoTransportCost: db.pianoTransportCost ?? 350,
    storageCostPerM3: db.storageCostPerM3 ?? 45,
    multipliers: {
      weekend: db.multipliers?.weekend ?? 1.25,
      evening: db.multipliers?.evening ?? 1.15,
      holiday: db.multipliers?.holiday ?? 1.50,
      express: db.multipliers?.express ?? 1.30,
    },
  };
}

export default useCompanyPricing;
