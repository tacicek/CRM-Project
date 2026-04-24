// =============================================================================
// TERMS SECTION - Payment Terms & Conditions
// =============================================================================
// Handles payment terms and general business conditions for offers.
// =============================================================================

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, CreditCard } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface TermsSectionProps {
  paymentTerms: string;
  termsAndConditions: string;
  onPaymentTermsChange: (value: string) => void;
  onTermsChange: (value: string) => void;
}

// =============================================================================
// PRESET VALUES
// =============================================================================

const PAYMENT_PRESETS = [
  { label: "Barzahlung", value: "Barzahlung nach der Ausführung" },
  { label: "10 Tage netto", value: "Zahlung innerhalb 10 Tagen netto" },
  { label: "30 Tage", value: "Zahlung innerhalb 30 Tagen" },
  { label: "50% Anzahlung", value: "50% Anzahlung, Rest bei Fertigstellung" },
  { label: "TWINT", value: "Zahlung per TWINT nach Ausführung" },
];

const DEFAULT_TERMS = `Versicherung
Die Firma verfügt über eine Betriebs- und Transportversicherung. Alle Schäden müssen sofort nach Feststellung, spätestens jedoch innerhalb von 24 Stunden, schriftlich gemeldet werden.

Haftung
Die Haftung für Schäden an transportierten Gütern richtet sich nach den gesetzlichen Bestimmungen des Schweizerischen Obligationenrechts.

Stornierung
Bei Stornierung weniger als 48 Stunden vor dem vereinbarten Termin werden 50% des Offertbetrages in Rechnung gestellt.

Zahlungsbedingungen
Die Rechnung ist sofort nach Abschluss der Arbeiten zahlbar. Bei Zahlungsverzug wird ein Verzugszins von 5% pro Jahr berechnet.

Gerichtsstand
Gerichtsstand ist der Sitz unserer Firma.`;

// =============================================================================
// COMPONENT
// =============================================================================

export function TermsSection({
  paymentTerms,
  termsAndConditions,
  onPaymentTermsChange,
  onTermsChange,
}: TermsSectionProps) {
  return (
    <div className="space-y-4">
      {/* Payment Terms */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-green-500" />
            Zahlungskondition
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          <Textarea
            value={paymentTerms}
            onChange={(e) => onPaymentTermsChange(e.target.value)}
            placeholder="z.B. Barzahlung nach dem Umzug an den Teamchef"
            rows={2}
            className="text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_PRESETS.map((preset) => (
              <Badge
                key={preset.label}
                variant="outline"
                className="cursor-pointer hover:bg-secondary/10 text-xs transition-colors"
                onClick={() => onPaymentTermsChange(preset.value)}
              >
                {preset.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Terms and Conditions */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Allgemeine Geschäftsbedingungen
          </CardTitle>
          <CardDescription className="text-xs">
            Diese Bedingungen erscheinen auf Seite 2 der Offerte
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          <Textarea
            value={termsAndConditions}
            onChange={(e) => onTermsChange(e.target.value)}
            placeholder="Geben Sie hier Ihre allgemeinen Geschäftsbedingungen ein..."
            rows={6}
            className="text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-secondary/10 text-xs transition-colors"
              onClick={() => onTermsChange(DEFAULT_TERMS)}
            >
              Standard-AGB einfügen
            </Badge>
            {termsAndConditions && (
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-destructive/10 text-xs transition-colors text-destructive"
                onClick={() => onTermsChange("")}
              >
                Löschen
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TermsSection;

