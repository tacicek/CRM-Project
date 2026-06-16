// =============================================================================
// Firma Preisgestaltung (Pricing Settings) Page
// Allows companies to configure their own pricing for quotes/offers
// 
// FIXES APPLIED:
// - Unsaved changes warning with beforeunload and confirmation
// - Proper input validation with sanitization
// - Stable keys using generated IDs
// - Confirmation dialogs for destructive actions
// - Error state display
// - Accessible form controls
// =============================================================================

import { useEffect, useState, useId, useMemo, useRef, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyPricing } from '@/hooks/useCompanyPricing';
import { fetchSingleCompanyForUser } from '@/lib/fetchSingleCompanyForUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Calculator, 
  Save, 
  RotateCcw, 
  Loader2, 
  Info, 
  AlertTriangle, 
  CheckCircle2,
  Users,
  Truck,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Package,
  Coins,
  XCircle,
  Wifi,
  WifiOff,
  FileText,
  Clock
} from 'lucide-react';
import { PRICING_TEMPLATES, DEFAULT_PRICING_CONFIG } from '@/components/offers/moving-calculator';
import { formatCHF } from '@/components/offers/moving-calculator/calculation-utils';

// =============================================================================
// Input Validation Helpers
// =============================================================================

/**
 * Safely parse a float with bounds checking
 */
