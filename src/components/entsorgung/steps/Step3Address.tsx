import { EntsorgungsAdresse } from "@/types/entsorgung";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

interface Step3AddressProps {
  address: EntsorgungsAdresse;
  onChange: (address: EntsorgungsAdresse) => void;
}

export const Step3Address = ({ address, onChange }: Step3AddressProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Wo soll entsorgt werden?
        </h2>
        <p className="mt-2 text-gray-600">
          Geben Sie die Adresse an, wo die Entsorgung stattfinden soll
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
        <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
        <p className="text-sm text-green-800">
          Die genaue Adresse hilft uns, Ihnen passende Entsorgungsfirmen in Ihrer Nähe zu vermitteln.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="strasse">Strasse *</Label>
            <Input
              id="strasse"
              placeholder="Musterstrasse"
              value={address.strasse}
              onChange={(e) => onChange({ ...address, strasse: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hausnummer">Nr. *</Label>
            <Input
              id="hausnummer"
              placeholder="12a"
              value={address.hausnummer}
              onChange={(e) => onChange({ ...address, hausnummer: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="plz">PLZ *</Label>
            <Input
              id="plz"
              placeholder="8000"
              maxLength={4}
              value={address.plz}
              onChange={(e) => onChange({ ...address, plz: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="ort">Ort *</Label>
            <Input
              id="ort"
              placeholder="Zürich"
              value={address.ort}
              onChange={(e) => onChange({ ...address, ort: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="land">Land</Label>
          <Input
            id="land"
            value={address.land}
            onChange={(e) => onChange({ ...address, land: e.target.value })}
            disabled
          />
        </div>
      </div>
    </div>
  );
};

export default Step3Address;

