// Step5Scope.tsx - Clearance scope step for Räumung wizard

import { ClearanceScopeDetails, ClearanceScope, clearanceAreas } from "@/types/raeumung";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { 
  Check, Home, Package, Sofa, BedDouble, DoorClosed, 
  Armchair, BookOpen, Plug, Snowflake, WashingMachine, 
  Monitor, Laptop, Zap, AlertTriangle, Paintbrush, 
  FlaskConical, Battery, Pill, Fuel, Weight, Piano, 
  Lock, Fish, Circle, Waves, Archive, Lightbulb
} from "lucide-react";
import { InventoryCounter } from "../ui/InventoryCounter";
import { AreaCheckboxCard } from "../ui/AreaCheckboxCard";

interface Step5ScopeProps {
  scope: ClearanceScopeDetails;
  onChange: (scope: ClearanceScopeDetails) => void;
}

export const Step5Scope = ({ scope, onChange }: Step5ScopeProps) => {
  const handleScopeChange = (newScope: ClearanceScope) => {
    onChange({ ...scope, scope: newScope });
  };

  const handleAreaToggle = (areaId: string) => {
    const currentAreas = scope.bereiche || [];
    const newAreas = currentAreas.includes(areaId)
      ? currentAreas.filter((a) => a !== areaId)
      : [...currentAreas, areaId];
    onChange({ ...scope, bereiche: newAreas });
  };

  const updateMoebelInventar = (key: string, value: number) => {
    onChange({
      ...scope,
      inventar: {
        ...scope.inventar,
        moebel: { ...scope.inventar.moebel, [key]: value },
      },
    });
  };

  const updateElektroInventar = (key: string, value: number) => {
    onChange({
      ...scope,
      inventar: {
        ...scope.inventar,
        elektro: { ...scope.inventar.elektro, [key]: value },
      },
    });
  };

  const updateSondermuellInventar = (key: string, value: number) => {
    onChange({
      ...scope,
      inventar: {
        ...scope.inventar,
        sondermuell: { ...scope.inventar.sondermuell, [key]: value },
      },
    });
  };

  const updateSchwereInventar = (key: string, value: number) => {
    onChange({
      ...scope,
      inventar: {
        ...scope.inventar,
        schwer: { ...scope.inventar.schwer, [key]: value },
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Umfang der Räumung
        </h2>
        <p className="text-gray-600">
          Was soll geräumt werden?
        </p>
      </div>

      {/* Scope Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Art der Räumung</Label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleScopeChange("complete")}
            className={cn(
              "flex flex-col items-center p-6 rounded-xl border-2 transition-all",
              scope.scope === "complete"
                ? "border-blue-500 bg-blue-50/50 shadow-md"
                : "border-gray-200 hover:border-blue-300"
            )}
          >
            {scope.scope === "complete" && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Home className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <span className="font-semibold text-lg">Komplette Räumung</span>
            <span className="text-sm text-gray-500 text-center mt-2">
              Das gesamte Objekt wird geräumt
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleScopeChange("partial")}
            className={cn(
              "flex flex-col items-center p-6 rounded-xl border-2 transition-all",
              scope.scope === "partial"
                ? "border-blue-500 bg-blue-50/50 shadow-md"
                : "border-gray-200 hover:border-blue-300"
            )}
          >
            {scope.scope === "partial" && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Package className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <span className="font-semibold text-lg">Teilräumung</span>
            <span className="text-sm text-gray-500 text-center mt-2">
              Nur bestimmte Bereiche/Gegenstände
            </span>
          </button>
        </div>
      </div>

      {/* Area selection for partial clearance */}
      {scope.scope === "partial" && (
        <div className="space-y-4">
          <Label className="text-base font-medium">
            Welche Bereiche sollen geräumt werden?
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {clearanceAreas.map((area) => (
              <AreaCheckboxCard
                key={area.id}
                id={area.id}
                label={area.label}
                selected={(scope.bereiche || []).includes(area.id)}
                onChange={() => handleAreaToggle(area.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Estimated Volume */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-base font-medium">
            Geschätztes Volumen
          </Label>
          <span className="text-lg font-semibold text-blue-600">
            ~{scope.volumen_m3} m³
          </span>
        </div>
        <Slider
          value={[scope.volumen_m3]}
          onValueChange={(vals) => onChange({ ...scope, volumen_m3: vals[0] })}
          min={1}
          max={100}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1 m³</span>
          <span>25 m³</span>
          <span>50 m³</span>
          <span>75 m³</span>
          <span>100+ m³</span>
        </div>
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-gray-400" />
          Tipp: 1 m³ entspricht etwa 10 Umzugskartons
        </p>
      </div>

      {/* Furniture Inventory */}
      <div className="space-y-4">
        <Label className="text-base font-medium flex items-center gap-2">
          <Sofa className="w-5 h-5 text-gray-500" /> Möbel
        </Label>
        <div className="space-y-2">
          <InventoryCounter
            label="Sofas / Sessel"
            icon={<Sofa className="w-5 h-5" />}
            value={scope.inventar.moebel.sofas}
            onChange={(val) => updateMoebelInventar("sofas", val)}
          />
          <InventoryCounter
            label="Betten / Matratzen"
            icon={<BedDouble className="w-5 h-5" />}
            value={scope.inventar.moebel.betten}
            onChange={(val) => updateMoebelInventar("betten", val)}
          />
          <InventoryCounter
            label="Schränke / Kommoden"
            icon={<DoorClosed className="w-5 h-5" />}
            value={scope.inventar.moebel.schraenke}
            onChange={(val) => updateMoebelInventar("schraenke", val)}
          />
          <InventoryCounter
            label="Tische / Stühle"
            icon={<Armchair className="w-5 h-5" />}
            value={scope.inventar.moebel.tische}
            onChange={(val) => updateMoebelInventar("tische", val)}
          />
          <InventoryCounter
            label="Regale"
            icon={<BookOpen className="w-5 h-5" />}
            value={scope.inventar.moebel.regale}
            onChange={(val) => updateMoebelInventar("regale", val)}
          />
        </div>
      </div>

      {/* Electronics */}
      <div className="space-y-4">
        <Label className="text-base font-medium flex items-center gap-2">
          <Plug className="w-5 h-5 text-gray-500" /> Elektrogeräte
        </Label>
        <div className="space-y-2">
          <InventoryCounter
            label="Kühlschrank / Gefrierschrank"
            icon={<Snowflake className="w-5 h-5" />}
            value={scope.inventar.elektro.kuehlschrank}
            onChange={(val) => updateElektroInventar("kuehlschrank", val)}
          />
          <InventoryCounter
            label="Waschmaschine / Trockner"
            icon={<WashingMachine className="w-5 h-5" />}
            value={scope.inventar.elektro.waschmaschine}
            onChange={(val) => updateElektroInventar("waschmaschine", val)}
          />
          <InventoryCounter
            label="Fernseher / Monitore"
            icon={<Monitor className="w-5 h-5" />}
            value={scope.inventar.elektro.fernseher}
            onChange={(val) => updateElektroInventar("fernseher", val)}
          />
          <InventoryCounter
            label="Computer / Laptops"
            icon={<Laptop className="w-5 h-5" />}
            value={scope.inventar.elektro.computer}
            onChange={(val) => updateElektroInventar("computer", val)}
          />
          <InventoryCounter
            label="Sonstige Geräte"
            icon={<Zap className="w-5 h-5" />}
            value={scope.inventar.elektro.sonstige}
            onChange={(val) => updateElektroInventar("sonstige", val)}
          />
        </div>
      </div>

      {/* Hazardous Materials */}
      <div className="space-y-4">
        <Label className="text-base font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-gray-500" /> Sondermüll (falls vorhanden)
        </Label>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
          <p className="text-sm text-amber-700">
            Sondermüll erfordert spezielle Entsorgung. Bitte geben Sie an, was vorhanden ist.
          </p>
        </div>
        <div className="space-y-2">
          <InventoryCounter
            label="Farben / Lacke"
            icon={<Paintbrush className="w-5 h-5" />}
            value={scope.inventar.sondermuell.farben}
            onChange={(val) => updateSondermuellInventar("farben", val)}
            showWarning
            warningText="Sonderentsorgung"
          />
          <InventoryCounter
            label="Chemikalien"
            icon={<FlaskConical className="w-5 h-5" />}
            value={scope.inventar.sondermuell.chemikalien}
            onChange={(val) => updateSondermuellInventar("chemikalien", val)}
            showWarning
            warningText="Sonderentsorgung"
          />
          <InventoryCounter
            label="Batterien / Akkus"
            icon={<Battery className="w-5 h-5" />}
            value={scope.inventar.sondermuell.batterien}
            onChange={(val) => updateSondermuellInventar("batterien", val)}
          />
          <InventoryCounter
            label="Medikamente"
            icon={<Pill className="w-5 h-5" />}
            value={scope.inventar.sondermuell.medikamente}
            onChange={(val) => updateSondermuellInventar("medikamente", val)}
          />
          <InventoryCounter
            label="Öle / Schmierstoffe"
            icon={<Fuel className="w-5 h-5" />}
            value={scope.inventar.sondermuell.oele}
            onChange={(val) => updateSondermuellInventar("oele", val)}
            showWarning
            warningText="Sonderentsorgung"
          />
        </div>
      </div>

      {/* Heavy / Special Items */}
      <div className="space-y-4">
        <Label className="text-base font-medium flex items-center gap-2">
          <Weight className="w-5 h-5 text-gray-500" /> Schwere / Spezielle Gegenstände
        </Label>
        <div className="space-y-2">
          <InventoryCounter
            label="Klavier / Piano"
            icon={<Piano className="w-5 h-5" />}
            value={scope.inventar.schwer.klavier}
            onChange={(val) => updateSchwereInventar("klavier", val)}
            showWarning
            warningText="Spezialentsorgung +CHF"
          />
          <InventoryCounter
            label="Tresor / Safe"
            icon={<Lock className="w-5 h-5" />}
            value={scope.inventar.schwer.tresor}
            onChange={(val) => updateSchwereInventar("tresor", val)}
            showWarning
            warningText="Gewichtsabhängig"
          />
          <InventoryCounter
            label="Aquarium (gross)"
            icon={<Fish className="w-5 h-5" />}
            value={scope.inventar.schwer.aquarium}
            onChange={(val) => updateSchwereInventar("aquarium", val)}
          />
          <InventoryCounter
            label="Billardtisch"
            icon={<Circle className="w-5 h-5" />}
            value={scope.inventar.schwer.billardtisch}
            onChange={(val) => updateSchwereInventar("billardtisch", val)}
            showWarning
            warningText="Demontage erforderlich"
          />
          <InventoryCounter
            label="Sauna / Whirlpool"
            icon={<Waves className="w-5 h-5" />}
            value={scope.inventar.schwer.sauna}
            onChange={(val) => updateSchwereInventar("sauna", val)}
            showWarning
            warningText="Spezialentsorgung"
          />
        </div>
      </div>

      {/* Boxes */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-base font-medium flex items-center gap-2">
            <Archive className="w-5 h-5 text-gray-500" /> Geschätzte Anzahl Kartons
          </Label>
          <span className="text-lg font-semibold text-blue-600">
            ~{scope.kartons_anzahl} Kartons
          </span>
        </div>
        <Slider
          value={[scope.kartons_anzahl]}
          onValueChange={(vals) => onChange({ ...scope, kartons_anzahl: vals[0] })}
          min={0}
          max={200}
          step={5}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>0</span>
          <span>50</span>
          <span>100</span>
          <span>150</span>
          <span>200+</span>
        </div>
      </div>
    </div>
  );
};

export default Step5Scope;


