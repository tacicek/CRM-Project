// Step3CurrentAddress.tsx - Current property address

import { AddressInput } from "../ui/AddressInput";
import { PropertyDetails } from "@/types/umzug";
import { MapPin, Lightbulb } from "lucide-react";

interface Step3Props {
  data: PropertyDetails;
  onChange: (data: Partial<PropertyDetails>) => void;
  errors?: Record<string, string>;
}

export const Step3CurrentAddress = ({ data, onChange, errors = {} }: Step3Props) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 mb-4">
          <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          Adresse der aktuellen Unterkunft
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Von wo wird der Umzug stattfinden?
        </p>
      </div>

      {/* Address Input */}
      <AddressInput
        value={data.adresse}
        onChange={(adresse) => onChange({ adresse })}
        errors={{
          strasse: errors['auszug.adresse.strasse'],
          hausnummer: errors['auszug.adresse.hausnummer'],
          plz: errors['auszug.adresse.plz'],
          ort: errors['auszug.adresse.ort'],
        }}
      />

      {/* Info Note */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Tipp:</strong> Die genaue Adresse hilft uns, die Distanz zu berechnen 
          und Ihnen ein präzises Angebot zu erstellen.
        </p>
      </div>
    </div>
  );
};