function safeParseFloat(
  value: string,
  options: { min?: number; max?: number; fallback: number }
): number {
  const { min = -Infinity, max = Infinity, fallback } = options;
  const parsed = parseFloat(value);
  
  if (isNaN(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  
  return parsed;
}

/**
 * Safely parse an integer with bounds checking
 */
function safeParseInt(
  value: string,
  options: { min?: number; max?: number; fallback: number }
): number {
  const { min = -Infinity, max = Infinity, fallback } = options;
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  
  return parsed;
}

/**
 * Generate stable key for team rate
 * Uses index as primary differentiator to avoid collisions with same trucks/workers combo
 */
function generateTeamRateKey(rate: { trucks: number; workers: number; hourlyRate: number }, index: number): string {
  return `team-${index}-${rate.trucks}-${rate.workers}-${rate.hourlyRate}`;
}

/**
 * Safely parse integer with NaN protection
 */
function safeParseIntPreview(value: string, fallback: number, min = 0, max = Infinity): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || !isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Generate stable key for warning messages
 */
function generateWarningKey(warning: string, index: number): string {
  // Create a simple hash from the warning text
  const hash = warning.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `warning-${index}-${hash}`;
}

// =============================================================================
// Preview Calculator Component
// =============================================================================

interface PreviewCalculatorProps {
  config: typeof DEFAULT_PRICING_CONFIG;
}

const PreviewCalculator = memo(function PreviewCalculator({ config }: PreviewCalculatorProps) {
  // Guard against empty teamRates
  const hasTeamRates = config.teamRates && config.teamRates.length > 0;
  const defaultWorkers = hasTeamRates ? config.teamRates[0].workers : 2;
  
  const [workers, setWorkers] = useState(defaultWorkers);
  const [hours, setHours] = useState(5);
  const [isWeekend, setIsWeekend] = useState(false);
  const [hasPiano, setHasPiano] = useState(false);
  const [heavyItems, setHeavyItems] = useState(0);
  const [floors, setFloors] = useState(0);
  const [hasElevator, setHasElevator] = useState(true);

  // Calculate price based on inputs
  const calculation = useMemo(() => {
    // Guard against empty teamRates
    if (!config.teamRates || config.teamRates.length === 0) {
      return {
        teamLabel: 'Kein Team-Tarif definiert',
        hourlyRate: 0,
        effectiveHours: config.minimumHours || 4,
        laborCost: 0,
        pianoCost: 0,
        heavyItemCost: 0,
        floorCost: 0,
        subtotal: 0,
        weekendMultiplier: 1,
        vat: 0,
        vatRate: config.vatRate || 8.1,
        total: 0,
      };
    }
    
    // Find matching team rate - with null safety
    const teamRate = config.teamRates.find(r => r.workers === workers) ||
      config.teamRates.find(r => r.workers >= workers) ||
      config.teamRates[config.teamRates.length - 1];
    
    // Additional null safety
    if (!teamRate) {
      return {
        teamLabel: 'Kein passender Tarif',
        hourlyRate: 0,
        effectiveHours: config.minimumHours || 4,
        laborCost: 0,
        pianoCost: 0,
        heavyItemCost: 0,
        floorCost: 0,
        subtotal: 0,
        weekendMultiplier: 1,
        vat: 0,
        vatRate: config.vatRate || 8.1,
        total: 0,
      };
    }
    
    const hourlyRate = teamRate.hourlyRate || 0;
    const minimumHours = config.minimumHours || 4;
    const effectiveHours = Math.max(hours, minimumHours);
    
    // Base labor cost
    const laborCost = hourlyRate * effectiveHours;
    
    // Surcharges - with null safety
    const pianoCost = hasPiano ? (config.surcharges?.pianoUpright ?? 350) : 0;
    const heavyItemCost = Math.max(0, heavyItems) * (config.surcharges?.heavyItemOver100kg ?? 50);
    const floorCost = hasElevator 
      ? Math.max(0, floors) * (config.floorSurcharges?.perFloorWithElevator ?? 10)
      : Math.max(0, floors) * (config.floorSurcharges?.perFloorWithoutElevator ?? 30);
    
    // Subtotal
    let subtotal = laborCost + pianoCost + heavyItemCost + floorCost;
    
    // Apply minimum charge
    subtotal = Math.max(subtotal, config.minimumCharge || 0);
    
    // Apply weekend multiplier - ensure it's at least 1
    const weekendMultiplier = isWeekend ? Math.max(1, config.multipliers?.weekend ?? 1.25) : 1;
    subtotal = subtotal * weekendMultiplier;
    
    // VAT - guard against invalid values
    const vatRate = Math.max(0, Math.min(30, config.vatRate ?? 8.1));
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;
    
    return {
      teamLabel: teamRate.label || `${teamRate.trucks || 1} LKW + ${workers} Helfer`,
      hourlyRate,
      effectiveHours,
      laborCost,
      pianoCost,
      heavyItemCost,
      floorCost,
      subtotal,
      weekendMultiplier,
      vat,
      vatRate,
      total,
    };
  }, [config, workers, hours, isWeekend, hasPiano, heavyItems, floors, hasElevator]);
  
  // If no team rates, show warning
  if (!hasTeamRates) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-center">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
        <p>Kein Team-Tarif definiert. Bitte fügen Sie mindestens einen Tarif hinzu.</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {/* Input Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label htmlFor="preview-workers" className="text-xs">Anzahl Helfer</Label>
          <select
            id="preview-workers"
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={workers}
            onChange={(e) => setWorkers(safeParseIntPreview(e.target.value, defaultWorkers, 1, 20))}
            aria-label="Anzahl Helfer auswählen"
          >
            {config.teamRates.map((rate, idx) => (
              <option key={`worker-option-${idx}-${rate.workers}`} value={rate.workers}>
                {rate.workers} Helfer
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="preview-hours" className="text-xs">Stunden</Label>
          <Input
            id="preview-hours"
            type="number"
            min={1}
            max={24}
            value={hours}
            onChange={(e) => setHours(safeParseIntPreview(e.target.value, 5, 1, 24))}
            className="h-9"
            aria-label="Anzahl Stunden"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="preview-floors" className="text-xs">Stockwerke</Label>
          <Input
            id="preview-floors"
            type="number"
            min={0}
            max={20}
            value={floors}
            onChange={(e) => setFloors(safeParseIntPreview(e.target.value, 0, 0, 20))}
            className="h-9"
            aria-label="Anzahl Stockwerke"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="preview-heavy" className="text-xs">Schwere Gegenstände</Label>
          <Input
            id="preview-heavy"
            type="number"
            min={0}
            max={10}
            value={heavyItems}
            onChange={(e) => setHeavyItems(safeParseIntPreview(e.target.value, 0, 0, 10))}
            className="h-9"
            aria-label="Anzahl schwerer Gegenstände"
          />
        </div>
      </div>

      {/* Checkboxes with better accessibility */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isWeekend}
            onChange={(e) => setIsWeekend(e.target.checked)}
            className="rounded border-gray-300 w-4 h-4 focus:ring-2 focus:ring-primary"
            aria-label="Wochenende Zuschlag aktivieren"
          />
          <span>Wochenende (+{Math.round(((config.multipliers?.weekend ?? 1.25) - 1) * 100)}%)</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={hasPiano}
            onChange={(e) => setHasPiano(e.target.checked)}
            className="rounded border-gray-300 w-4 h-4 focus:ring-2 focus:ring-primary"
            aria-label="Klavier Zuschlag aktivieren"
          />
          <span>Klavier (+{formatCHF(config.surcharges?.pianoUpright ?? 350)})</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={hasElevator}
            onChange={(e) => setHasElevator(e.target.checked)}
            className="rounded border-gray-300 w-4 h-4 focus:ring-2 focus:ring-primary"
            aria-label="Lift vorhanden"
          />
          <span>Lift vorhanden</span>
        </label>
      </div>

      <Separator />

      {/* Calculation Breakdown */}
      <div className="p-4 rounded-lg bg-primary/5 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Team:</span>
          <span className="font-medium">{calculation.teamLabel}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Stundensatz:</span>
          <span>{formatCHF(calculation.hourlyRate)}/Std</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Arbeitszeit:</span>
          <span>{calculation.effectiveHours}h {hours < (config.minimumHours || 4) && <span className="text-amber-600">(Min. {config.minimumHours}h)</span>}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Arbeitskosten:</span>
          <span>{formatCHF(calculation.laborCost)}</span>
        </div>
        
        {calculation.pianoCost > 0 && (
          <div className="flex justify-between text-sm text-amber-600">
            <span>+ Klavier:</span>
            <span>{formatCHF(calculation.pianoCost)}</span>
          </div>
        )}
        {calculation.heavyItemCost > 0 && (
          <div className="flex justify-between text-sm text-amber-600">
            <span>+ Schwerlast ({heavyItems}×):</span>
            <span>{formatCHF(calculation.heavyItemCost)}</span>
          </div>
        )}
        {calculation.floorCost > 0 && (
          <div className="flex justify-between text-sm text-amber-600">
            <span>+ Stockwerk ({floors}. OG, {hasElevator ? 'mit' : 'ohne'} Lift):</span>
            <span>{formatCHF(calculation.floorCost)}</span>
          </div>
        )}
        
        <Separator />
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Zwischensumme:</span>
          <span>{formatCHF(calculation.subtotal / calculation.weekendMultiplier)}</span>
        </div>
        
        {isWeekend && (
          <div className="flex justify-between text-sm text-blue-600">
            <span>× Wochenende ({calculation.weekendMultiplier}×):</span>
            <span>{formatCHF(calculation.subtotal)}</span>
          </div>
        )}
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">+ MwSt. ({calculation.vatRate}%):</span>
          <span>{formatCHF(calculation.vat)}</span>
        </div>
        
        <Separator className="border-primary" />
        
        <div className="flex justify-between text-lg font-bold">
          <span>Gesamtbetrag:</span>
          <span className="text-primary">{formatCHF(calculation.total)}</span>
        </div>
      </div>

      {/* Market comparison hint */}
      <div className="text-xs text-muted-foreground text-center">
        Delta Umzug Referenz: {workers} Helfer × {hours}h = ca. {formatCHF(
          (DEFAULT_PRICING_CONFIG.teamRates.find(r => r.workers === workers)?.hourlyRate ?? 180) * 
          Math.max(hours, 4) * 1.081
        )} (inkl. MwSt.)
      </div>
    </div>
    </>
  );
});

// =============================================================================
// Component
// =============================================================================

export default function FirmaPreisgestaltung() {
  const { user } = useAuth();
  const instanceId = useId(); // Stable ID for form controls
  
  // Company state - fetch from database like other firma pages
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isCompanyLoading, setIsCompanyLoading] = useState(true);
  
  // Refs for async safety
  const companyAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      companyAbortRef.current?.abort();
    };
  }, []);
  
  const {
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
  } = useCompanyPricing();
  
  const [activeTab, setActiveTab] = useState('team');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState<string | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  
  // Fetch company data on mount
  useEffect(() => {
    const fetchCompany = async () => {
      if (!user) {
        if (isMountedRef.current) {
          setIsCompanyLoading(false);
        }
        return;
      }
      
      // Cancel any previous request
      companyAbortRef.current?.abort();
      companyAbortRef.current = new AbortController();
      
      try {
        const company = await fetchSingleCompanyForUser<{ id: string }>({
          userId: user.id,
          userEmail: user.email,
          select: 'id',
        });
        
        // Check if still mounted before updating state
        if (!isMountedRef.current) return;
        
        if (company) {
          setCompanyId(company.id);
        }
      } catch (error) {
        // Don't log abort errors
        if (error instanceof Error && error.name === 'AbortError') return;
        if (!isMountedRef.current) return;
        
        console.error('Error fetching company:', error);
      } finally {
        if (isMountedRef.current) {
          setIsCompanyLoading(false);
        }
      }
    };
    
    fetchCompany();
  }, [user]);
  
  // Load pricing config when companyId is available
  useEffect(() => {
    if (companyId) {
      loadConfig(companyId);
    }
  }, [companyId, loadConfig]);
  
  // Show draft dialog on load if draft exists
  useEffect(() => {
    if (hasDraft && !isLoading && !isCompanyLoading && companyId) {
      setShowDraftDialog(true);
    }
  }, [hasDraft, isLoading, isCompanyLoading, companyId]);
  
  // Warn before leaving with unsaved changes (browser tab close/refresh)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    if (companyId) {
      const success = await saveConfig(companyId, pricingConfig);
      if (success) {
        markAsSaved();
      }
    }
  };
  
  const handleResetConfirm = () => {
    resetToDefault();
    setShowResetDialog(false);
  };
  
  const handleTemplateConfirm = () => {
    if (showTemplateDialog) {
      applyTemplate(showTemplateDialog);
    }
    setShowTemplateDialog(null);
  };
  
  const handleTemplateClick = (templateId: string) => {
    if (hasUnsavedChanges) {
      setShowTemplateDialog(templateId);
    } else {
      applyTemplate(templateId);
    }
  };

  // Calculate example prices for preview (memoized)
  const examplePrices = useMemo(() => {
    // Guard against empty teamRates
    if (!pricingConfig.teamRates || pricingConfig.teamRates.length === 0) {
      const emptyResult = { net: 0, gross: 0, rate: null };
      return {
        small: emptyResult,
        medium: emptyResult,
        large: emptyResult,
      };
    }
    
    const calculatePrice = (workers: number, hours: number) => {
      const rate = pricingConfig.teamRates.find(r => r.workers === workers) || 
                   pricingConfig.teamRates[0];
      if (!rate) {
        return { net: 0, gross: 0, rate: null };
      }
      const basePrice = rate.hourlyRate * hours;
      const vatRate = Math.max(0, pricingConfig.vatRate ?? 8.1);
      const withVat = basePrice * (1 + vatRate / 100);
      return { net: basePrice, gross: withVat, rate };
    };
    
    const minimumHours = Math.max(1, pricingConfig.minimumHours ?? 4);
    
    return {
      small: calculatePrice(2, minimumHours),
      medium: calculatePrice(3, 6),
      large: calculatePrice(5, 8),
    };
  }, [pricingConfig.teamRates, pricingConfig.vatRate, pricingConfig.minimumHours]);
  
  // Helper to get min/max team rates safely
  const teamRateBounds = useMemo(() => {
    if (!pricingConfig.teamRates || pricingConfig.teamRates.length === 0) {
      return { min: 0, max: 0 };
    }
    const rates = pricingConfig.teamRates.map(r => r.hourlyRate);
    return {
      min: Math.min(...rates),
      max: Math.max(...rates),
    };
  }, [pricingConfig.teamRates]);

  return (
    <>
      <Helmet>
        <title>Preisgestaltung | Firma</title>
      </Helmet>
        <div className="space-y-6">
          {/* Folk-style header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="text-4xl leading-none">💰</span>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Preisgestaltung</h1>
              <p className="mt-1 text-[15px] text-folk-ink2">
                Preise für Offerten und Kalkulationen konfigurieren — Stundensätze, Aufschläge, Standards.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(true)}
                disabled={isLoading || isSaving || isCompanyLoading}
                className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Zurücksetzen
              </Button>
              <Button
                onClick={handleSave}
                disabled={!canSave || isLoading || isCompanyLoading || !companyId || !hasUnsavedChanges}
                className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2 disabled:opacity-40"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saveCountdown > 0 ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saveCountdown > 0 ? `Warten (${Math.ceil(saveCountdown / 1000)}s)` : 'Speichern'}
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Fehler</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="ghost" size="sm" onClick={clearError}>
                  Schliessen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            {/* Online/Offline Status */}
            {isOnline ? (
              <Badge variant="outline" className="border-green-500 text-green-600">
                <Wifi className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            
            {/* Draft Indicator */}
            {hasDraft && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <FileText className="h-3 w-3 mr-1" />
                Lokaler Entwurf vorhanden
              </Badge>
            )}
            
            {/* Unsaved Changes */}
            {hasUnsavedChanges && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Ungespeicherte Änderungen
              </Badge>
            )}
            
            {/* Custom Config Status */}
            {hasCustomConfig ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Eigene Konfiguration aktiv
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Info className="h-3 w-3 mr-1" />
                Standard-Preise (Marktüblich)
              </Badge>
            )}
            
            {/* Last Saved */}
            {lastSaved && (
              <Badge variant="outline">
                Zuletzt gespeichert: {lastSaved.toLocaleDateString('de-CH')} {lastSaved.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            )}
          </div>

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <Alert variant="default" className="border-amber-500 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Hinweise</AlertTitle>
              <AlertDescription className="text-amber-700">
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {validation.warnings.map((warning, i) => (
                    <li key={generateWarningKey(warning, i)}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Market Comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Marktvergleich
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Kleines Team (2 Helfer)</div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatCHF(marketComparison.smallTeamComparison.yours)}/Std</span>
                    <div className="flex items-center gap-1">
                      {marketComparison.smallTeamComparison.diff > 0 ? (
                        <TrendingUp className="h-3 w-3 text-amber-500" />
                      ) : marketComparison.smallTeamComparison.diff < 0 ? (
                        <TrendingDown className="h-3 w-3 text-green-500" />
                      ) : null}
                      <span className={`text-xs ${
                        marketComparison.smallTeamComparison.diff > 0 ? 'text-amber-500' : 
                        marketComparison.smallTeamComparison.diff < 0 ? 'text-green-500' : 
                        'text-muted-foreground'
                      }`}>
                        {marketComparison.smallTeamComparison.diffPercent > 0 ? '+' : ''}
                        {marketComparison.smallTeamComparison.diffPercent}% vs. Markt
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Grosses Team (5 Helfer)</div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatCHF(marketComparison.largeTeamComparison.yours)}/Std</span>
                    <div className="flex items-center gap-1">
                      {marketComparison.largeTeamComparison.diff > 0 ? (
                        <TrendingUp className="h-3 w-3 text-amber-500" />
                      ) : marketComparison.largeTeamComparison.diff < 0 ? (
                        <TrendingDown className="h-3 w-3 text-green-500" />
                      ) : null}
                      <span className={`text-xs ${
                        marketComparison.largeTeamComparison.diff > 0 ? 'text-amber-500' : 
                        marketComparison.largeTeamComparison.diff < 0 ? 'text-green-500' : 
                        'text-muted-foreground'
                      }`}>
                        {marketComparison.largeTeamComparison.diffPercent > 0 ? '+' : ''}
                        {marketComparison.largeTeamComparison.diffPercent}% vs. Markt
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Marktstandard basiert auf Delta Umzug Preisen (120-420 CHF/Std)
              </p>
            </CardContent>
          </Card>

          {/* Template Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Vorlage auswählen</CardTitle>
              <CardDescription className="text-xs">
                Starten Sie mit einer vorgefertigten Preiskonfiguration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PRICING_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateClick(template.id)}
                    className={`p-3 rounded-lg border text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                      template.isMarketStandard ? 'border-green-500 bg-green-50' : ''
                    }`}
                    disabled={isLoading || isSaving || isCompanyLoading}
                    aria-label={`Vorlage "${template.name}" anwenden`}
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{template.description}</div>
                    {template.isMarketStandard && (
                      <Badge variant="secondary" className="mt-2 text-[10px]">Empfohlen</Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Configuration Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="team" className="text-xs sm:text-sm">
                <Users className="h-4 w-4 mr-1 hidden sm:inline" />
                Team-Preise
              </TabsTrigger>
              <TabsTrigger value="surcharges" className="text-xs sm:text-sm">
                <Package className="h-4 w-4 mr-1 hidden sm:inline" />
                Zuschläge
              </TabsTrigger>
              <TabsTrigger value="services" className="text-xs sm:text-sm">
                <Coins className="h-4 w-4 mr-1 hidden sm:inline" />
                Services
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs sm:text-sm">
                <Calculator className="h-4 w-4 mr-1 hidden sm:inline" />
                Vorschau
              </TabsTrigger>
            </TabsList>

            {/* Team Rates Tab */}
            <TabsContent value="team" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Team-Stundenpreise
                  </CardTitle>
                  <CardDescription>
                    Definieren Sie Ihre Stundenpreise für verschiedene Team-Konfigurationen.
                    Der Preis beinhaltet Fahrzeug + Helfer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Basic Settings */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor={`${instanceId}-vatRate`}>MwSt. (%)</Label>
                      <Input
                        id={`${instanceId}-vatRate`}
                        type="number"
                        step="0.1"
                        min="0"
                        max="30"
                        value={pricingConfig.vatRate}
                        onChange={(e) => updateConfig({ 
                          vatRate: safeParseFloat(e.target.value, { min: 0, max: 30, fallback: 8.1 }) 
                        })}
                        className="mt-1"
                        aria-describedby={`${instanceId}-vatRate-hint`}
                      />
                      <p id={`${instanceId}-vatRate-hint`} className="text-xs text-muted-foreground mt-1">
                        Schweiz: 8.1%
                      </p>
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-minHours`}>Min. Stunden</Label>
                      <Input
                        id={`${instanceId}-minHours`}
                        type="number"
                        min="1"
                        max="12"
                        value={pricingConfig.minimumHours}
                        onChange={(e) => updateConfig({ 
                          minimumHours: safeParseInt(e.target.value, { min: 1, max: 12, fallback: 4 }) 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-minCharge`}>Min. Auftrag (CHF)</Label>
                      <Input
                        id={`${instanceId}-minCharge`}
                        type="number"
                        min="0"
                        max="10000"
                        step="50"
                        value={pricingConfig.minimumCharge}
                        onChange={(e) => updateConfig({ 
                          minimumCharge: safeParseFloat(e.target.value, { min: 0, max: 10000, fallback: 480 }) 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-distThreshold`}>Distanz-Schwelle (km)</Label>
                      <Input
                        id={`${instanceId}-distThreshold`}
                        type="number"
                        min="0"
                        max="500"
                        value={pricingConfig.distanceSurchargeThreshold}
                        onChange={(e) => updateConfig({ 
                          distanceSurchargeThreshold: safeParseInt(e.target.value, { min: 0, max: 500, fallback: 20 }) 
                        })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Team Rates */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Team-Tarife</Label>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={addTeamRate}
                        disabled={pricingConfig.teamRates.length >= 10}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Hinzufügen
                      </Button>
                    </div>
                    
                    {pricingConfig.teamRates.map((rate, index) => (
                      <div 
                        key={generateTeamRateKey(rate, index)} 
                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex-1 grid grid-cols-4 gap-3">
                          <div>
                            <Label 
                              htmlFor={`${instanceId}-rate-${index}-trucks`}
                              className="text-xs"
                            >
                              LKW
                            </Label>
                            <Input
                              id={`${instanceId}-rate-${index}-trucks`}
                              type="number"
                              min="1"
                              max="5"
                              value={rate.trucks}
                              onChange={(e) => {
                                const trucks = safeParseInt(e.target.value, { min: 1, max: 5, fallback: 1 });
                                updateTeamRate(index, { 
                                  trucks,
                                  label: `${trucks} LKW + ${rate.workers} Helfer`
                                });
                              }}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label 
                              htmlFor={`${instanceId}-rate-${index}-workers`}
                              className="text-xs"
                            >
                              Helfer
                            </Label>
                            <Input
                              id={`${instanceId}-rate-${index}-workers`}
                              type="number"
                              min="1"
                              max="10"
                              value={rate.workers}
                              onChange={(e) => {
                                const workers = safeParseInt(e.target.value, { min: 1, max: 10, fallback: 1 });
                                updateTeamRate(index, { 
                                  workers,
                                  label: `${rate.trucks} LKW + ${workers} Helfer`
                                });
                              }}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label 
                              htmlFor={`${instanceId}-rate-${index}-hourly`}
                              className="text-xs"
                            >
                              CHF/Std
                            </Label>
                            <Input
                              id={`${instanceId}-rate-${index}-hourly`}
                              type="number"
                              min="50"
                              max="1000"
                              step="10"
                              value={rate.hourlyRate}
                              onChange={(e) => updateTeamRate(index, { 
                                hourlyRate: safeParseFloat(e.target.value, { min: 50, max: 1000, fallback: 100 }) 
                              })}
                              className="h-8"
                            />
                          </div>
                          <div className="flex items-end">
                            <Badge variant="outline" className="h-8 flex items-center text-xs">
                              {rate.label || `${rate.trucks} LKW + ${rate.workers} Helfer`}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTeamRate(index)}
                          disabled={pricingConfig.teamRates.length <= 1}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Team-Tarif ${rate.label || `${rate.trucks} LKW + ${rate.workers} Helfer`} entfernen`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    {pricingConfig.teamRates.length === 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Kein Team-Tarif</AlertTitle>
                        <AlertDescription>
                          Mindestens ein Team-Tarif muss definiert sein.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Surcharges Tab */}
            <TabsContent value="surcharges" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Spezielle Zuschläge</CardTitle>
                  <CardDescription>
                    Zusätzliche Kosten für schwere oder spezielle Gegenstände
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`${instanceId}-piano`}>Klavier (CHF)</Label>
                      <Input
                        id={`${instanceId}-piano`}
                        type="number"
                        min="0"
                        max="5000"
                        value={pricingConfig.surcharges?.pianoUpright ?? 350}
                        onChange={(e) => updateConfig({ 
                          surcharges: { pianoUpright: safeParseFloat(e.target.value, { min: 0, max: 5000, fallback: 350 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-grandPiano`}>Flügel (CHF)</Label>
                      <Input
                        id={`${instanceId}-grandPiano`}
                        type="number"
                        min="0"
                        max="5000"
                        value={pricingConfig.surcharges?.pianoGrand ?? 650}
                        onChange={(e) => updateConfig({ 
                          surcharges: { pianoGrand: safeParseFloat(e.target.value, { min: 0, max: 5000, fallback: 650 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-safeSmall`}>Tresor klein (CHF)</Label>
                      <Input
                        id={`${instanceId}-safeSmall`}
                        type="number"
                        min="0"
                        max="2000"
                        value={pricingConfig.surcharges?.safeSmall ?? 150}
                        onChange={(e) => updateConfig({ 
                          surcharges: { safeSmall: safeParseFloat(e.target.value, { min: 0, max: 2000, fallback: 150 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-safeLarge`}>Tresor gross (CHF)</Label>
                      <Input
                        id={`${instanceId}-safeLarge`}
                        type="number"
                        min="0"
                        max="2000"
                        value={pricingConfig.surcharges?.safeLarge ?? 350}
                        onChange={(e) => updateConfig({ 
                          surcharges: { safeLarge: safeParseFloat(e.target.value, { min: 0, max: 2000, fallback: 350 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-heavy`}>Schwerlast &gt;100kg (CHF)</Label>
                      <Input
                        id={`${instanceId}-heavy`}
                        type="number"
                        min="0"
                        max="500"
                        value={pricingConfig.surcharges?.heavyItemOver100kg ?? 50}
                        onChange={(e) => updateConfig({ 
                          surcharges: { heavyItemOver100kg: safeParseFloat(e.target.value, { min: 0, max: 500, fallback: 50 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-pool`}>Billardtisch (CHF)</Label>
                      <Input
                        id={`${instanceId}-pool`}
                        type="number"
                        min="0"
                        max="2000"
                        value={pricingConfig.surcharges?.poolTable ?? 450}
                        onChange={(e) => updateConfig({ 
                          surcharges: { poolTable: safeParseFloat(e.target.value, { min: 0, max: 2000, fallback: 450 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Stockwerk-Zuschläge</CardTitle>
                  <CardDescription>
                    Zusatzkosten basierend auf Stockwerk und Lift-Verfügbarkeit
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`${instanceId}-floorNoLift`}>Pro Stockwerk ohne Lift (CHF)</Label>
                      <Input
                        id={`${instanceId}-floorNoLift`}
                        type="number"
                        min="0"
                        max="200"
                        value={pricingConfig.floorSurcharges?.perFloorWithoutElevator ?? 30}
                        onChange={(e) => updateConfig({ 
                          floorSurcharges: { 
                            perFloorWithoutElevator: safeParseFloat(e.target.value, { min: 0, max: 200, fallback: 30 }) 
                          } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-floorLift`}>Pro Stockwerk mit Lift (CHF)</Label>
                      <Input
                        id={`${instanceId}-floorLift`}
                        type="number"
                        min="0"
                        max="100"
                        value={pricingConfig.floorSurcharges?.perFloorWithElevator ?? 10}
                        onChange={(e) => updateConfig({ 
                          floorSurcharges: { 
                            perFloorWithElevator: safeParseFloat(e.target.value, { min: 0, max: 100, fallback: 10 }) 
                          } 
                        })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Zeit-Multiplikatoren</CardTitle>
                  <CardDescription>
                    Preisaufschläge für spezielle Zeiten (z.B. 1.25 = +25%)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor={`${instanceId}-weekend`}>Wochenende (×)</Label>
                      <Input
                        id={`${instanceId}-weekend`}
                        type="number"
                        step="0.05"
                        min="1"
                        max="3"
                        value={pricingConfig.multipliers?.weekend ?? 1.25}
                        onChange={(e) => updateConfig({ 
                          multipliers: { weekend: safeParseFloat(e.target.value, { min: 1, max: 3, fallback: 1.25 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-evening`}>Abend (×)</Label>
                      <Input
                        id={`${instanceId}-evening`}
                        type="number"
                        step="0.05"
                        min="1"
                        max="3"
                        value={pricingConfig.multipliers?.evening ?? 1.15}
                        onChange={(e) => updateConfig({ 
                          multipliers: { evening: safeParseFloat(e.target.value, { min: 1, max: 3, fallback: 1.15 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-holiday`}>Feiertag (×)</Label>
                      <Input
                        id={`${instanceId}-holiday`}
                        type="number"
                        step="0.05"
                        min="1"
                        max="3"
                        value={pricingConfig.multipliers?.holiday ?? 1.50}
                        onChange={(e) => updateConfig({ 
                          multipliers: { holiday: safeParseFloat(e.target.value, { min: 1, max: 3, fallback: 1.50 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-express`}>Express (×)</Label>
                      <Input
                        id={`${instanceId}-express`}
                        type="number"
                        step="0.05"
                        min="1"
                        max="3"
                        value={pricingConfig.multipliers?.express ?? 1.30}
                        onChange={(e) => updateConfig({ 
                          multipliers: { express: safeParseFloat(e.target.value, { min: 1, max: 3, fallback: 1.30 }) } 
                        })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Zusatzleistungen</CardTitle>
                  <CardDescription>
                    Preise für optionale Services
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`${instanceId}-packing`}>Verpackung (CHF/m³)</Label>
                      <Input
                        id={`${instanceId}-packing`}
                        type="number"
                        min="0"
                        max="500"
                        value={pricingConfig.packingServiceRate}
                        onChange={(e) => updateConfig({ 
                          packingServiceRate: safeParseFloat(e.target.value, { min: 0, max: 500, fallback: 45 }) 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-liftSingle`}>Möbellift 1× (CHF)</Label>
                      <Input
                        id={`${instanceId}-liftSingle`}
                        type="number"
                        min="0"
                        max="2000"
                        value={pricingConfig.equipment?.moebelliftSingleLocation ?? 350}
                        onChange={(e) => updateConfig({ 
                          equipment: { 
                            moebelliftSingleLocation: safeParseFloat(e.target.value, { min: 0, max: 2000, fallback: 350 }) 
                          } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-liftDouble`}>Möbellift 2× (CHF)</Label>
                      <Input
                        id={`${instanceId}-liftDouble`}
                        type="number"
                        min="0"
                        max="2000"
                        value={pricingConfig.equipment?.moebelliftBothLocations ?? 550}
                        onChange={(e) => updateConfig({ 
                          equipment: { 
                            moebelliftBothLocations: safeParseFloat(e.target.value, { min: 0, max: 2000, fallback: 550 }) 
                          } 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-disposal`}>Entsorgung (CHF/m³)</Label>
                      <Input
                        id={`${instanceId}-disposal`}
                        type="number"
                        min="0"
                        max="500"
                        value={pricingConfig.disposalCost}
                        onChange={(e) => updateConfig({ 
                          disposalCost: safeParseFloat(e.target.value, { min: 0, max: 500, fallback: 35 }) 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-storage`}>Lagerung (CHF/m³/Mt)</Label>
                      <Input
                        id={`${instanceId}-storage`}
                        type="number"
                        min="0"
                        max="500"
                        value={pricingConfig.storageCostPerM3}
                        onChange={(e) => updateConfig({ 
                          storageCostPerM3: safeParseFloat(e.target.value, { min: 0, max: 500, fallback: 45 }) 
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${instanceId}-distance`}>Distanz-Zuschlag (CHF/km)</Label>
                      <Input
                        id={`${instanceId}-distance`}
                        type="number"
                        step="0.5"
                        min="0"
                        max="20"
                        value={pricingConfig.distanceSurchargeRate}
                        onChange={(e) => updateConfig({ 
                          distanceSurchargeRate: safeParseFloat(e.target.value, { min: 0, max: 20, fallback: 2.5 }) 
                        })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-4">
              {/* Interactive Calculator Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Interaktive Preisvorschau
                  </CardTitle>
                  <CardDescription>
                    Testen Sie Ihre Preise mit verschiedenen Szenarien
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PreviewCalculator config={pricingConfig} />
                </CardContent>
              </Card>

              {/* Standard Scenario Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Standardszenarien</CardTitle>
                  <CardDescription>
                    Beispielrechnungen basierend auf Ihrer Konfiguration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Szenario</th>
                          <th className="text-right py-3 px-2">Team</th>
                          <th className="text-right py-3 px-2">Stunden</th>
                          <th className="text-right py-3 px-2">Netto</th>
                          <th className="text-right py-3 px-2">inkl. MwSt.</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-3 px-2">
                            <div className="font-medium">Kleiner Umzug</div>
                            <div className="text-xs text-muted-foreground">Studio/1-Zimmer</div>
                          </td>
                          <td className="text-right py-3 px-2">2 Helfer</td>
                          <td className="text-right py-3 px-2">{pricingConfig.minimumHours}h (Min.)</td>
                          <td className="text-right py-3 px-2">{formatCHF(examplePrices.small.net)}</td>
                          <td className="text-right py-3 px-2 font-medium">{formatCHF(examplePrices.small.gross)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-3 px-2">
                            <div className="font-medium">Mittlerer Umzug</div>
                            <div className="text-xs text-muted-foreground">3.5-Zimmer</div>
                          </td>
                          <td className="text-right py-3 px-2">3 Helfer</td>
                          <td className="text-right py-3 px-2">6h</td>
                          <td className="text-right py-3 px-2">{formatCHF(examplePrices.medium.net)}</td>
                          <td className="text-right py-3 px-2 font-medium">{formatCHF(examplePrices.medium.gross)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-3 px-2">
                            <div className="font-medium">Grosser Umzug</div>
                            <div className="text-xs text-muted-foreground">5+ Zimmer</div>
                          </td>
                          <td className="text-right py-3 px-2">5 Helfer</td>
                          <td className="text-right py-3 px-2">8h</td>
                          <td className="text-right py-3 px-2">{formatCHF(examplePrices.large.net)}</td>
                          <td className="text-right py-3 px-2 font-medium text-primary">{formatCHF(examplePrices.large.gross)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                    <strong>Hinweis:</strong> Diese Beispiele zeigen nur die Basis-Teamkosten. 
                    Zuschläge für Stockwerk, Distanz, Klavier etc. werden separat berechnet.
                  </div>
                </CardContent>
              </Card>

              {/* Team Rate Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Ihre Tarif-Übersicht</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {pricingConfig.teamRates.map((rate, index) => (
                      <div key={generateTeamRateKey(rate, index)} className="p-3 rounded-lg border bg-card">
                        <div className="font-medium text-sm">{rate.label || `${rate.trucks} LKW + ${rate.workers} Helfer`}</div>
                        <div className="text-2xl font-bold text-primary mt-1">
                          {formatCHF(rate.hourlyRate)}
                          <span className="text-sm font-normal text-muted-foreground">/Std</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Calculation Formula Explanation */}
              <Card>
                <CardHeader>
                  <CardTitle>Berechnungsformel</CardTitle>
                  <CardDescription>So werden Ihre Offerten berechnet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/30 font-mono text-sm space-y-2">
                    <div className="flex justify-between">
                      <span>Basispreis</span>
                      <span>= Team-Stundenpreis × Stunden (min. {pricingConfig.minimumHours}h)</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ Zuschläge</span>
                      <span>Stockwerk, Klavier, Schwerlast, etc.</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ Services</span>
                      <span>Verpackung, Entsorgung, Lagerung</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span>Zwischensumme</span>
                      <span>(mind. {formatCHF(pricingConfig.minimumCharge)})</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>× Multiplikatoren</span>
                      <span>Wochenende (+{((pricingConfig.multipliers?.weekend || 1) - 1) * 100}%), Abend (+{((pricingConfig.multipliers?.evening || 1) - 1) * 100}%)</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span>+ MwSt.</span>
                      <span>{pricingConfig.vatRate}%</span>
                    </div>
                    <Separator className="border-primary" />
                    <div className="flex justify-between font-bold text-primary">
                      <span>= Gesamtbetrag</span>
                      <span></span>
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Delta Umzug Referenz</AlertTitle>
                    <AlertDescription className="text-xs">
                      Schweizer Marktstandard: 120-420 CHF/Std je nach Team-Grösse. 
                      Ihre aktuellen Preise: {formatCHF(teamRateBounds.min)} - {formatCHF(teamRateBounds.max)}/Std
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      
      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preise zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Ihre Preiseinstellungen werden auf die Standardwerte (Marktüblich) zurückgesetzt.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfirm}>
              Zurücksetzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Template Confirmation Dialog */}
      <AlertDialog open={!!showTemplateDialog} onOpenChange={() => setShowTemplateDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage anwenden?</AlertDialogTitle>
            <AlertDialogDescription>
              Sie haben ungespeicherte Änderungen. Wenn Sie eine Vorlage anwenden, gehen diese verloren.
              Möchten Sie fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleTemplateConfirm}>
              Vorlage anwenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      
      {/* Draft Restore Dialog */}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Lokaler Entwurf gefunden
            </AlertDialogTitle>
            <AlertDialogDescription>
              Es gibt einen nicht gespeicherten Entwurf Ihrer Preiskonfiguration.
              Möchten Sie diesen wiederherstellen oder verwerfen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                if (companyId) discardDraft(companyId);
                setShowDraftDialog(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Verwerfen
            </Button>
            <AlertDialogAction 
              onClick={() => {
                if (companyId) restoreDraft(companyId);
                setShowDraftDialog(false);
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Wiederherstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
