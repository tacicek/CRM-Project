import { 
  Droplets, 
  Flame, 
  Footprints, 
  Grid3X3
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { ToggleServiceCard } from "../ui/ToggleServiceCard";
import { CounterInput } from "../ui/CounterInput";
import { Zusatzleistungen } from "@/types/reinigung";

interface Step7Props {
  zusatzleistungen: Zusatzleistungen;
  onZusatzleistungenChange: (zusatzleistungen: Zusatzleistungen) => void;
  errors?: Record<string, string>;
}

export function Step7Zusatzleistungen({
  zusatzleistungen,
  onZusatzleistungenChange,
  errors = {},
}: Step7Props) {
  const updateField = <K extends keyof Zusatzleistungen>(
    key: K,
    value: Zusatzleistungen[K]
  ) => {
    onZusatzleistungenChange({
      ...zusatzleistungen,
      [key]: value,
    });
  };

  const updateTeppichboden = (updates: Partial<Zusatzleistungen["teppichboden"]>) => {
    onZusatzleistungenChange({
      ...zusatzleistungen,
      teppichboden: {
        ...zusatzleistungen.teppichboden,
        ...updates,
      },
    });
  };

  const activeServices = [
    zusatzleistungen.hochdruck_reinigung,
    zusatzleistungen.kamin_reinigung,
    zusatzleistungen.teppichboden.aktiv,
    zusatzleistungen.fugenreinigung,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Zusatzleistungen
        </h2>
        <p className="text-sm text-gray-500">
          Wählen Sie optionale Zusatzservices, die am besten zu Ihren Bedürfnissen passen.
        </p>
      </div>

      {/* Toggle Service Cards */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Verfügbare Zusatzservices</Label>
        
        <div className="space-y-3">
          {/* Hochdruckreinigung */}
          <ToggleServiceCard
            active={zusatzleistungen.hochdruck_reinigung}
            onToggle={(active) => updateField("hochdruck_reinigung", active)}
            icon={<Droplets className="w-5 h-5" />}
            title="Einladend sauberer Balkon gewünscht?"
            subtitle="Hochdruck-Reinigung für Balkon/Terrasse"
          />

          {/* Kaminreinigung */}
          <ToggleServiceCard
            active={zusatzleistungen.kamin_reinigung}
            onToggle={(active) => updateField("kamin_reinigung", active)}
            icon={<Flame className="w-5 h-5" />}
            title="Kamin wieder zum Glänzen bringen?"
            subtitle="Reinigen der Feuerstelle und Kaminumgebung"
          />

          {/* Teppichbodenreinigung - with expandable content */}
          <ToggleServiceCard
            active={zusatzleistungen.teppichboden.aktiv}
            onToggle={(active) => {
              updateTeppichboden({ 
                aktiv: active,
                anzahl_raeume: active ? Math.max(1, zusatzleistungen.teppichboden.anzahl_raeume) : 0
              });
            }}
            icon={<Footprints className="w-5 h-5" />}
            title="Teppichboden wie neu aussehen lassen?"
            subtitle="Professionelle Reinigung der Teppichböden"
            expandable
          >
            <CounterInput
              label="Anzahl der Räume mit Teppichboden"
              value={zusatzleistungen.teppichboden.anzahl_raeume}
              onChange={(value) => updateTeppichboden({ anzahl_raeume: value })}
              min={1}
              max={20}
              description="Wie viele Räume haben Teppichboden?"
            />
            {errors["teppichboden.anzahl_raeume"] && (
              <p className="text-sm text-destructive mt-2">
                {errors["teppichboden.anzahl_raeume"]}
              </p>
            )}
          </ToggleServiceCard>

          {/* Fugenreinigung */}
          <ToggleServiceCard
            active={zusatzleistungen.fugenreinigung}
            onToggle={(active) => updateField("fugenreinigung", active)}
            icon={<Grid3X3 className="w-5 h-5" />}
            title="Fugen wieder strahlend weiss?"
            subtitle="Fugenreinigung von Steinböden und Fliesen"
          />
        </div>

        {errors.zusatzleistungen && (
          <p className="text-sm text-destructive">{errors.zusatzleistungen}</p>
        )}
      </div>

      {/* Summary */}
      {activeServices > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 font-medium">
            {activeServices} Zusatzservice{activeServices !== 1 ? "s" : ""} ausgewählt
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Diese werden in Ihrem Angebot berücksichtigt.
          </p>
        </div>
      )}

      {/* Info box */}
      <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <strong>Hinweis:</strong> Zusatzleistungen sind optional und können den 
          Gesamtpreis beeinflussen. Sie erhalten separate Preise für jede gewählte 
          Zusatzleistung in Ihrem Angebot.
        </p>
      </div>
    </div>
  );
}

export default Step7Zusatzleistungen;


