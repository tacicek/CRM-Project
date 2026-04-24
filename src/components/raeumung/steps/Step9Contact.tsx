// Step9Contact.tsx - Contact information step for Räumung wizard

import { RequesterInfo, RequesterRole, RaeumungsArt, getDefaultRole } from "@/types/raeumung";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EmailField } from "@/components/ui/email-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Check, User, Building, Phone } from "lucide-react";

interface RoleOption {
  value: RequesterRole;
  label: string;
  icon: string;
}

const roleOptions: RoleOption[] = [
  { value: "owner", label: "Eigentümer/in", icon: "🏠" },
  { value: "tenant", label: "Mieter/in", icon: "🔑" },
  { value: "property_manager", label: "Hausverwaltung", icon: "🏢" },
  { value: "heir", label: "Erbe/Erbin", icon: "📜" },
  { value: "landlord", label: "Vermieter/in", icon: "💼" },
  { value: "authority", label: "Behörde", icon: "⚖️" },
  { value: "other", label: "Andere", icon: "👤" },
];

const contactTimeOptions = [
  { value: "anytime", label: "Jederzeit" },
  { value: "morning", label: "Vormittags (08:00-12:00)" },
  { value: "afternoon", label: "Nachmittags (12:00-17:00)" },
  { value: "evening", label: "Abends (17:00-20:00)" },
];

interface Step9ContactProps {
  contact: RequesterInfo;
  onChange: (contact: RequesterInfo) => void;
  serviceType: RaeumungsArt;
}

export const Step9Contact = ({ contact, onChange, serviceType }: Step9ContactProps) => {
  const defaultRole = getDefaultRole(serviceType);

  // Auto-set default role if not set
  if (!contact.rolle) {
    onChange({ ...contact, rolle: defaultRole });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Ihre Kontaktdaten
        </h2>
        <p className="text-gray-600">
          Wie können wir Sie erreichen?
        </p>
      </div>

      {/* Contact icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <User className="w-8 h-8 text-blue-600" />
        </div>
      </div>

      {/* Role Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">
          In welcher Funktion handeln Sie?
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {roleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...contact, rolle: option.value })}
              className={cn(
                "relative flex flex-col items-center p-3 rounded-lg border-2 transition-all",
                "hover:border-blue-300",
                contact.rolle === option.value
                  ? "border-blue-500 bg-blue-50/50 shadow-md"
                  : "border-gray-200 bg-white"
              )}
            >
              {contact.rolle === option.value && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              <span className="text-xl mb-1">{option.icon}</span>
              <span className={cn(
                "text-xs font-medium text-center",
                contact.rolle === option.value ? "text-blue-700" : "text-gray-700"
              )}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Salutation */}
      <div className="space-y-2">
        <Label className="text-base font-medium">Anrede</Label>
        <div className="flex gap-3">
          {[
            { value: "herr", label: "Herr" },
            { value: "frau", label: "Frau" },
            { value: "divers", label: "Divers" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange({ ...contact, anrede: option.value as RequesterInfo["anrede"] })
              }
              className={cn(
                "flex-1 py-3 rounded-lg border-2 font-medium transition-all",
                contact.anrede === option.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-blue-300"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-base font-medium">Vorname *</Label>
          <Input
            type="text"
            value={contact.vorname}
            onChange={(e) => onChange({ ...contact, vorname: e.target.value })}
            placeholder="Max"
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-base font-medium">Nachname *</Label>
          <Input
            type="text"
            value={contact.nachname}
            onChange={(e) => onChange({ ...contact, nachname: e.target.value })}
            placeholder="Muster"
            className="w-full"
          />
        </div>
      </div>

      {/* Company (optional for property_manager, authority) */}
      {(contact.rolle === "property_manager" || contact.rolle === "authority" || contact.rolle === "other") && (
        <div className="space-y-2">
          <Label className="text-base font-medium flex items-center gap-2">
            <Building className="w-4 h-4" />
            Firma / Organisation
          </Label>
          <Input
            type="text"
            value={contact.firma || ""}
            onChange={(e) => onChange({ ...contact, firma: e.target.value })}
            placeholder="Musterfirma AG"
            className="w-full"
          />
        </div>
      )}

      {/* Email */}
      <EmailField
        label="E-Mail-Adresse"
        required
        value={contact.email}
        onChange={(v) => onChange({ ...contact, email: v })}
        placeholder="max.muster@example.ch"
        inputClassName="w-full"
      />

      {/* Phone */}
      <div className="space-y-2">
        <Label className="text-base font-medium flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Telefonnummer *
        </Label>
        <Input
          type="tel"
          value={contact.telefon}
          onChange={(e) => onChange({ ...contact, telefon: e.target.value })}
          placeholder="+41 79 123 45 67"
          className="w-full"
        />
        <p className="text-xs text-gray-500">
          Schweizer Format: +41 XX XXX XX XX oder 0XX XXX XX XX
        </p>
      </div>

      {/* Preferred contact time */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Bevorzugte Kontaktzeit (optional)
        </Label>
        <Select
          value={contact.kontaktzeit || "anytime"}
          onValueChange={(value) => onChange({ ...contact, kontaktzeit: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Wann dürfen wir Sie kontaktieren?" />
          </SelectTrigger>
          <SelectContent>
            {contactTimeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Privacy notice */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-xl">🔒</span>
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">
              Datenschutz
            </h4>
            <p className="text-xs text-gray-600 mt-1">
              Ihre Daten werden nur zur Bearbeitung Ihrer Anfrage verwendet und an
              ausgewählte Anbieter weitergegeben. Wir verkaufen Ihre Daten nicht an Dritte.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step9Contact;


