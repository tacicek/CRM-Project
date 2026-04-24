import { Bath, CircleDot, Droplets, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CounterInput } from "../ui/CounterInput";
import { Badezimmer } from "@/types/reinigung";

interface Step4Props {
  badezimmer: Badezimmer;
  onBadezimmerChange: (badezimmer: Badezimmer) => void;
  errors?: Record<string, string>;
}

export function Step4Badezimmer({
  badezimmer,
  onBadezimmerChange,
  errors = {},
}: Step4Props) {
  const updateField = <K extends keyof Badezimmer>(
    key: K,
    value: Badezimmer[K]
  ) => {
    onBadezimmerChange({
      ...badezimmer,
      [key]: value,
    });
  };

  const totalItems =
    badezimmer.duschen_badewannen +
    badezimmer.toiletten +
    badezimmer.lavabos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Badezimmerreinigung
        </h2>
        <p className="text-sm text-gray-500">
          Geben Sie an, wie viele Sanitärelemente gereinigt werden sollen.
          Dies hilft uns, den Reinigungsaufwand besser einzuschätzen.
        </p>
      </div>

      {/* Counter Inputs */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Sanitärelemente</Label>
        
        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
          {/* Duschen/Badewannen */}
          <CounterInput
            label="Duschen/Badewannen"
            value={badezimmer.duschen_badewannen}
            onChange={(value) => updateField("duschen_badewannen", value)}
            min={0}
            max={10}
            icon={<Bath className="w-5 h-5" />}
            description="Anzahl der Duschen und Badewannen"
          />

          <div className="border-t border-gray-200" />

          {/* Toiletten */}
          <CounterInput
            label="Toiletten"
            value={badezimmer.toiletten}
            onChange={(value) => updateField("toiletten", value)}
            min={0}
            max={10}
            icon={<CircleDot className="w-5 h-5" />}
            description="Anzahl der WCs"
          />

          <div className="border-t border-gray-200" />

          {/* Lavabos */}
          <CounterInput
            label="Lavabos"
            value={badezimmer.lavabos}
            onChange={(value) => updateField("lavabos", value)}
            min={0}
            max={10}
            icon={<Droplets className="w-5 h-5" />}
            description="Anzahl der Waschbecken"
          />
        </div>

        {errors.badezimmer && (
          <p className="text-sm text-destructive">{errors.badezimmer}</p>
        )}
      </div>

      {/* Additional Checkbox */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Zusätzliche Informationen</Label>
        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
          <Checkbox
            id="verhaerteter_schmutz"
            checked={badezimmer.verhaerteter_schmutz}
            onCheckedChange={(checked) =>
              updateField("verhaerteter_schmutz", checked === true)
            }
            className="mt-0.5"
          />
          <div>
            <Label
              htmlFor="verhaerteter_schmutz"
              className="text-sm font-medium cursor-pointer"
            >
              Verhärteter Schmutz im Badezimmer
            </Label>
            <p className="text-xs text-gray-500 mt-0.5">
              z.B. hartnäckiger Kalk, Schimmel, starke Verschmutzungen
            </p>
          </div>
        </div>
      </div>

      {/* Warning if no items selected */}
      {totalItems === 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Keine Sanitärelemente angegeben
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Bitte geben Sie mindestens ein Sanitärelement an, damit wir den 
              Reinigungsaufwand einschätzen können.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Step4Badezimmer;


