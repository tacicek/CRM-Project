// Step8Timing.tsx - Timing and scheduling step for Räumung wizard

import { TimingDetails, UrgencyLevel } from "@/types/raeumung";
import { UrgencySelector } from "../ui/UrgencySelector";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";

interface FlexibilityOption {
  value: TimingDetails["flexibilitaet"];
  label: string;
  description: string;
}

const flexibilityOptions: FlexibilityOption[] = [
  { value: "fixed", label: "Festes Datum", description: "Nur an diesem Datum" },
  { value: "flex_3_days", label: "± 3 Tage", description: "Kleine Flexibilität" },
  { value: "flex_1_week", label: "± 1 Woche", description: "Mittlere Flexibilität" },
  { value: "fully_flexible", label: "Flexibel", description: "Beste Preise möglich" },
];

interface Step8TimingProps {
  timing: TimingDetails;
  onChange: (timing: TimingDetails) => void;
}

export const Step8Timing = ({ timing, onChange }: Step8TimingProps) => {
  // Calculate min date (2 days from now)
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 2);
  const minDateStr = minDate.toISOString().split("T")[0];

  // Calculate max date (1 year from now)
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateStr = maxDate.toISOString().split("T")[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Terminwünsche
        </h2>
        <p className="text-gray-600">
          Wann soll die Räumung stattfinden?
        </p>
      </div>

      {/* Urgency Selection */}
      <UrgencySelector
        value={timing.dringlichkeit}
        onChange={(value: UrgencyLevel) => onChange({ ...timing, dringlichkeit: value })}
        label="Wie dringend ist die Räumung?"
      />

      {/* Preferred Date */}
      <div className="space-y-4">
        <Label className="text-base font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          Wunschdatum
        </Label>
        <div className="relative">
          <Input
            type="date"
            value={timing.wunschdatum}
            onChange={(e) => onChange({ ...timing, wunschdatum: e.target.value })}
            min={minDateStr}
            max={maxDateStr}
            className="w-full pl-10"
          />
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        {timing.wunschdatum && (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Gewähltes Datum:{" "}
            {new Date(timing.wunschdatum).toLocaleDateString("de-CH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Flexibility */}
      <div className="space-y-4">
        <Label className="text-base font-medium">
          Wie flexibel sind Sie beim Datum?
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {flexibilityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...timing, flexibilitaet: option.value })}
              className={cn(
                "flex flex-col items-center p-4 rounded-lg border-2 transition-all",
                timing.flexibilitaet === option.value
                  ? "border-blue-500 bg-blue-50/50 shadow-md"
                  : "border-gray-200 hover:border-blue-300"
              )}
            >
              <span className={cn(
                "font-medium text-sm",
                timing.flexibilitaet === option.value ? "text-blue-700" : "text-gray-700"
              )}>
                {option.label}
              </span>
              <span className="text-xs text-gray-500 mt-1 text-center">
                {option.description}
              </span>
            </button>
          ))}
        </div>
        {timing.flexibilitaet === "fully_flexible" && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 flex items-center gap-2">
              <span>💰</span>
              Flexible Termine ermöglichen oft günstigere Angebote!
            </p>
          </div>
        )}
      </div>

      {/* Site Visit */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200">
          <div className="flex items-center gap-4">
            <span className="text-2xl">👁️</span>
            <div>
              <span className="font-medium">Besichtigung vor Ort gewünscht?</span>
              <p className="text-sm text-gray-500">
                Für eine genauere Offerte kann ein Besichtigungstermin vereinbart werden
              </p>
            </div>
          </div>
          <Switch
            checked={timing.besichtigung_gewuenscht}
            onCheckedChange={(checked) =>
              onChange({ ...timing, besichtigung_gewuenscht: checked })
            }
          />
        </div>

        {timing.besichtigung_gewuenscht && (
          <div className="ml-8 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
            <Label className="text-sm font-medium">
              Mögliche Besichtigungstermine (optional)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="datetime-local"
                onChange={(e) =>
                  onChange({
                    ...timing,
                    besichtigung_termine: [e.target.value, ...(timing.besichtigung_termine || []).slice(1)],
                  })
                }
                min={new Date().toISOString().slice(0, 16)}
                placeholder="Termin 1"
                className="w-full"
              />
              <Input
                type="datetime-local"
                onChange={(e) =>
                  onChange({
                    ...timing,
                    besichtigung_termine: [(timing.besichtigung_termine || [])[0], e.target.value],
                  })
                }
                min={new Date().toISOString().slice(0, 16)}
                placeholder="Termin 2 (Alternative)"
                className="w-full"
              />
            </div>
            <p className="text-xs text-gray-500">
              Geben Sie 1-2 mögliche Termine an. Die Anbieter werden sich bei Ihnen melden.
            </p>
          </div>
        )}
      </div>

      {/* Urgency warning */}
      {(timing.dringlichkeit === "very_urgent" || timing.dringlichkeit === "emergency") && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h4 className="font-semibold text-amber-800">
                Expressräumung
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Bei dringenden Räumungen fallen möglicherweise Expresszuschläge an.
                Die Anbieter werden Sie über zusätzliche Kosten informieren.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <h4 className="font-semibold text-blue-800">
              Planungshinweis
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              Für eine optimale Planung empfehlen wir, den Räumungstermin mindestens
              2 Wochen im Voraus zu buchen. Bei grösseren Objekten oder besonderen
              Anforderungen sollten Sie mehr Zeit einplanen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step8Timing;


