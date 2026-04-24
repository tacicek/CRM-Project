import { useState } from "react";
import { 
  Square, 
  Columns, 
  DoorOpen, 
  AlertTriangle,
  ChevronDown,
  CircleDot,
  RectangleVertical
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CounterInput } from "../ui/CounterInput";
import { Fenster } from "@/types/reinigung";
import { cn } from "@/lib/utils";

interface Step5Props {
  fenster: Fenster;
  onFensterChange: (fenster: Fenster) => void;
  errors?: Record<string, string>;
}

export function Step5Fenster({
  fenster,
  onFensterChange,
  errors = {},
}: Step5Props) {
  const [showMoreTypes, setShowMoreTypes] = useState(false);

  const updateField = <K extends keyof Fenster>(
    key: K,
    value: Fenster[K]
  ) => {
    onFensterChange({
      ...fenster,
      [key]: value,
    });
  };

  const updateWeitereTypen = (
    key: keyof Fenster["weitere_typen"],
    value: number
  ) => {
    onFensterChange({
      ...fenster,
      weitere_typen: {
        ...fenster.weitere_typen,
        [key]: value,
      },
    });
  };

  const totalWindows =
    fenster.normale_fenster +
    fenster.fensterwaende +
    fenster.fenstertueren +
    fenster.weitere_typen.dachfenster +
    fenster.weitere_typen.rundfenster;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Fensterreinigung
        </h2>
        <p className="text-sm text-gray-500">
          Geben Sie die Anzahl der zu reinigenden Fenster an. 
          Wir zählen die Fenstergriffe bzw. Fensterrahmen.
        </p>
      </div>

      {/* Main Window Types */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Fenstertypen</Label>
        
        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
          {/* Normale Fenster */}
          <CounterInput
            label="Normale Fenster"
            value={fenster.normale_fenster}
            onChange={(value) => updateField("normale_fenster", value)}
            min={0}
            max={50}
            icon={<Square className="w-5 h-5" />}
            description="Wir zählen die Fenstergriffe"
          />

          <div className="border-t border-gray-200" />

          {/* Fensterwände */}
          <CounterInput
            label="Fensterwände"
            value={fenster.fensterwaende}
            onChange={(value) => updateField("fensterwaende", value)}
            min={0}
            max={50}
            icon={<Columns className="w-5 h-5" />}
            description="Wir zählen die Fensterrahmen"
          />

          <div className="border-t border-gray-200" />

          {/* Fenstertüren */}
          <CounterInput
            label="Fenstertüren"
            value={fenster.fenstertueren}
            onChange={(value) => updateField("fenstertueren", value)}
            min={0}
            max={50}
            icon={<DoorOpen className="w-5 h-5" />}
            description="Wir zählen die Fenstergriffe"
          />
        </div>

        {errors.fenster && (
          <p className="text-sm text-destructive">{errors.fenster}</p>
        )}
      </div>

      {/* Expand for more window types */}
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowMoreTypes(!showMoreTypes)}
        >
          <span>Weitere Fenstertypen hinzufügen</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              showMoreTypes && "rotate-180"
            )}
          />
        </Button>

        {showMoreTypes && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-2">
            {/* Dachfenster */}
            <CounterInput
              label="Dachfenster"
              value={fenster.weitere_typen.dachfenster}
              onChange={(value) => updateWeitereTypen("dachfenster", value)}
              min={0}
              max={20}
              icon={<RectangleVertical className="w-5 h-5" />}
              description="Fenster im Dach/Schräge"
            />

            <div className="border-t border-gray-200" />

            {/* Rundfenster */}
            <CounterInput
              label="Rundfenster"
              value={fenster.weitere_typen.rundfenster}
              onChange={(value) => updateWeitereTypen("rundfenster", value)}
              min={0}
              max={10}
              icon={<CircleDot className="w-5 h-5" />}
              description="Runde oder ovale Fenster"
            />
          </div>
        )}
      </div>

      {/* Additional Checkbox */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Zusätzliche Reinigung</Label>
        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
          <Checkbox
            id="schimmel_entfernen"
            checked={fenster.schimmel_entfernen}
            onCheckedChange={(checked) =>
              updateField("schimmel_entfernen", checked === true)
            }
            className="mt-0.5"
          />
          <div>
            <Label
              htmlFor="schimmel_entfernen"
              className="text-sm font-medium cursor-pointer"
            >
              Schimmel an den Fensterbänken entfernen
            </Label>
            <p className="text-xs text-gray-500 mt-0.5">
              Spezielle Schimmelentfernung an Fensterbänken und Rahmen
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      {totalWindows > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm text-primary font-medium">
            Gesamt: {totalWindows} Fenster{totalWindows !== 1 ? "" : ""}
          </p>
        </div>
      )}

      {/* Warning if no windows */}
      {totalWindows === 0 && (
        <div className="flex items-start gap-3 bg-gray-100 border border-gray-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-700">
              Keine Fenster angegeben
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Falls Sie keine Fensterreinigung benötigen, können Sie diesen 
              Schritt überspringen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Step5Fenster;


