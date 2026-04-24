import { EntsorgungsZugang } from "@/types/entsorgung";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Building, Car, Truck, Container } from "lucide-react";

interface Step4AccessProps {
  access: EntsorgungsZugang;
  onChange: (access: EntsorgungsZugang) => void;
}

const floors = [
  { value: "basement", label: "Untergeschoss" },
  { value: "ground_floor", label: "Erdgeschoss" },
  { value: "floor_1", label: "1. Stock" },
  { value: "floor_2", label: "2. Stock" },
  { value: "floor_3", label: "3. Stock" },
  { value: "floor_4", label: "4. Stock" },
  { value: "floor_5", label: "5. Stock+" },
];

export const Step4Access = ({ access, onChange }: Step4AccessProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Wie ist der Zugang?
        </h2>
        <p className="mt-2 text-gray-600">
          Diese Informationen helfen bei der Planung der Entsorgung
        </p>
      </div>

      {/* Floor selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Building className="w-5 h-5 text-green-600" />
          Stockwerk
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {floors.map((floor) => (
            <button
              key={floor.value}
              type="button"
              onClick={() => onChange({ ...access, stockwerk: floor.value })}
              className={cn(
                "p-3 rounded-lg border-2 text-center transition-all",
                access.stockwerk === floor.value
                  ? "border-green-500 bg-green-50 font-medium"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              {floor.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lift options */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg">
              <Building className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <Label className="font-medium">Lift vorhanden?</Label>
              <p className="text-sm text-gray-500">Gibt es einen Aufzug im Gebäude?</p>
            </div>
          </div>
          <Switch
            checked={access.lift_vorhanden}
            onCheckedChange={(checked) => onChange({ ...access, lift_vorhanden: checked })}
          />
        </div>

        {access.lift_vorhanden && (
          <div className="flex items-center justify-between pl-12">
            <div>
              <Label className="font-medium">Lift für Transport nutzbar?</Label>
              <p className="text-sm text-gray-500">Ist der Lift gross genug für Möbel?</p>
            </div>
            <Switch
              checked={access.lift_nutzbar}
              onCheckedChange={(checked) => onChange({ ...access, lift_nutzbar: checked })}
            />
          </div>
        )}
      </div>

      {/* Parking */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg">
              <Car className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <Label className="font-medium">Parkplatz vorhanden?</Label>
              <p className="text-sm text-gray-500">Kann direkt vor dem Gebäude geparkt werden?</p>
            </div>
          </div>
          <Switch
            checked={access.parkplatz_vorhanden}
            onCheckedChange={(checked) => onChange({ ...access, parkplatz_vorhanden: checked })}
          />
        </div>

        {!access.parkplatz_vorhanden && (
          <div className="pl-12 space-y-2">
            <Label>Distanz zum nächsten Parkplatz (Meter)</Label>
            <Input
              type="number"
              placeholder="z.B. 50"
              value={access.parkplatz_distanz_m || ""}
              onChange={(e) => onChange({ ...access, parkplatz_distanz_m: parseInt(e.target.value) || 0 })}
            />
          </div>
        )}
      </div>

      {/* LKW Access */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg">
              <Truck className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <Label className="font-medium">Zufahrt für LKW möglich?</Label>
              <p className="text-sm text-gray-500">Kann ein Lastwagen die Adresse anfahren?</p>
            </div>
          </div>
          <Switch
            checked={access.zufahrt_lkw}
            onCheckedChange={(checked) => onChange({ ...access, zufahrt_lkw: checked })}
          />
        </div>
      </div>

      {/* Container space */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg">
              <Container className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <Label className="font-medium">Stellplatz für Container?</Label>
              <p className="text-sm text-gray-500">Gibt es Platz für einen Entsorgungscontainer?</p>
            </div>
          </div>
          <Switch
            checked={access.container_stellplatz}
            onCheckedChange={(checked) => onChange({ ...access, container_stellplatz: checked })}
          />
        </div>
      </div>

      {/* Additional notes */}
      <div className="space-y-2">
        <Label>Besonderheiten beim Zugang (optional)</Label>
        <Textarea
          placeholder="z.B. Hinterhof, enger Durchgang, Zugangscode erforderlich..."
          value={access.besonderheiten || ""}
          onChange={(e) => onChange({ ...access, besonderheiten: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
};

export default Step4Access;

