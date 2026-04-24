// MovingCalculatorWithLead.tsx - Moving Calculator with Lead Data Pre-fill

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useMovingCalculator } from './useMovingCalculator';
import { useLeadDataMapper } from './useLeadDataMapper';
import { InventorySelector } from './InventorySelector';
import { BuildingInfoForm } from './BuildingInfoForm';
import { AddressDistanceForm } from './AddressDistanceForm';
import { ExtraServicesForm } from './ExtraServicesForm';
import { PricingSummary } from './PricingSummary';
import { CalculationResult, PricingConfig } from './types';
import { calculateNetVolume, formatCHF, formatTime } from './calculation-utils';
import {
  Package,
  Building2,
  MapPin,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Route,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Truck,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MovingCalculatorWithLeadProps {
  leadId: string;
  companyId?: string;
  onCalculate: (result: CalculationResult) => void;
  pricingConfig?: PricingConfig;
  isLoading?: boolean;
}

const STEPS = [
  { id: 'inventory',   label: 'Inventar',  icon: Package   },
  { id: 'addresses',   label: 'Adressen',  icon: Route     },
  { id: 'origin',      label: 'Auszug',    icon: Building2 },
  { id: 'destination', label: 'Einzug',    icon: MapPin    },
  { id: 'extras',      label: 'Extras',    icon: Sparkles  },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function MovingCalculatorWithLead({
  leadId,
  companyId,
  onCalculate,
  pricingConfig,
  isLoading: isSubmitting = false,
}: MovingCalculatorWithLeadProps) {
  // Always call hooks unconditionally
  const calculator = useMovingCalculator(pricingConfig);
  const {
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
  } = useLeadDataMapper();
  
  const [activeTab, setActiveTab] = useState<StepId>('inventory');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [_isDataLoaded, setIsDataLoaded] = useState(false);
  const [dataLoadStats, setDataLoadStats] = useState({
    inventoryCount: 0,
    hasOriginAddress: false,
    hasDestinationAddress: false,
    hasDistance: false,
    unmatchedCount: 0,
  });
  
  // Track which lead ID's data has been applied to prevent double-application
  const appliedLeadIdRef = useRef<string | null>(null);

  // Load lead data on mount
  // Note: We intentionally only depend on leadId to prevent reloading when leadMapper reference changes
  useEffect(() => {
    if (leadId) {
      loadLeadData(leadId, companyId);
    }

  }, [leadId, companyId, loadLeadData]);

  // Apply lead data to calculator when loaded
  // Memoized function to apply lead data
  const applyLeadData = useCallback(() => {
    if (!leadData) return;
    
    // Apply inventory
    const inventorySelections = getInventorySelections();
    for (const selection of inventorySelections) {
      for (let i = 0; i < selection.quantity; i++) {
        calculator.addItem(selection.item, selection.category_id);
      }
    }

    // Apply addresses
    const originAddress = getOriginAddress();
    const destinationAddress = getDestinationAddress();
    if (originAddress) calculator.setOriginAddress(originAddress);
    if (destinationAddress) calculator.setDestinationAddress(destinationAddress);

    // Apply building info
    calculator.setOrigin(getOriginBuildingInfo());
    calculator.setDestination(getDestinationBuildingInfo());

    // Apply extra services
    calculator.setExtraServices(getExtraServices());

    // Apply distance if available
    const distanceKm = getDistanceKm();
    const drivingTime = getDrivingTimeMinutes();
    if (distanceKm > 0) calculator.setDistanceKm(distanceKm);
    if (drivingTime > 0) calculator.setDrivingTimeMinutes(drivingTime);

    // Track what was loaded (including unmatched items)
    setDataLoadStats({
      inventoryCount: inventorySelections.reduce((sum, s) => sum + s.quantity, 0),
      hasOriginAddress: !!originAddress,
      hasDestinationAddress: !!destinationAddress,
      hasDistance: distanceKm > 0,
      unmatchedCount: unmatchedItems.length,
    });
  }, [
    leadData,
    getInventorySelections,
    getOriginAddress,
    getDestinationAddress,
    getOriginBuildingInfo,
    getDestinationBuildingInfo,
    getExtraServices,
    getDistanceKm,
    getDrivingTimeMinutes,
    unmatchedItems.length,
    calculator,
  ]);

  useEffect(() => {
    // Only apply data if:
    // 1. Lead data is loaded
    // 2. Data hasn't been applied for this leadId yet
    if (leadData && appliedLeadIdRef.current !== leadId) {
      applyLeadData();
      appliedLeadIdRef.current = leadId;
      setIsDataLoaded(true);
    }
  }, [leadData, leadId, applyLeadData]);

  const handleCreateOffer = () => {
    if (calculator.result) {
      onCalculate(calculator.result);
    }
  };

  const handleNext = () => {
    const currentIndex = STEPS.findIndex((t) => t.id === activeTab);
    if (currentIndex < STEPS.length - 1) {
      setActiveTab(STEPS[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    const currentIndex = STEPS.findIndex((t) => t.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(STEPS[currentIndex - 1].id);
    }
  };

  const handleReset = () => {
    calculator.reset();
    setIsDataLoaded(false);
    // Reset the applied lead ID to allow re-application
    appliedLeadIdRef.current = null;
    // Reload lead data
    if (leadId) {
      loadLeadData(leadId, companyId);
    }
  };

  // Calculate current volume for display
  const currentVolume = calculateNetVolume(calculator.inventory);

  // Check if each step has data
  const hasInventory = calculator.inventory.length > 0;
  const hasAddresses = calculator.originAddress !== null || calculator.destinationAddress !== null;
  const hasDistance = calculator.distanceKm > 0 || calculator.drivingTimeMinutes > 0;
  const hasOriginData = calculator.origin.floor > 0 || calculator.origin.hasElevator;
  const hasDestinationData =
    calculator.destination.floor > 0 || calculator.destination.hasElevator;

  const currentIndex = STEPS.findIndex((t) => t.id === activeTab);
  const isFirstTab = currentIndex === 0;
  const isLastTab = currentIndex === STEPS.length - 1;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Anfrage-Daten werden geladen...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Fehler beim Laden der Anfrage: {error}
        </AlertDescription>
      </Alert>
    );
  }

  // Step done tracking
  const stepDone: Record<StepId, boolean> = {
    inventory:   hasInventory,
    addresses:   hasAddresses || hasDistance,
    origin:      hasOriginData,
    destination: hasDestinationData,
    extras:      Object.values(calculator.extraServices).some(Boolean),
  };

  return (
    <div className="space-y-3">

      {/* Lead Info Banner */}
      {leadData && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-2.5 px-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {leadData.customer_first_name} {leadData.customer_last_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {leadData.customer_email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {dataLoadStats.inventoryCount > 0 && (
                  <Badge variant="secondary" className="gap-1 text-xs h-5 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {dataLoadStats.inventoryCount} Artikel
                  </Badge>
                )}
                {dataLoadStats.hasDistance && (
                  <Badge variant="secondary" className="gap-1 text-xs h-5 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Distanz
                  </Badge>
                )}
                {dataLoadStats.unmatchedCount > 0 && (
                  <Badge variant="destructive" className="gap-1 text-xs h-5 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" />
                    {dataLoadStats.unmatchedCount} fehlt
                  </Badge>
                )}
              </div>
            </div>

            {unmatchedItems.length > 0 && (
              <Alert variant="destructive" className="mt-2 py-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">
                  <strong>{unmatchedItems.length} Artikel</strong> nicht zugeordnet:{' '}
                  {unmatchedItems.slice(0, 3).map((item, idx) => (
                    <span key={idx}>
                      {item.anzahl}x {item.name}
                      {idx < Math.min(unmatchedItems.length - 1, 2) ? ', ' : ''}
                    </span>
                  ))}
                  {unmatchedItems.length > 3 && ` +${unmatchedItems.length - 3}`}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Horizontal stepper ─── */}
      <div className="flex items-center justify-between gap-1 px-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active  = activeTab === s.id;
          const done    = stepDone[s.id];
          const reachable = i <= currentIndex + 1;

          return (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => reachable && setActiveTab(s.id)}
                disabled={!reachable}
                className="flex flex-col items-center gap-0.5 w-full min-w-0"
              >
                <div className={`
                  w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center
                  transition-all shrink-0
                  ${active  ? 'bg-primary border-primary text-white shadow-md shadow-primary/30'
                  : done    ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                  : reachable ? 'bg-background border-border text-muted-foreground hover:border-primary/50'
                  : 'bg-muted border-muted text-muted-foreground/40'}`}
                >
                  {done && !active
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  }
                </div>
                <span className={`
                  text-[9px] sm:text-[10px] font-medium leading-none truncate max-w-full
                  ${active ? 'text-primary' : done ? 'text-emerald-600' : 'text-muted-foreground/60'}`}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${
                  done ? 'bg-emerald-400' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Step content ─── */}
      <div className="min-h-0">
        {activeTab === 'inventory' && (
          <InventorySelector
            onAddItem={calculator.addItem}
            onRemoveItem={calculator.removeItem}
            getItemQuantity={calculator.getItemQuantity}
          />
        )}
        {activeTab === 'addresses' && (
          <AddressDistanceForm
            originAddress={calculator.originAddress}
            destinationAddress={calculator.destinationAddress}
            distanceKm={calculator.distanceKm}
            drivingTimeMinutes={calculator.drivingTimeMinutes}
            additionalStops={calculator.additionalStops}
            onOriginChange={calculator.setOriginAddress}
            onDestinationChange={calculator.setDestinationAddress}
            onDistanceChange={calculator.setDistanceKm}
            onDrivingTimeChange={calculator.setDrivingTimeMinutes}
            onAdditionalStopsChange={calculator.setAdditionalStops}
          />
        )}
        {activeTab === 'origin' && (
          <BuildingInfoForm
            title="Auszugsadresse – Gebäude"
            data={calculator.origin}
            onChange={calculator.setOrigin}
          />
        )}
        {activeTab === 'destination' && (
          <BuildingInfoForm
            title="Einzugsadresse – Gebäude"
            data={calculator.destination}
            onChange={calculator.setDestination}
          />
        )}
        {activeTab === 'extras' && (
          <ExtraServicesForm
            data={calculator.extraServices}
            onChange={calculator.setExtraServices}
            netVolume={currentVolume}
          />
        )}
      </div>

      {/* ─── Navigation bar ─── */}
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card/70 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrev}
          disabled={isFirstTab}
          className="gap-1 h-9 px-3 shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden xs:inline text-sm">Zurück</span>
        </Button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`rounded-full transition-all ${
                activeTab === s.id
                  ? 'w-4 h-2 bg-primary'
                  : i < currentIndex
                  ? 'w-2 h-2 bg-emerald-400'
                  : 'w-2 h-2 bg-border'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-9 w-9 p-0 text-muted-foreground"
            title="Neu laden"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={isLastTab ? 'default' : 'ghost'}
            size="sm"
            onClick={isLastTab ? handleCreateOffer : handleNext}
            disabled={isLastTab && !hasInventory}
            className="gap-1 h-9 px-3"
          >
            <span className="text-sm">{isLastTab ? 'Offerte' : 'Weiter'}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─── Live result strip ─── */}
      {calculator.result && (
        <div className="rounded-xl border border-primary/25 overflow-hidden bg-card">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
            onClick={() => setSummaryOpen(v => !v)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold shrink-0">
                Live
              </Badge>
              <span className="text-base font-bold text-primary">
                {formatCHF(calculator.result.costBreakdown.total)}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">inkl. MwSt.</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {calculator.result.recommendedCrew}
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                {calculator.result.recommendedVehicle}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(calculator.result.timeBreakdown.totalTime)}
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                {calculator.result.netVolume.toFixed(1)} m³
              </span>
            </div>

            <div className="text-muted-foreground ml-1 shrink-0">
              {summaryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {summaryOpen && (
            <>
              <Separator />
              <div className="p-3 sm:p-4">
                <PricingSummary
                  result={calculator.result}
                  onCreateOffer={handleCreateOffer}
                  isLoading={isSubmitting}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
