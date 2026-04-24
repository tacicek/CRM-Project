import { Warehouse, Home, Car, Flower2, LayoutPanelLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectableCard } from "../ui/SelectableCard";
import { ZusatzRaeume } from "@/types/reinigung";

interface Step2Props {
  wohnflaecheM2: number;
  zusatzRaeume: ZusatzRaeume;
  onZusatzRaeumeChange: (zusatzRaeume: ZusatzRaeume) => void;
  errors?: Record<string, string>;
}

export function Step2Raeume({
  wohnflaecheM2,
  zusatzRaeume,
  onZusatzRaeumeChange,
  errors = {},
}: Step2Props) {
  const toggleRoom = (room: keyof Omit<ZusatzRaeume, "balkon">) => {
    onZusatzRaeumeChange({
      ...zusatzRaeume,
      [room]: !zusatzRaeume[room],
    });
  };

  const updateBalkon = (updates: Partial<ZusatzRaeume["balkon"]>) => {
    onZusatzRaeumeChange({
      ...zusatzRaeume,
      balkon: {
        ...zusatzRaeume.balkon,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Zu reinigende Räume
        </h2>
        <p className="text-sm text-gray-500">
          Die zuvor angegebene Wohnfläche ({wohnflaecheM2} m², inkl. Küche, Bad, Toilette) ist enthalten.
          Wählen Sie zusätzliche Bereiche, die gereinigt werden sollen.
        </p>
      </div>

      {/* Room Selection Grid */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Zusätzliche Räume</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Keller */}
          <SelectableCard
            selected={zusatzRaeume.keller}
            onSelect={() => toggleRoom("keller")}
            icon={<Warehouse className="w-5 h-5" />}
            title="Keller/Kellerabteil"
            description="Kellerräume und Abstellräume"
          />

          {/* Dachboden */}
          <SelectableCard
            selected={zusatzRaeume.dachboden}
            onSelect={() => toggleRoom("dachboden")}
            icon={<Home className="w-5 h-5" />}
            title="Dachboden"
            description="Estrich oder Dachgeschoss"
          />

          {/* Garage */}
          <SelectableCard
            selected={zusatzRaeume.garage}
            onSelect={() => toggleRoom("garage")}
            icon={<Car className="w-5 h-5" />}
            title="Garage"
            description="Garage oder Carport"
          />

          {/* Wintergarten */}
          <SelectableCard
            selected={zusatzRaeume.wintergarten}
            onSelect={() => toggleRoom("wintergarten")}
            icon={<Flower2 className="w-5 h-5" />}
            title="Wintergarten"
            description="Verglaster Anbau"
          />
        </div>
      </div>

      {/* Balkon/Terrasse - With sub-options */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Balkon / Terrasse</Label>
        <SelectableCard
          selected={zusatzRaeume.balkon.aktiv}
          onSelect={() => updateBalkon({ aktiv: !zusatzRaeume.balkon.aktiv })}
          icon={<LayoutPanelLeft className="w-5 h-5" />}
          title="Balkon/Terrasse"
          description="Aussenbereich mit Boden und Geländer"
        >
          {/* Sub-options when selected */}
          <div className="space-y-4">
            {/* Area input */}
            <div className="space-y-2">
              <Label htmlFor="balkon_flaeche" className="text-sm">
                Fläche in m²
              </Label>
              <div className="relative max-w-[200px]">
                <Input
                  id="balkon_flaeche"
                  type="number"
                  min={1}
                  max={200}
                  placeholder="z.B. 15"
                  value={zusatzRaeume.balkon.flaeche_m2 || ""}
                  onChange={(e) =>
                    updateBalkon({ flaeche_m2: parseInt(e.target.value) || 0 })
                  }
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  m²
                </span>
              </div>
              {errors["balkon.flaeche_m2"] && (
                <p className="text-sm text-destructive">{errors["balkon.flaeche_m2"]}</p>
              )}
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hochdruckreinigung"
                  checked={zusatzRaeume.balkon.hochdruckreinigung}
                  onCheckedChange={(checked) =>
                    updateBalkon({ hochdruckreinigung: checked === true })
                  }
                />
                <Label htmlFor="hochdruckreinigung" className="text-sm cursor-pointer">
                  Hochdruckreinigung gewünscht
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="glas_gelaender"
                  checked={zusatzRaeume.balkon.glas_gelaender}
                  onCheckedChange={(checked) =>
                    updateBalkon({ glas_gelaender: checked === true })
                  }
                />
                <Label htmlFor="glas_gelaender" className="text-sm cursor-pointer">
                  Das Balkongeländer ist aus Glas
                </Label>
              </div>
            </div>
          </div>
        </SelectableCard>
      </div>
    </div>
  );
}

export default Step2Raeume;


