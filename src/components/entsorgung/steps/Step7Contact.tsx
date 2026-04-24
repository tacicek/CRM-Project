import { EntsorgungsAnfragender } from "@/types/entsorgung";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailField } from "@/components/ui/email-field";
import { cn } from "@/lib/utils";
import { User, Phone, Clock } from "lucide-react";

interface Step7ContactProps {
  contact: EntsorgungsAnfragender;
  onChange: (contact: EntsorgungsAnfragender) => void;
}

const salutations = [
  { value: "herr", label: "Herr" },
  { value: "frau", label: "Frau" },
  { value: "firma", label: "Firma" },
];

const contactTimes = [
  { value: "vormittag", label: "Vormittag", time: "08:00 - 12:00" },
  { value: "nachmittag", label: "Nachmittag", time: "12:00 - 17:00" },
  { value: "abend", label: "Abend", time: "17:00 - 20:00" },
  { value: "jederzeit", label: "Jederzeit", time: "Flexibel" },
];

export const Step7Contact = ({ contact, onChange }: Step7ContactProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Ihre Kontaktdaten
        </h2>
        <p className="mt-2 text-gray-600">
          Wie können die Entsorgungsfirmen Sie erreichen?
        </p>
      </div>

      {/* Salutation */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Anrede *</Label>
        <div className="flex gap-3">
          {salutations.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange({ ...contact, anrede: s.value as EntsorgungsAnfragender["anrede"] })}
              className={cn(
                "px-6 py-2 rounded-lg border-2 transition-all",
                contact.anrede === s.value
                  ? "border-green-500 bg-green-50 font-medium"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vorname" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Vorname *
          </Label>
          <Input
            id="vorname"
            placeholder="Max"
            value={contact.vorname}
            onChange={(e) => onChange({ ...contact, vorname: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nachname">Nachname *</Label>
          <Input
            id="nachname"
            placeholder="Muster"
            value={contact.nachname}
            onChange={(e) => onChange({ ...contact, nachname: e.target.value })}
          />
        </div>
      </div>

      {/* Company (if firma selected) */}
      {contact.anrede === "firma" && (
        <div className="space-y-2">
          <Label htmlFor="firma">Firmenname</Label>
          <Input
            id="firma"
            placeholder="Muster GmbH"
            value={contact.firma || ""}
            onChange={(e) => onChange({ ...contact, firma: e.target.value })}
          />
        </div>
      )}

      {/* Contact info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EmailField
          id="email"
          label="E-Mail"
          required
          value={contact.email}
          onChange={(v) => onChange({ ...contact, email: v })}
          placeholder="max.muster@beispiel.ch"
        />
        <div className="space-y-2">
          <Label htmlFor="telefon" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Telefon *
          </Label>
          <Input
            id="telefon"
            type="tel"
            placeholder="+41 79 123 45 67"
            value={contact.telefon}
            onChange={(e) => onChange({ ...contact, telefon: e.target.value })}
          />
        </div>
      </div>

      {/* Preferred contact time */}
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-green-600" />
          Bevorzugte Kontaktzeit
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {contactTimes.map((time) => (
            <button
              key={time.value}
              type="button"
              onClick={() => onChange({ ...contact, kontaktzeit: time.value as EntsorgungsAnfragender["kontaktzeit"] })}
              className={cn(
                "p-3 rounded-lg border-2 text-center transition-all",
                contact.kontaktzeit === time.value
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="font-medium">{time.label}</div>
              <div className="text-xs text-gray-500">{time.time}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4 flex items-start gap-3">
        <div className="p-2 bg-green-100 rounded-full">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-sm text-gray-600">
          Ihre Daten werden vertraulich behandelt und nur an ausgewählte Entsorgungsfirmen weitergegeben.
        </p>
      </div>
    </div>
  );
};

export default Step7Contact;

