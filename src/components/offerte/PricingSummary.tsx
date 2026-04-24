// =============================================================================
// PRICING SUMMARY - Totals & VAT Calculation
// =============================================================================
// Displays the pricing summary with subtotal, VAT, and total.
// =============================================================================

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Calculator } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface PricingSummaryProps {
  subtotal: number;
  vatRate: number;
  vatEnabled: boolean;
  onVatRateChange: (rate: number) => void;
  onVatEnabledChange: (enabled: boolean) => void;
  currency?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PricingSummary({
  subtotal,
  vatRate,
  vatEnabled,
  onVatRateChange,
  onVatEnabledChange,
  currency = "CHF",
}: PricingSummaryProps) {
  const vatAmount = vatEnabled ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vatAmount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4 text-secondary" />
          Zusammenfassung
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="space-y-3">
          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Zwischensumme</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>

          {/* VAT Toggle & Rate */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="vat-toggle"
                checked={vatEnabled}
                onCheckedChange={onVatEnabledChange}
              />
              <Label htmlFor="vat-toggle" className="text-sm cursor-pointer">
                MwSt.
              </Label>
              {vatEnabled && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-16 h-7 text-xs text-center"
                    value={vatRate}
                    onChange={(e) => onVatRateChange(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              )}
            </div>
            <span className={vatEnabled ? "font-medium" : "text-muted-foreground"}>
              {formatCurrency(vatAmount)}
            </span>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">Total</span>
            <span className="text-xl font-bold text-secondary">
              {formatCurrency(total)}
            </span>
          </div>

          {/* VAT Info */}
          {vatEnabled && (
            <p className="text-xs text-muted-foreground text-right">
              inkl. {vatRate}% MwSt. ({formatCurrency(vatAmount)})
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PricingSummary;

