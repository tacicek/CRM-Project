// Step4Access.tsx - Access and logistics step for Räumung wizard

import { AccessDetails, FloorLevel, LiftType, StepsRange } from "@/types/raeumung";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle } from "lucide-react";

interface FloorOption {
  value: FloorLevel;
  label: string;
  icon: string;
}

const floorOptions: FloorOption[] = [
  { value: "basement", label: "Untergeschoss", icon: "⬇️" },
  { value: "ground_floor", label: "Erdgeschoss", icon: "🚪" },
  { value: "floor_1", label: "1. Stock", icon: "1️⃣" },
  { value: "floor_2", label: "2. Stock", icon: "2️⃣" },
  { value: "floor_3", label: "3. Stock", icon: "3️⃣" },
  { value: "floor_4", label: "4. Stock", icon: "4️⃣" },
  { value: "floor_5_plus", label: "5.+", icon: "🔝" },
];

interface LiftOption {
  value: LiftType;
  label: string;
  description: string;
  icon: string;
}

const liftOptions: LiftOption[] = [
  { value: "klein", label: "Kleiner Personenlift", description: "bis 4 Pers. / ~300kg", icon: "🛗" },
  { value: "gross", label: "Grosser Personenlift", description: "bis 8 Pers. / ~630kg", icon: "🛗" },
  { value: "warenlift", label: "Warenlift / Lastenlift", description: "13+ Pers. / 1000kg+", icon: "📦" },
];

interface StepsOption {
  value: StepsRange;
  label: string;
}

const stepsOptions: StepsOption[] = [
  { value: "steps_0_10", label: "0-10" },
  { value: "steps_11_30", label: "11-30" },
  { value: "steps_31_50", label: "31-50" },
  { value: "steps_51_plus", label: "51+" },
];

interface Step4AccessProps {
  access: AccessDetails;
  onChange: (access: AccessDetails) => void;
}

export const Step4Access = ({ access, onChange }: Step4AccessProps) => {
  const hasAnyObstacle = 
    access.hindernisse.enger_treppenhaus ||
    access.hindernisse.enger_flur ||
    access.hindernisse.schwieriger_zugang ||
    access.hindernisse.parkverbot;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Zugang & Logistik
        </h2>
        <p className="text-gray-600">
          Informationen zur Erreichbarkeit des Objekts
        </p>
      </div>

      {/* Floor Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">
          Stockwerk des Objekts
        </Label>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {floorOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...access, stockwerk: option.value })}
              className={cn(
                "flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200",
                "hover:border-blue-300",
                access.stockwerk === option.value
                  ? "border-blue-500 bg-blue-50/50 shadow-md"
                  : "border-gray-200 bg-white"
              )}
            >
              <span className="text-lg mb-1">{option.icon}</span>
              <span className={cn(
                "text-xs font-medium text-center",
                access.stockwerk === option.value ? "text-blue-700" : "text-gray-700"
              )}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lift Available */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            Ist ein Lift vorhanden?
          </Label>
          <Switch
            checked={access.lift_vorhanden}
            onCheckedChange={(checked) =>
              onChange({ ...access, lift_vorhanden: checked })
            }
          />
        </div>

        {/* Lift Type Selection (only if lift is available) */}
        {access.lift_vorhanden && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <Label className="text-sm font-medium text-gray-700">
              Art des Lifts
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {liftOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...access, lift_typ: option.value })}
                  className={cn(
                    "relative flex flex-col items-center p-4 rounded-lg border-2 transition-all",
                    "hover:border-blue-300",
                    access.lift_typ === option.value
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white"
                  )}
                >
                  {access.lift_typ === option.value && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <span className="text-2xl mb-2">{option.icon}</span>
                  <span className="font-medium text-sm">{option.label}</span>
                  <span className="text-xs text-gray-500 mt-1">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Parking Distance */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-base font-medium">
            Distanz Parkplatz → Eingang
          </Label>
          <span className="text-lg font-semibold text-blue-600">
            {access.parkplatz_distanz_m} Meter
          </span>
        </div>
        <Slider
          value={[access.parkplatz_distanz_m]}
          onValueChange={(vals) =>
            onChange({ ...access, parkplatz_distanz_m: vals[0] })
          }
          min={0}
          max={200}
          step={10}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>0m</span>
          <span>50m</span>
          <span>100m</span>
          <span>150m</span>
          <span>200m+</span>
        </div>
      </div>

      {/* Steps to entrance */}
      <div className="space-y-4">
        <Label className="text-base font-medium">
          Stufen bis zum Eingang
        </Label>
        <div className="grid grid-cols-4 gap-3">
          {stepsOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...access, stufen: option.value })}
              className={cn(
                "py-3 rounded-lg border-2 font-medium transition-all",
                access.stufen === option.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-blue-300"
              )}
            >
              {option.label} Stufen
            </button>
          ))}
        </div>
      </div>

      {/* Obstacles */}
      <div className="space-y-4">
        <Label className="text-base font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Hindernisse & Besonderheiten
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: "enger_treppenhaus", label: "Enges Treppenhaus", icon: "🚶" },
            { key: "enger_flur", label: "Enger Flur/Gang", icon: "↔️" },
            { key: "schwieriger_zugang", label: "Schwieriger Zugang", icon: "⚠️" },
            { key: "parkverbot", label: "Parkverbot / Zone", icon: "🚫" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                onChange({
                  ...access,
                  hindernisse: {
                    ...access.hindernisse,
                    [item.key]: !access.hindernisse[item.key as keyof typeof access.hindernisse],
                  },
                })
              }
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                access.hindernisse[item.key as keyof typeof access.hindernisse]
                  ? "border-amber-500 bg-amber-50"
                  : "border-gray-200 hover:border-amber-300"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded flex items-center justify-center flex-shrink-0",
                  access.hindernisse[item.key as keyof typeof access.hindernisse]
                    ? "bg-amber-500"
                    : "border-2 border-gray-300"
                )}
              >
                {access.hindernisse[item.key as keyof typeof access.hindernisse] && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Details for obstacles */}
        {hasAnyObstacle && (
          <div className="space-y-2">
            <Label className="text-sm text-gray-700">
              Beschreiben Sie die Hindernisse (optional)
            </Label>
            <Textarea
              value={access.hindernisse.details || ""}
              onChange={(e) =>
                onChange({
                  ...access,
                  hindernisse: {
                    ...access.hindernisse,
                    details: e.target.value,
                  },
                })
              }
              placeholder="z.B. Sehr enger Treppenaufgang im 2. Stock, LKW kann nicht direkt vor dem Haus parken..."
              className="min-h-[80px]"
            />
          </div>
        )}
      </div>

      {/* Warning for difficult access */}
      {(hasAnyObstacle || access.stockwerk === "floor_5_plus" || access.parkplatz_distanz_m > 100) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800">
                Erschwerte Bedingungen
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Die angegebenen Zugangsdetails können den Aufwand erhöhen.
                Die Anbieter werden dies in ihren Angeboten berücksichtigen.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4Access;


