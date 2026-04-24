// Step3Address.tsx - Address input step for Räumung wizard

import { RaeumungAddress, swissCantons } from "@/types/raeumung";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";

interface Step3AddressProps {
  address: RaeumungAddress;
  onChange: (address: RaeumungAddress) => void;
}

const countries = [
  { code: "CH", name: "Schweiz", flag: "🇨🇭" },
  { code: "DE", name: "Deutschland", flag: "🇩🇪" },
  { code: "AT", name: "Österreich", flag: "🇦🇹" },
  { code: "FR", name: "Frankreich", flag: "🇫🇷" },
  { code: "IT", name: "Italien", flag: "🇮🇹" },
  { code: "LI", name: "Liechtenstein", flag: "🇱🇮" },
];

export const Step3Address = ({ address, onChange }: Step3AddressProps) => {
  // Simple PLZ lookup for Swiss addresses
  const handlePlzChange = async (plz: string) => {
    onChange({ ...address, plz });

    // Only lookup for Swiss addresses with 4-digit PLZ
    if (address.land === "CH" && plz.length === 4 && /^\d{4}$/.test(plz)) {
      try {
        // Using a simple mapping for common PLZ codes
        const plzMapping: Record<string, { city: string; canton: string }> = {
          "8000": { city: "Zürich", canton: "ZH" },
          "8001": { city: "Zürich", canton: "ZH" },
          "8004": { city: "Zürich", canton: "ZH" },
          "8005": { city: "Zürich", canton: "ZH" },
          "8006": { city: "Zürich", canton: "ZH" },
          "8008": { city: "Zürich", canton: "ZH" },
          "8032": { city: "Zürich", canton: "ZH" },
          "8037": { city: "Zürich", canton: "ZH" },
          "8038": { city: "Zürich", canton: "ZH" },
          "8041": { city: "Zürich", canton: "ZH" },
          "8044": { city: "Zürich", canton: "ZH" },
          "8045": { city: "Zürich", canton: "ZH" },
          "8046": { city: "Zürich", canton: "ZH" },
          "8047": { city: "Zürich", canton: "ZH" },
          "8048": { city: "Zürich", canton: "ZH" },
          "8049": { city: "Zürich", canton: "ZH" },
          "8050": { city: "Zürich", canton: "ZH" },
          "8051": { city: "Zürich", canton: "ZH" },
          "8052": { city: "Zürich", canton: "ZH" },
          "8053": { city: "Zürich", canton: "ZH" },
          "8055": { city: "Zürich", canton: "ZH" },
          "8057": { city: "Zürich", canton: "ZH" },
          "8063": { city: "Zürich", canton: "ZH" },
          "8064": { city: "Zürich", canton: "ZH" },
          "3000": { city: "Bern", canton: "BE" },
          "3001": { city: "Bern", canton: "BE" },
          "3004": { city: "Bern", canton: "BE" },
          "3005": { city: "Bern", canton: "BE" },
          "3006": { city: "Bern", canton: "BE" },
          "3007": { city: "Bern", canton: "BE" },
          "3008": { city: "Bern", canton: "BE" },
          "3012": { city: "Bern", canton: "BE" },
          "3013": { city: "Bern", canton: "BE" },
          "3014": { city: "Bern", canton: "BE" },
          "3015": { city: "Bern", canton: "BE" },
          "3018": { city: "Bern", canton: "BE" },
          "4000": { city: "Basel", canton: "BS" },
          "4001": { city: "Basel", canton: "BS" },
          "4051": { city: "Basel", canton: "BS" },
          "4052": { city: "Basel", canton: "BS" },
          "4053": { city: "Basel", canton: "BS" },
          "4054": { city: "Basel", canton: "BS" },
          "4055": { city: "Basel", canton: "BS" },
          "4056": { city: "Basel", canton: "BS" },
          "4057": { city: "Basel", canton: "BS" },
          "4058": { city: "Basel", canton: "BS" },
          "1000": { city: "Lausanne", canton: "VD" },
          "1003": { city: "Lausanne", canton: "VD" },
          "1004": { city: "Lausanne", canton: "VD" },
          "1005": { city: "Lausanne", canton: "VD" },
          "1006": { city: "Lausanne", canton: "VD" },
          "1007": { city: "Lausanne", canton: "VD" },
          "1200": { city: "Genf", canton: "GE" },
          "1201": { city: "Genf", canton: "GE" },
          "1202": { city: "Genf", canton: "GE" },
          "1203": { city: "Genf", canton: "GE" },
          "1204": { city: "Genf", canton: "GE" },
          "1205": { city: "Genf", canton: "GE" },
          "1206": { city: "Genf", canton: "GE" },
          "6000": { city: "Luzern", canton: "LU" },
          "6003": { city: "Luzern", canton: "LU" },
          "6004": { city: "Luzern", canton: "LU" },
          "6005": { city: "Luzern", canton: "LU" },
          "6006": { city: "Luzern", canton: "LU" },
          "9000": { city: "St. Gallen", canton: "SG" },
          "9001": { city: "St. Gallen", canton: "SG" },
          "9004": { city: "St. Gallen", canton: "SG" },
          "9006": { city: "St. Gallen", canton: "SG" },
          "9007": { city: "St. Gallen", canton: "SG" },
          "9008": { city: "St. Gallen", canton: "SG" },
          "5000": { city: "Aarau", canton: "AG" },
          "5001": { city: "Aarau", canton: "AG" },
          "5004": { city: "Aarau", canton: "AG" },
          "8400": { city: "Winterthur", canton: "ZH" },
          "8401": { city: "Winterthur", canton: "ZH" },
          "8402": { city: "Winterthur", canton: "ZH" },
          "8404": { city: "Winterthur", canton: "ZH" },
          "8405": { city: "Winterthur", canton: "ZH" },
          "8406": { city: "Winterthur", canton: "ZH" },
        };

        if (plzMapping[plz]) {
          onChange({
            ...address,
            plz,
            ort: plzMapping[plz].city,
            kanton: plzMapping[plz].canton,
          });
        }
      } catch (error) {
        console.error("PLZ lookup failed:", error);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Adresse des Objekts
        </h2>
        <p className="text-gray-600">
          Wo befindet sich das zu räumende Objekt?
        </p>
      </div>

      {/* Address icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <MapPin className="w-8 h-8 text-blue-600" />
        </div>
      </div>

      {/* Country selector */}
      <div className="space-y-2">
        <Label className="text-base font-medium">Land</Label>
        <Select
          value={address.land}
          onValueChange={(value) => onChange({ ...address, land: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Land auswählen" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <span className="flex items-center gap-2">
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Street and house number */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-2">
          <Label className="text-base font-medium">Strasse</Label>
          <Input
            type="text"
            value={address.strasse}
            onChange={(e) => onChange({ ...address, strasse: e.target.value })}
            placeholder="Strassenname"
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-base font-medium">Nr.</Label>
          <Input
            type="text"
            value={address.hausnummer}
            onChange={(e) => onChange({ ...address, hausnummer: e.target.value })}
            placeholder="123"
            className="w-full"
          />
        </div>
      </div>

      {/* PLZ and City */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-base font-medium">PLZ</Label>
          <Input
            type="text"
            value={address.plz}
            onChange={(e) => handlePlzChange(e.target.value)}
            placeholder={address.land === "CH" ? "8000" : "PLZ"}
            maxLength={address.land === "CH" ? 4 : 5}
            className="w-full"
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label className="text-base font-medium">Stadt</Label>
          <Input
            type="text"
            value={address.ort}
            onChange={(e) => onChange({ ...address, ort: e.target.value })}
            placeholder="Stadt"
            className="w-full"
          />
        </div>
      </div>

      {/* Canton (only for Switzerland) */}
      {address.land === "CH" && (
        <div className="space-y-2">
          <Label className="text-base font-medium">Kanton</Label>
          <Select
            value={address.kanton}
            onValueChange={(value) => onChange({ ...address, kanton: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Kanton auswählen" />
            </SelectTrigger>
            <SelectContent>
              {swissCantons.map((canton) => (
                <SelectItem key={canton.code} value={canton.code}>
                  {canton.code} - {canton.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📍</span>
          <div>
            <h4 className="font-semibold text-blue-800">
              Genauer Standort
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              Die genaue Adresse hilft uns, passende Anbieter in Ihrer Nähe zu finden
              und Ihnen präzise Angebote zu erstellen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3Address;


