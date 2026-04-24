// ExtraServicesForm.tsx - Extra Services Selection Component

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ExtraServices } from './types';
import { DEFAULT_PRICING_CONFIG } from './inventory-data';
import { formatCHF } from './calculation-utils';
import {
  Package,
  ArrowUpFromLine,
  Trash2,
  Music,
  Archive,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface ExtraServicesFormProps {
  data: ExtraServices;
  onChange: (data: ExtraServices) => void;
  netVolume?: number;
}

interface ServiceOption {
  key: keyof ExtraServices;
  icon: React.ElementType;
  label: string;
  description: string;
  pricing: string;
  getCost: (netVolume: number) => number;
}

const SERVICES: ServiceOption[] = [
  {
    key: 'packingService',
    icon: Package,
    label: 'Verpackungsservice',
    description: 'Wir verpacken Ihr Umzugsgut professionell und sicher',
    pricing: `${DEFAULT_PRICING_CONFIG.packingServiceRate} CHF/m³`,
    getCost: (netVolume) => netVolume * DEFAULT_PRICING_CONFIG.packingServiceRate,
  },
  {
    key: 'externalLift',
    icon: ArrowUpFromLine,
    label: 'Aussenlift / Möbellift',
    description: 'Empfohlen ab 4. Stock ohne Aufzug oder bei grossen Möbeln',
    pricing: `${formatCHF(DEFAULT_PRICING_CONFIG.externalLiftCost)} pauschal`,
    getCost: () => DEFAULT_PRICING_CONFIG.externalLiftCost,
  },
  {
    key: 'disposal',
    icon: Trash2,
    label: 'Entsorgung / Sperrgut',
    description: 'Fachgerechte Entsorgung von alten Möbeln und Sperrgut',
    pricing: `ab ${formatCHF(DEFAULT_PRICING_CONFIG.disposalCost)}`,
    getCost: () => DEFAULT_PRICING_CONFIG.disposalCost,
  },
  {
    key: 'pianoTransport',
    icon: Music,
    label: 'Klaviertransport',
    description: 'Spezialtransport für Klavier, Flügel oder Keyboard',
    pricing: `ab ${formatCHF(DEFAULT_PRICING_CONFIG.pianoTransportCost)}`,
    getCost: () => DEFAULT_PRICING_CONFIG.pianoTransportCost,
  },
  {
    key: 'storage',
    icon: Archive,
    label: 'Möbellagerung',
    description: 'Sichere Zwischenlagerung Ihres Umzugsguts',
    pricing: `${DEFAULT_PRICING_CONFIG.storageCostPerM3} CHF/m³/Monat`,
    getCost: (netVolume) => netVolume * DEFAULT_PRICING_CONFIG.storageCostPerM3,
  },
];

export function ExtraServicesForm({
  data,
  onChange,
  netVolume = 0,
}: ExtraServicesFormProps) {
  const updateService = (key: keyof ExtraServices, value: boolean) => {
    onChange({ ...data, [key]: value });
  };

  // Count active services
  const activeCount = Object.values(data).filter(Boolean).length;

  // Calculate total extra cost
  const totalExtraCost = SERVICES.reduce((sum, service) => {
    if (data[service.key]) {
      return sum + service.getCost(netVolume);
    }
    return sum;
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Zusatzleistungen</CardTitle>
          </div>
          {activeCount > 0 && (
            <Badge variant="default" className="text-sm">
              {activeCount} ausgewählt • {formatCHF(totalExtraCost)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          const isActive = data[service.key];
          const estimatedCost = service.getCost(netVolume);

          return (
            <div
              key={service.key}
              onClick={() => updateService(service.key, !isActive)}
              className={`
                flex items-center justify-between rounded-xl border-2 p-3 sm:p-4
                cursor-pointer select-none transition-all
                ${isActive
                  ? 'border-emerald-500 bg-white dark:bg-card shadow-sm'
                  : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30'
                }
              `}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Icon circle */}
                <div className={`
                  flex items-center justify-center w-9 h-9 rounded-full shrink-0
                  ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}
                `}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className={`text-sm font-semibold cursor-pointer leading-tight ${
                      isActive ? 'text-foreground' : 'text-foreground'
                    }`}>
                      {service.label}
                    </Label>
                    <Badge
                      variant="outline"
                      className={`text-xs font-normal shrink-0 ${
                        isActive ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : ''
                      }`}
                    >
                      {service.pricing}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {service.description}
                  </p>
                  {isActive && netVolume > 0 && (
                    <p className="text-xs font-semibold text-emerald-700 mt-1">
                      ≈ {formatCHF(estimatedCost)}
                    </p>
                  )}
                </div>
              </div>

              {/* Toggle indicator */}
              <div className={`
                ml-3 shrink-0 flex items-center justify-center w-6 h-6 rounded-full
                transition-all
                ${isActive
                  ? 'bg-emerald-500 text-white'
                  : 'border-2 border-muted-foreground/30 bg-transparent'
                }
              `}>
                {isActive && <CheckCircle2 className="w-4 h-4" />}
              </div>
            </div>
          );
        })}

        {/* Info Box */}
        <div className="mt-4 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p>
            💡 <strong>Tipp:</strong> Alle Zusatzleistungen werden nach dem
            tatsächlichen Aufwand abgerechnet. Die angezeigten Kosten sind
            Schätzungen basierend auf dem Volumen.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
