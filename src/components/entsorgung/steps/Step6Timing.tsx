import { EntsorgungsTermin } from "@/types/entsorgung";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Calendar, Clock, AlertTriangle } from "lucide-react";

interface Step6TimingProps {
  timing: EntsorgungsTermin;
  onChange: (timing: EntsorgungsTermin) => void;
}

const flexibilityOptions = [
  { value: "fixed", label: "Fester Termin", description: "Muss an diesem Tag sein" },
  { value: "flexible", label: "Flexibel", description: "± 2-3 Tage möglich" },
  { value: "very_flexible", label: "Sehr flexibel", description: "± 1-2 Wochen möglich" },
];

const urgencyOptions = [
  { value: "normal", label: "Normal", description: "Innerhalb von 1-2 Wochen", color: "bg-green-500" },
  { value: "dringend", label: "Dringend", description: "Innerhalb von 3-5 Tagen", color: "bg-amber-500" },
  { value: "sofort", label: "Sofort", description: "Innerhalb von 1-2 Tagen", color: "bg-red-500" },
];

const timeSlots = [
  { value: "vormittag", label: "Vormittag", time: "08:00 - 12:00" },
  { value: "nachmittag", label: "Nachmittag", time: "13:00 - 17:00" },
  { value: "ganztags", label: "Ganztags", time: "08:00 - 17:00" },
];

export const Step6Timing = ({ timing, onChange }: Step6TimingProps) => {
  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Wann soll die Entsorgung stattfinden?
        </h2>
        <p className="mt-2 text-gray-600">
          Wählen Sie Ihren Wunschtermin
        </p>
      </div>

      {/* Date selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-green-600" />
          Wunschdatum *
        </Label>
        <Input
          type="date"
          min={getMinDate()}
          value={timing.wunschdatum}
          onChange={(e) => onChange({ ...timing, wunschdatum: e.target.value })}
          className="max-w-xs"
        />
      </div>

      {/* Time slot */}
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-green-600" />
          Bevorzugtes Zeitfenster
        </Label>
        <div className="grid grid-cols-3 gap-3">
          {timeSlots.map((slot) => (
            <button
              key={slot.value}
              type="button"
              onClick={() => onChange({ ...timing, zeitfenster: slot.value as EntsorgungsTermin["zeitfenster"] })}
              className={cn(
                "p-4 rounded-lg border-2 text-center transition-all",
                timing.zeitfenster === slot.value
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="font-medium">{slot.label}</div>
              <div className="text-sm text-gray-500">{slot.time}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Flexibility */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Terminflexibilität</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {flexibilityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...timing, flexibilitaet: option.value as EntsorgungsTermin["flexibilitaet"] })}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                timing.flexibilitaet === option.value
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="font-medium">{option.label}</div>
              <div className="text-sm text-gray-500">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Urgency */}
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Dringlichkeit
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {urgencyOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...timing, dringlichkeit: option.value as EntsorgungsTermin["dringlichkeit"] })}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                timing.dringlichkeit === option.value
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", option.color)} />
                <span className="font-medium">{option.label}</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {timing.dringlichkeit === "sofort" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Hinweis:</strong> Bei sehr dringenden Anfragen können zusätzliche Kosten für Express-Service anfallen.
          </p>
        </div>
      )}
    </div>
  );
};

export default Step6Timing;

