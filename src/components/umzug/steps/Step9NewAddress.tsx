// Step9NewAddress.tsx - New property address

import { AddressInput } from "../ui/AddressInput";
import { PropertyDetails } from "@/types/umzug";
import { MapPin, Navigation } from "lucide-react";

interface Step9Props {
  data: PropertyDetails;
  onChange: (data: Partial<PropertyDetails>) => void;
  errors?: Record<string, string>;
}

export const Step9NewAddress = ({ data, onChange, errors = {} }: Step9Props) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <Navigation className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
          Adresse der neuen Unterkunft
        </h2>
        <p className="text-gray-600">
          Wohin sollen wir Ihre Sachen bringen?
        </p>
      </div>

      {/* Address Input */}
      <AddressInput
        value={data.adresse}
        onChange={(adresse) => onChange({ adresse })}
        errors={{
          strasse: errors['einzug.adresse.strasse'],
          hausnummer: errors['einzug.adresse.hausnummer'],
          plz: errors['einzug.adresse.plz'],
          ort: errors['einzug.adresse.ort'],
        }}
      />

      {/* Info Note */}
      <div className="p-4 rounded-xl bg-green-50 border border-green-200">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">
            <strong>Tipp:</strong> Wir berechnen automatisch die Distanz zwischen 
            beiden Adressen, um Ihnen ein genaues Angebot zu erstellen.
          </p>
        </div>
      </div>
    </div>
  );
};


