// MovingCalculator.tsx — Single-column, fully responsive

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMovingCalculator } from './useMovingCalculator';
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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Truck,
  Clock,
  Users,
} from 'lucide-react';

interface MovingCalculatorProps {
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

export function MovingCalculator({
  onCalculate,
  pricingConfig,
  isLoading = false,
}: MovingCalculatorProps) {
  const calculator    = useMovingCalculator(pricingConfig);
  const [step, setStep]             = useState<StepId>('inventory');
  const [summaryOpen, setSummaryOpen] = useState(false);

  const idx      = STEPS.findIndex(s => s.id === step);
  const isFirst  = idx === 0;
  const isLast   = idx === STEPS.length - 1;
  const nextStep = !isLast ? STEPS[idx + 1] : null;

  const currentVolume = calculateNetVolume(calculator.inventory);
  const hasInventory  = calculator.inventory.length > 0;

  const stepDone: Record<StepId, boolean> = {
    inventory:   hasInventory,
    addresses:   calculator.originAddress !== null || calculator.destinationAddress !== null || calculator.distanceKm > 0,
    origin:      calculator.origin.floor > 0 || calculator.origin.hasElevator,
    destination: calculator.destination.floor > 0 || calculator.destination.hasElevator,
    extras:      Object.values(calculator.extraServices).some(Boolean),
  };

  const go = (target: StepId) => setStep(target);

  return (
    <div className="space-y-3">

      {/* ─── Horizontal stepper ─── */}
      <div className="flex items-center justify-between gap-1 px-1">
        {STEPS.map((s, i) => {
          const Icon    = s.icon;
          const active  = step === s.id;
          const done    = stepDone[s.id];
          const reachable = i <= idx + 1;

          return (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              {/* Step circle + label */}
              <button
                onClick={() => reachable && go(s.id)}
                disabled={!reachable}
                className="flex flex-col items-center gap-0.5 w-full min-w-0 group"
              >
                <div className={`
                  w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center
                  transition-all shrink-0
                  ${active  ? 'bg-primary border-primary text-white shadow-md shadow-primary/30'
                  : done    ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                  : reachable ? 'bg-background border-border text-muted-foreground hover:border-primary/50'
                  : 'bg-muted border-muted text-muted-foreground/40'}
                `}>
                  {done && !active
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  }
                </div>
                <span className={`
                  text-[9px] sm:text-[10px] font-medium leading-none truncate max-w-full
                  ${active ? 'text-primary' : done ? 'text-emerald-600' : 'text-muted-foreground/60'}
                `}>
                  {s.label}
                </span>
              </button>
              {/* connector line */}
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${
                  done ? 'bg-emerald-400' : 'bg-border'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Step content (full width) ─── */}
      <div className="min-h-0">
        {step === 'inventory'   && (
          <InventorySelector
            onAddItem={calculator.addItem}
            onRemoveItem={calculator.removeItem}
            getItemQuantity={calculator.getItemQuantity}
          />
        )}
        {step === 'addresses'   && (
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
        {step === 'origin'      && (
          <BuildingInfoForm
            title="Auszugsadresse — Gebäude"
            data={calculator.origin}
            onChange={calculator.setOrigin}
          />
        )}
        {step === 'destination' && (
          <BuildingInfoForm
            title="Einzugsadresse — Gebäude"
            data={calculator.destination}
            onChange={calculator.setDestination}
          />
        )}
        {step === 'extras'      && (
          <ExtraServicesForm
            data={calculator.extraServices}
            onChange={calculator.setExtraServices}
            netVolume={currentVolume}
          />
        )}
      </div>

      {/* ─── Navigation bar ─── */}
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card/70 px-3 py-2">
        {/* Left: back + reset */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost" size="sm"
            onClick={() => go(STEPS[idx - 1].id)}
            disabled={isFirst}
            className="h-8 px-2.5 gap-1 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Zurück</span>
          </Button>
          {hasInventory && (
            <Button
              variant="ghost" size="sm"
              onClick={() => { calculator.reset(); setStep('inventory'); }}
              className="h-8 px-2 text-muted-foreground"
              title="Neu laden"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Center: progress dots */}
        <div className="flex items-center gap-1">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className={`rounded-full transition-all ${
                step === s.id
                  ? 'w-4 h-1.5 bg-primary'
                  : stepDone[s.id]
                  ? 'w-1.5 h-1.5 bg-emerald-400'
                  : 'w-1.5 h-1.5 bg-muted-foreground/25'
              }`}
            />
          ))}
        </div>

        {/* Right: next / finish */}
        {isLast ? (
          <Button
            size="sm"
            onClick={() => calculator.result && onCalculate(calculator.result)}
            disabled={!hasInventory || isLoading}
            className="h-8 px-3 text-xs gap-1"
          >
            <span>In Offerte</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="outline" size="sm"
            onClick={() => go(STEPS[idx + 1].id)}
            className="h-8 px-2.5 gap-1 text-xs"
          >
            <span className="hidden xs:inline">{nextStep?.label}</span>
            <span className="xs:hidden">Weiter</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* ─── Live result strip (appears once items are selected) ─── */}
      {calculator.result && (
        <div className="rounded-xl border border-primary/25 overflow-hidden bg-card">
          {/* Compact summary bar — always visible */}
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
            onClick={() => setSummaryOpen(v => !v)}
          >
            {/* Total price */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold shrink-0">
                Live
              </Badge>
              <span className="text-base font-bold text-primary">
                {formatCHF(calculator.result.costBreakdown.total)}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">inkl. MwSt.</span>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {calculator.result.recommendedCrew}
              </span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{calculator.result.recommendedVehicle}</span>
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

            {/* Toggle */}
            <div className="text-muted-foreground ml-1 shrink-0">
              {summaryOpen
                ? <ChevronUp className="w-4 h-4" />
                : <ChevronDown className="w-4 h-4" />
              }
            </div>
          </button>

          {/* Full PricingSummary — expandable */}
          {summaryOpen && (
            <>
              <Separator />
              <div className="p-3 sm:p-4">
                <PricingSummary
                  result={calculator.result}
                  onCreateOffer={() => calculator.result && onCalculate(calculator.result)}
                  isLoading={isLoading}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
