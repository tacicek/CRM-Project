// Step16Contact.tsx - Contact information

import { CustomerInfo, Anrede } from "@/types/umzug";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailField } from "@/components/ui/email-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { User, Phone, Clock, Lock } from "lucide-react";

interface Step16Props {
  data: CustomerInfo;
  onChange: (data: Partial<CustomerInfo>) => void;
  errors?: Record<string, string>;
}

const ANREDE_OPTIONS: { value: Anrede; label: string }[] = [
  { value: 'herr', label: 'Herr' },
  { value: 'frau', label: 'Frau' },
  { value: 'divers', label: 'Divers' },
];

const CONTACT_TIME_OPTIONS = [
  { value: 'jederzeit', label: 'Jederzeit' },
  { value: 'vormittags', label: 'Vormittags (08:00-12:00)' },
  { value: 'nachmittags', label: 'Nachmittags (12:00-17:00)' },
  { value: 'abends', label: 'Abends (17:00-20:00)' },
];

export const Step16Contact = ({ data, onChange, errors = {} }: Step16Props) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 mb-4">
          <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          Ihre Kontaktdaten
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Damit die Umzugsfirmen Sie erreichen können
        </p>
      </div>

      <div className="space-y-6">
        {/* Anrede */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Anrede <span className="text-red-500">*</span>
          </Label>
          <div className="flex gap-3">
            {ANREDE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ anrede: option.value })}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg border-2 transition-all duration-200",
                  "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  data.anrede === option.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vorname" className="text-sm font-medium">
              Vorname <span className="text-red-500">*</span>
            </Label>
            <Input
              id="vorname"
              value={data.vorname}
              onChange={(e) => onChange({ vorname: e.target.value })}
              placeholder="Max"
              className={cn(errors.vorname && "border-red-500")}
            />
            {errors.vorname && (
              <p className="text-xs text-red-500">{errors.vorname}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="nachname" className="text-sm font-medium">
              Nachname <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nachname"
              value={data.nachname}
              onChange={(e) => onChange({ nachname: e.target.value })}
              placeholder="Muster"
              className={cn(errors.nachname && "border-red-500")}
            />
            {errors.nachname && (
              <p className="text-xs text-red-500">{errors.nachname}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <EmailField
            id="email"
            label="E-Mail"
            required
            value={data.email}
            onChange={(v) => onChange({ email: v })}
            placeholder="max.muster@example.ch"
            inputClassName={cn(errors.email && "border-red-500")}
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="telefon" className="text-sm font-medium flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Telefon <span className="text-red-500">*</span>
          </Label>
          <Input
            id="telefon"
            type="tel"
            value={data.telefon}
            onChange={(e) => onChange({ telefon: e.target.value })}
            placeholder="+41 79 123 45 67"
            className={cn(errors.telefon && "border-red-500")}
          />
          {errors.telefon && (
            <p className="text-xs text-red-500">{errors.telefon}</p>
          )}
        </div>

        {/* Preferred Contact Time */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Bevorzugte Kontaktzeit
          </Label>
          <Select
            value={data.kontaktzeit || 'jederzeit'}
            onValueChange={(value) => onChange({ kontaktzeit: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Wählen Sie eine Zeit" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_TIME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Privacy Note */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
        <Lock className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Ihre Daten werden vertraulich behandelt und nur für die 
          Angebotserstellung an ausgewählte Umzugsfirmen weitergegeben.
        </p>
      </div>
    </div>
  );
};


