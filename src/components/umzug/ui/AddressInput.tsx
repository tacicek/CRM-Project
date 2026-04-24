// AddressInput.tsx - Address input with country selector

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Address } from "@/types/umzug";

interface AddressInputProps {
  value: Address;
  onChange: (value: Address) => void;
  className?: string;
  errors?: Record<string, string>;
}

const COUNTRY_OPTIONS = [
  { value: 'CH', label: '🇨🇭 Schweiz', flag: '🇨🇭' },
  { value: 'DE', label: '🇩🇪 Deutschland', flag: '🇩🇪' },
  { value: 'AT', label: '🇦🇹 Österreich', flag: '🇦🇹' },
  { value: 'FR', label: '🇫🇷 Frankreich', flag: '🇫🇷' },
  { value: 'IT', label: '🇮🇹 Italien', flag: '🇮🇹' },
  { value: 'LI', label: '🇱🇮 Liechtenstein', flag: '🇱🇮' },
];

export const AddressInput = ({
  value,
  onChange,
  className,
  errors = {},
}: AddressInputProps) => {
  const updateField = (field: keyof Address, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Country Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Land</Label>
        <Select
          value={value.land}
          onValueChange={(v) => updateField('land', v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Land auswählen" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_OPTIONS.map((country) => (
              <SelectItem key={country.value} value={country.value}>
                {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Street and House Number */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="strasse" className="text-sm font-medium">
            Strasse <span className="text-red-500">*</span>
          </Label>
          <Input
            id="strasse"
            value={value.strasse}
            onChange={(e) => updateField('strasse', e.target.value)}
            placeholder="Musterstrasse"
            className={cn(errors.strasse && "border-red-500")}
          />
          {errors.strasse && (
            <p className="text-xs text-red-500">{errors.strasse}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="hausnummer" className="text-sm font-medium">
            Nr. <span className="text-red-500">*</span>
          </Label>
          <Input
            id="hausnummer"
            value={value.hausnummer}
            onChange={(e) => updateField('hausnummer', e.target.value)}
            placeholder="12a"
            className={cn(errors.hausnummer && "border-red-500")}
          />
          {errors.hausnummer && (
            <p className="text-xs text-red-500">{errors.hausnummer}</p>
          )}
        </div>
      </div>

      {/* PLZ and City */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="plz" className="text-sm font-medium">
            PLZ <span className="text-red-500">*</span>
          </Label>
          <Input
            id="plz"
            value={value.plz}
            onChange={(e) => updateField('plz', e.target.value)}
            placeholder={value.land === 'CH' ? '8000' : '12345'}
            maxLength={value.land === 'CH' ? 4 : 5}
            className={cn(errors.plz && "border-red-500")}
          />
          {errors.plz && (
            <p className="text-xs text-red-500">{errors.plz}</p>
          )}
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="ort" className="text-sm font-medium">
            Stadt <span className="text-red-500">*</span>
          </Label>
          <Input
            id="ort"
            value={value.ort}
            onChange={(e) => updateField('ort', e.target.value)}
            placeholder="Zürich"
            className={cn(errors.ort && "border-red-500")}
          />
          {errors.ort && (
            <p className="text-xs text-red-500">{errors.ort}</p>
          )}
        </div>
      </div>
    </div>
  );
};


