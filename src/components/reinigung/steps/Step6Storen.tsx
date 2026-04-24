import { 
  AlignHorizontalSpaceAround, 
  ArrowDownFromLine, 
  PanelsTopLeft
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { CounterInput } from "../ui/CounterInput";
import { Storen } from "@/types/reinigung";

interface Step6Props {
  storen: Storen;
  onStorenChange: (storen: Storen) => void;
  errors?: Record<string, string>;
}

export function Step6Storen({
  storen,
  onStorenChange,
  errors = {},
}: Step6Props) {
  const updateField = <K extends keyof Storen>(
    key: K,
    value: Storen[K]
  ) => {
    onStorenChange({
      ...storen,
      [key]: value,
    });
  };

  const totalStoren =
    storen.lamellenstoren +
    storen.rolllaeden +
    storen.fensterlaeden;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Storenreinigung
        </h2>
        <p className="text-sm text-gray-500">
          Geben Sie an, welche Storen oder Rollläden gereinigt werden sollen.
          Dieser Service ist optional.
        </p>
      </div>

      {/* Counter Inputs */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Storentypen</Label>
        
        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
          {/* Lamellenstoren */}
          <CounterInput
            label="Lamellenstoren"
            value={storen.lamellenstoren}
            onChange={(value) => updateField("lamellenstoren", value)}
            min={0}
            max={30}
            icon={<AlignHorizontalSpaceAround className="w-5 h-5" />}
            description="Horizontale Lamellen/Jalousien"
          />

          <div className="border-t border-gray-200" />

          {/* Rollläden */}
          <CounterInput
            label="Rollläden"
            value={storen.rolllaeden}
            onChange={(value) => updateField("rolllaeden", value)}
            min={0}
            max={30}
            icon={<ArrowDownFromLine className="w-5 h-5" />}
            description="Elektrische oder manuelle Rollläden"
          />

          <div className="border-t border-gray-200" />

          {/* Fensterläden */}
          <CounterInput
            label="Fensterläden"
            value={storen.fensterlaeden}
            onChange={(value) => updateField("fensterlaeden", value)}
            min={0}
            max={30}
            icon={<PanelsTopLeft className="w-5 h-5" />}
            description="Klappbare Holz- oder Metallfensterläden"
          />
        </div>

        {errors.storen && (
          <p className="text-sm text-destructive">{errors.storen}</p>
        )}
      </div>

      {/* Summary */}
      {totalStoren > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm text-primary font-medium">
            Gesamt: {totalStoren} Storen/Rollläden
          </p>
        </div>
      )}

      {/* Info box */}
      <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <strong>Hinweis:</strong> Falls Sie keine Storenreinigung benötigen, 
          können Sie diesen Schritt einfach überspringen. Die Werte bleiben bei 0.
        </p>
      </div>
    </div>
  );
}

export default Step6Storen;


