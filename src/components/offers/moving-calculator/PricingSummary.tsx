// PricingSummary.tsx - Pricing Summary and Result Display Component

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalculationResult } from './types';
import { formatTime, formatCHF, getVehicleName, getVehicleCapacity } from './calculation-utils';
import {
  Truck,
  Clock,
  Users,
  Package,
  Calculator,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

interface PricingSummaryProps {
  result: CalculationResult | null;
  onCreateOffer: () => void;
  isLoading?: boolean;
}

export function PricingSummary({
  result,
  onCreateOffer,
  isLoading = false,
}: PricingSummaryProps) {
  const [showInventoryList, setShowInventoryList] = React.useState(false);

  if (!result) {
    return (
      <Card className="lg:sticky lg:top-4 overflow-hidden border-primary/20">
        <CardHeader className="pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <CardTitle className="text-sm sm:text-lg">Offerte Kalkulation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-center py-6 sm:py-12 space-y-2 sm:space-y-3">
            <Package className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Wählen Sie Möbel aus, um eine Kalkulation zu sehen
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Live-Kalkulation erscheint automatisch bei Ihrer Auswahl
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    netVolume,
    truckVolume,
    timeBreakdown,
    costBreakdown,
    recommendedVehicle,
    recommendedCrew,
    inventoryList,
    extraServices,
  } = result;

  const vehicleCapacity = getVehicleCapacity(recommendedVehicle) || 1; // Prevent division by zero
  const capacityUsage = Math.min(999, Math.round((truckVolume / vehicleCapacity) * 100)); // Cap at 999%
  const totalHours = timeBreakdown.totalTime / 60;

  const healthStatus = (() => {
    if (capacityUsage > 95 || totalHours > 12) {
      return {
        label: 'Risk',
        icon: ShieldAlert,
        className: 'bg-red-50 text-red-700 border-red-200',
        hint: 'Hohe Auslastung oder lange Einsatzdauer.',
      };
    }
    if (capacityUsage > 80 || totalHours > 8) {
      return {
        label: 'Dikkat',
        icon: AlertTriangle,
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        hint: 'Plan ist machbar, aber knapp kalkuliert.',
      };
    }
    return {
      label: 'Iyi',
      icon: ShieldCheck,
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      hint: 'Gute Reserve bei Volumen und Zeit.',
    };
  })();

  const hasAnyExtra = Object.values(extraServices).some(Boolean);

  return (
    <Card className="lg:sticky lg:top-4 overflow-hidden border-primary/20">
      <CardHeader className="pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <CardTitle className="text-sm sm:text-lg">Offerte Kalkulation</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] sm:text-xs">
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
        {/* Hero total box */}
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Geschätzter Gesamtpreis</span>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="text-2xl font-bold text-primary">{formatCHF(costBreakdown.total)}</span>
            <span className="text-[11px] text-muted-foreground">inkl. MwSt.</span>
          </div>
        </div>

        {/* Health status */}
        <div className={`rounded-lg border px-3 py-2 ${healthStatus.className}`}>
          <div className="flex items-center gap-2">
            <healthStatus.icon className="h-4 w-4 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide">{healthStatus.label}</span>
          </div>
          <p className="mt-1 text-[11px] opacity-90">{healthStatus.hint}</p>
        </div>

        {/* Team Configuration - Shows combined rate */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-primary">Team-Konfiguration</span>
            <Badge variant="outline" className="text-[10px]">Inkl. Fahrzeug</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span className="text-sm">{getVehicleName(recommendedVehicle)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">{recommendedCrew} Helfer</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Quick insights */}
        <div className="space-y-1.5">
          <h3 className="font-semibold text-xs">Schnelleinschätzung</h3>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px] sm:text-xs">
              {recommendedCrew} Helfer
            </Badge>
            <Badge variant="secondary" className="text-[10px] sm:text-xs">
              {getVehicleName(recommendedVehicle)}
            </Badge>
            <Badge
              variant={capacityUsage > 90 ? 'destructive' : capacityUsage > 75 ? 'secondary' : 'outline'}
              className="text-[10px] sm:text-xs"
            >
              {capacityUsage}% Auslastung
            </Badge>
            {hasAnyExtra && (
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                Extras aktiv
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Volume - Compact on mobile */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <h3 className="font-semibold text-xs sm:text-sm">Volumen</h3>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">Netto-Volumen:</span>
            <span className="font-medium">{netVolume.toFixed(1)} m³</span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">Mit Buffer (10%):</span>
            <span className="font-medium">{truckVolume.toFixed(1)} m³</span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm items-center">
            <span className="text-muted-foreground">LKW-Auslastung:</span>
            <Badge
              variant={capacityUsage > 90 ? 'destructive' : capacityUsage > 75 ? 'secondary' : 'outline'}
              className="text-[10px] sm:text-xs"
            >
              {capacityUsage}%
            </Badge>
          </div>
          {capacityUsage > 90 && (
            <div className="flex items-start gap-2 p-2 rounded bg-orange-50 text-[10px] sm:text-xs text-orange-800">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Hohe Auslastung - grösseres Fahrzeug empfohlen</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Time Breakdown - Compact labels */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="font-semibold text-xs">Zeitaufwand</h3>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Tragen:</span>
            <span className="font-medium">{formatTime(timeBreakdown.carryingTime)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Montage:</span>
            <span className="font-medium">{formatTime(timeBreakdown.assemblyTime)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Fahrzeit:</span>
            <span className="font-medium">{formatTime(timeBreakdown.drivingTime)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Puffer:</span>
            <span>{formatTime(timeBreakdown.bufferTime)}</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t text-sm">
            <span>Gesamt:</span>
            <span className="text-primary">{formatTime(timeBreakdown.totalTime)}</span>
          </div>
        </div>

        <Separator />

        {/* Cost Breakdown - Compact labels */}
        <div className="space-y-1">
          <h3 className="font-semibold text-xs mb-1">Kosten</h3>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Team (inkl. LKW):</span>
            <span className="font-medium">{formatCHF(costBreakdown.laborCost)}</span>
          </div>
          {/* Show effective hourly rate */}
          {timeBreakdown.totalTime > 0 && (
            <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
              <span>({formatTime(timeBreakdown.totalTime)} × Stundensatz)</span>
              <span>~{formatCHF(costBreakdown.laborCost / Math.max(timeBreakdown.totalTime / 60, 1))}/Std</span>
            </div>
          )}
          {costBreakdown.vehicleCost > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Fahrzeug:</span>
              <span className="font-medium">{formatCHF(costBreakdown.vehicleCost)}</span>
            </div>
          )}
          {costBreakdown.distanceSurcharge > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Distanz:</span>
              <span className="font-medium">{formatCHF(costBreakdown.distanceSurcharge)}</span>
            </div>
          )}
          {costBreakdown.extraServicesCost > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Extras & Zuschläge:</span>
              <span className="font-medium">{formatCHF(costBreakdown.extraServicesCost)}</span>
            </div>
          )}
          <Separator className="my-1" />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Netto:</span>
            <span className="font-medium">{formatCHF(costBreakdown.subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>MwSt. 8.1%:</span>
            <span>{formatCHF(costBreakdown.vat)}</span>
          </div>
          {/* Total - Always prominent */}
          <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t-2 border-primary/20">
            <span>TOTAL:</span>
            <span className="text-primary">{formatCHF(costBreakdown.total)}</span>
          </div>
        </div>

        {/* Extra Services Summary - Hidden on mobile if empty */}
        {Object.values(extraServices).some(Boolean) && (
          <>
            <Separator />
            <div className="space-y-1.5 sm:space-y-2">
              <h3 className="font-semibold text-xs sm:text-sm">Zusatzleistungen</h3>
              <div className="flex flex-wrap gap-1">
                {extraServices.packingService && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">Verpackung</Badge>
                )}
                {extraServices.externalLift && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">Aussenlift</Badge>
                )}
                {extraServices.disposal && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">Entsorgung</Badge>
                )}
                {extraServices.pianoTransport && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">Klavier</Badge>
                )}
                {extraServices.storage && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">Lagerung</Badge>
                )}
              </div>
            </div>
          </>
        )}

        {/* Inventory List (Collapsible) - Hidden by default on mobile */}
        <div className="space-y-2 hidden sm:block">
          <Separator />
          <button
            onClick={() => setShowInventoryList(!showInventoryList)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="font-semibold text-xs sm:text-sm">
              Möbelliste ({inventoryList.length} Positionen)
            </h3>
            {showInventoryList ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showInventoryList && (
            <ScrollArea className="h-32 sm:h-40 rounded-md border p-2">
              <div className="space-y-1">
                {inventoryList.map((item) => (
                  <div
                    key={item.item.id}
                    className="flex justify-between text-[10px] sm:text-xs py-1"
                  >
                    <span className="text-muted-foreground truncate pr-2">
                      {item.item.name_de}
                    </span>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px] sm:text-xs h-4 sm:h-5">
                        {item.quantity}x
                      </Badge>
                      <span className="text-muted-foreground w-10 sm:w-12 text-right">
                        {(item.item.volume_m3 * item.quantity).toFixed(1)} m³
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Create Offer Button - Touch friendly */}
        <Button
          className="w-full h-11 sm:h-10 text-sm sm:text-base bg-primary hover:bg-primary/90 shadow-sm"
          size="lg"
          onClick={onCreateOffer}
          disabled={isLoading}
        >
          <FileText className="h-4 w-4 mr-2" />
          {isLoading ? 'Wird erstellt...' : 'Offerte erstellen'}
        </Button>

        <p className="text-[10px] sm:text-xs text-center text-muted-foreground">
          Preise basieren auf Schweizer Marktstandard (Delta Umzug)
        </p>
      </CardContent>
    </Card>
  );
}
