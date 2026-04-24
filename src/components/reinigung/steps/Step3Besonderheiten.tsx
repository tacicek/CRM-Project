import { 
  CheckCircle, 
  DoorClosed, 
  Flame, 
  WashingMachine, 
  PawPrint,
  Sofa 
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { SelectableCard } from "../ui/SelectableCard";
import { Besonderheiten } from "@/types/reinigung";

interface Step3Props {
  besonderheiten: Besonderheiten;
  onBesonderheitenChange: (besonderheiten: Besonderheiten) => void;
  errors?: Record<string, string>;
}

export function Step3Besonderheiten({
  besonderheiten,
  onBesonderheitenChange,
  errors = {},
}: Step3Props) {
  const handleToggle = (key: keyof Besonderheiten) => {
    if (key === "keine") {
      // If "keine" is selected, deselect all others
      onBesonderheitenChange({
        keine: true,
        einbauschraenke: false,
        stark_verhaerteter_dreck_kueche: false,
        waschturm: false,
        haustierhaltung: false,
        moebel_vorhanden: false,
      });
    } else {
      // If any other option is selected, deselect "keine"
      onBesonderheitenChange({
        ...besonderheiten,
        keine: false,
        [key]: !besonderheiten[key],
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Besonderheiten in Ihrem Zuhause
        </h2>
        <p className="text-sm text-gray-500">
          Gibt es spezielle Umstände, die wir bei der Reinigung berücksichtigen sollten?
          Diese Informationen helfen uns, ein genaueres Angebot zu erstellen.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Wählen Sie alle zutreffenden Optionen</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Keine Besonderheiten - Default selected */}
          <SelectableCard
            selected={besonderheiten.keine}
            onSelect={() => handleToggle("keine")}
            icon={<CheckCircle className="w-5 h-5" />}
            title="Keine Besonderheiten"
            description="Standardreinigung ohne besondere Anforderungen"
            className={besonderheiten.keine ? "border-green-500 bg-green-50/50" : ""}
          />

          {/* Einbauschränke */}
          <SelectableCard
            selected={besonderheiten.einbauschraenke}
            onSelect={() => handleToggle("einbauschraenke")}
            icon={<DoorClosed className="w-5 h-5" />}
            title="Einbauschränke zum Reinigen"
            description="Exkl. Küche - zusätzliche Schrankreinigung"
          />

          {/* Stark verhärteter Dreck in der Küche */}
          <SelectableCard
            selected={besonderheiten.stark_verhaerteter_dreck_kueche}
            onSelect={() => handleToggle("stark_verhaerteter_dreck_kueche")}
            icon={<Flame className="w-5 h-5" />}
            title="Stark verhärteter Dreck in der Küche"
            description="z.B. im Ofen, auf Herdplatten"
          />

          {/* Waschturm */}
          <SelectableCard
            selected={besonderheiten.waschturm}
            onSelect={() => handleToggle("waschturm")}
            icon={<WashingMachine className="w-5 h-5" />}
            title="Waschturm"
            description="Waschmaschine/Trockner vorhanden"
          />

          {/* Haustierhaltung */}
          <SelectableCard
            selected={besonderheiten.haustierhaltung}
            onSelect={() => handleToggle("haustierhaltung")}
            icon={<PawPrint className="w-5 h-5" />}
            title="Haustierhaltung"
            description="Haare und Gerüche von Haustieren"
          />

          {/* Möbel vorhanden */}
          <SelectableCard
            selected={besonderheiten.moebel_vorhanden}
            onSelect={() => handleToggle("moebel_vorhanden")}
            icon={<Sofa className="w-5 h-5" />}
            title="Möbel sind noch vorhanden"
            description="Reinigung um Möbel herum"
          />
        </div>
        {errors.besonderheiten && (
          <p className="text-sm text-destructive">{errors.besonderheiten}</p>
        )}
      </div>

      {/* Info box */}
      {!besonderheiten.keine && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <strong>Hinweis:</strong> Besondere Umstände können den Reinigungsaufwand 
            und damit den Preis beeinflussen. Unsere Partner werden dies bei der 
            Angebotserstellung berücksichtigen.
          </p>
        </div>
      )}
    </div>
  );
}

export default Step3Besonderheiten;


