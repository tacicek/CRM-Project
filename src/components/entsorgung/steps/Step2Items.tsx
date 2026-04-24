import { EntsorgungsMenge, EntsorgungsObjekte, EntsorgungsArt } from "@/types/entsorgung";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Package, Scale, Hash, Container } from "lucide-react";

interface Step2ItemsProps {
  menge: EntsorgungsMenge;
  objekte: EntsorgungsObjekte;
  wasteType: EntsorgungsArt;
  onMengeChange: (menge: EntsorgungsMenge) => void;
  onObjekteChange: (objekte: EntsorgungsObjekte) => void;
}

const containerSizes = [
  { value: "klein", label: "Klein (bis 1m³)", description: "Wenige Gegenstände" },
  { value: "mittel", label: "Mittel (2-3m³)", description: "Halbes Zimmer" },
  { value: "gross", label: "Gross (4-6m³)", description: "Ein Zimmer" },
  { value: "container_7m3", label: "Container 7m³", description: "Mehrere Räume" },
  { value: "container_10m3", label: "Container 10m³", description: "Wohnung" },
  { value: "container_20m3", label: "Container 20m³", description: "Haus" },
];

export const Step2Items = ({
  menge,
  objekte,
  wasteType,
  onMengeChange,
  onObjekteChange,
}: Step2ItemsProps) => {
  const getItemsForWasteType = () => {
    switch (wasteType) {
      case "sperrmuell":
        return [
          { key: "moebel", label: "Möbel (Schränke, Tische, Stühle)" },
          { key: "matratzen", label: "Matratzen & Betten" },
          { key: "teppiche", label: "Teppiche & Bodenbeläge" },
          { key: "holz", label: "Holzabfälle" },
        ];
      case "elektronik":
        return [
          { key: "elektrogeraete", label: "Elektrogeräte allgemein" },
          { key: "computer", label: "Computer & IT-Geräte" },
          { key: "fernseher", label: "Fernseher & Monitore" },
          { key: "kuehlschrank", label: "Kühlschränke & Gefriertruhen" },
          { key: "waschmaschine", label: "Waschmaschinen & Trockner" },
        ];
      case "bauschutt":
        return [
          { key: "beton", label: "Beton & Zement" },
          { key: "ziegel", label: "Ziegel & Backsteine" },
          { key: "fliesen", label: "Fliesen & Keramik" },
          { key: "gips", label: "Gipsplatten & Rigips" },
        ];
      case "gruenabfall":
        return [
          { key: "gartenabfall", label: "Gartenabfall allgemein" },
          { key: "baumschnitt", label: "Baumschnitt & Äste" },
          { key: "laub", label: "Laub & Rasenschnitt" },
        ];
      case "sondermuell":
        return [
          { key: "farben_lacke", label: "Farben & Lacke" },
          { key: "chemikalien", label: "Chemikalien & Lösungsmittel" },
          { key: "batterien", label: "Batterien & Akkus" },
          { key: "leuchtmittel", label: "Leuchtmittel (Neonröhren etc.)" },
          { key: "asbest", label: "Asbest (verdacht)" },
        ];
      default:
        return [
          { key: "moebel", label: "Möbel" },
          { key: "elektrogeraete", label: "Elektrogeräte" },
          { key: "holz", label: "Holz" },
        ];
    }
  };

  const items = getItemsForWasteType();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Was und wie viel soll entsorgt werden?
        </h2>
        <p className="mt-2 text-gray-600">
          Geben Sie die Menge und Art der Gegenstände an
        </p>
      </div>

      {/* Volume/Container Size Selection */}
      <div className="space-y-4">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Container className="w-5 h-5 text-green-600" />
          Geschätztes Volumen
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {containerSizes.map((size) => (
            <button
              key={size.value}
              type="button"
              onClick={() => onMengeChange({ ...menge, container_groesse: size.value as EntsorgungsMenge["container_groesse"] })}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                menge.container_groesse === size.value
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="font-medium">{size.label}</div>
              <div className="text-sm text-gray-500">{size.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Detailed measurements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Volumen (m³)
          </Label>
          <Input
            type="number"
            placeholder="z.B. 5"
            value={menge.volumen_m3 || ""}
            onChange={(e) => onMengeChange({ ...menge, volumen_m3: parseFloat(e.target.value) || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Geschätztes Gewicht (kg)
          </Label>
          <Input
            type="number"
            placeholder="z.B. 200"
            value={menge.gewicht_kg || ""}
            onChange={(e) => onMengeChange({ ...menge, gewicht_kg: parseFloat(e.target.value) || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Anzahl Teile
          </Label>
          <Input
            type="number"
            placeholder="z.B. 10"
            value={menge.anzahl_teile || ""}
            onChange={(e) => onMengeChange({ ...menge, anzahl_teile: parseInt(e.target.value) || undefined })}
          />
        </div>
      </div>

      {/* Items checklist */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Was wird entsorgt?</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => (
            <label
              key={item.key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                objekte[item.key as keyof EntsorgungsObjekte]
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <Checkbox
                checked={!!objekte[item.key as keyof EntsorgungsObjekte]}
                onCheckedChange={(checked) =>
                  onObjekteChange({ ...objekte, [item.key]: checked })
                }
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Other items */}
      <div className="space-y-2">
        <Label>Weitere Gegenstände (optional)</Label>
        <Textarea
          placeholder="Beschreiben Sie weitere Gegenstände, die entsorgt werden sollen..."
          value={objekte.sonstiges || ""}
          onChange={(e) => onObjekteChange({ ...objekte, sonstiges: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
};

export default Step2Items;

