import { User, Phone, MapPin, Calendar, MessageSquare } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EmailField } from "@/components/ui/email-field";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Kunde, Adresse, Termin, TerminFlexibilitaet } from "@/types/reinigung";
import { OffertenAnzahlSelector } from "@/components/forms/OffertenAnzahlSelector";

interface Step8Props {
  kunde: Kunde;
  adresse: Adresse;
  termin: Termin;
  onKundeChange: (kunde: Kunde) => void;
  onAdresseChange: (adresse: Adresse) => void;
  onTerminChange: (termin: Termin) => void;
  errors?: Record<string, string>;
  maxCompanies: number;
  onMaxCompaniesChange: (value: 1 | 3 | 5) => void;
}

export function Step8Kontakt({
  kunde,
  adresse,
  termin,
  onKundeChange,
  onAdresseChange,
  onTerminChange,
  errors = {},
  maxCompanies,
  onMaxCompaniesChange,
}: Step8Props) {
  const updateKunde = (key: keyof Kunde, value: string) => {
    onKundeChange({
      ...kunde,
      [key]: value,
    });
  };

  const updateAdresse = (key: keyof Adresse, value: string) => {
    onAdresseChange({
      ...adresse,
      [key]: value,
    });
  };

  const updateTermin = <K extends keyof Termin>(key: K, value: Termin[K]) => {
    onTerminChange({
      ...termin,
      [key]: value,
    });
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Kontaktdaten & Terminwunsch
        </h2>
        <p className="text-sm text-gray-500">
          Geben Sie Ihre Kontaktdaten ein, damit die Reinigungsfirmen Sie kontaktieren können.
        </p>
      </div>

      {/* Personal Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-primary" />
          <Label className="text-sm font-semibold">Persönliche Daten</Label>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vorname">
              Vorname <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vorname"
              placeholder="Max"
              value={kunde.vorname}
              onChange={(e) => updateKunde("vorname", e.target.value)}
              className={errors.vorname ? "border-destructive" : ""}
            />
            {errors.vorname && (
              <p className="text-sm text-destructive">{errors.vorname}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nachname">
              Nachname <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nachname"
              placeholder="Mustermann"
              value={kunde.nachname}
              onChange={(e) => updateKunde("nachname", e.target.value)}
              className={errors.nachname ? "border-destructive" : ""}
            />
            {errors.nachname && (
              <p className="text-sm text-destructive">{errors.nachname}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <EmailField
              id="email"
              label="E-Mail"
              required
              placeholder="max@beispiel.ch"
              value={kunde.email}
              onChange={(v) => updateKunde("email", v)}
              inputClassName={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefon" className="flex items-center gap-1">
              <Phone className="w-4 h-4" />
              Telefon <span className="text-destructive">*</span>
            </Label>
            <Input
              id="telefon"
              type="tel"
              placeholder="+41 79 123 45 67"
              value={kunde.telefon}
              onChange={(e) => updateKunde("telefon", e.target.value)}
              className={errors.telefon ? "border-destructive" : ""}
            />
            {errors.telefon && (
              <p className="text-sm text-destructive">{errors.telefon}</p>
            )}
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-5 h-5 text-primary" />
          <Label className="text-sm font-semibold">Adresse der Reinigung</Label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="strasse">
              Strasse <span className="text-destructive">*</span>
            </Label>
            <Input
              id="strasse"
              placeholder="Musterstrasse"
              value={adresse.strasse}
              onChange={(e) => updateAdresse("strasse", e.target.value)}
              className={errors.strasse ? "border-destructive" : ""}
            />
            {errors.strasse && (
              <p className="text-sm text-destructive">{errors.strasse}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hausnummer">
              Nr. <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hausnummer"
              placeholder="123"
              value={adresse.hausnummer}
              onChange={(e) => updateAdresse("hausnummer", e.target.value)}
              className={errors.hausnummer ? "border-destructive" : ""}
            />
            {errors.hausnummer && (
              <p className="text-sm text-destructive">{errors.hausnummer}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="plz">
              PLZ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="plz"
              placeholder="8001"
              maxLength={4}
              value={adresse.plz}
              onChange={(e) => updateAdresse("plz", e.target.value)}
              className={errors.plz ? "border-destructive" : ""}
            />
            {errors.plz && (
              <p className="text-sm text-destructive">{errors.plz}</p>
            )}
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="ort">
              Ort <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ort"
              placeholder="Zürich"
              value={adresse.ort}
              onChange={(e) => updateAdresse("ort", e.target.value)}
              className={errors.ort ? "border-destructive" : ""}
            />
            {errors.ort && (
              <p className="text-sm text-destructive">{errors.ort}</p>
            )}
          </div>
        </div>
      </div>

      {/* Appointment */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-primary" />
          <Label className="text-sm font-semibold">Terminwunsch</Label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="wunschdatum">
              Wunschdatum <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wunschdatum"
              type="date"
              min={today}
              value={termin.wunschdatum}
              onChange={(e) => updateTermin("wunschdatum", e.target.value)}
              className={errors.wunschdatum ? "border-destructive" : ""}
            />
            {errors.wunschdatum && (
              <p className="text-sm text-destructive">{errors.wunschdatum}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="flexibilitaet">Flexibilität</Label>
            <Select
              value={termin.flexibilitaet}
              onValueChange={(value) =>
                updateTermin("flexibilitaet", value as TerminFlexibilitaet)
              }
            >
              <SelectTrigger id="flexibilitaet">
                <SelectValue placeholder="Wählen Sie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fest">Fester Termin</SelectItem>
                <SelectItem value="flexibel_1_woche">± 1 Woche flexibel</SelectItem>
                <SelectItem value="flexibel_2_wochen">± 2 Wochen flexibel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bemerkungen" className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            Bemerkungen (optional)
          </Label>
          <Textarea
            id="bemerkungen"
            placeholder="Besondere Wünsche, Zugangsinformationen, etc."
            value={termin.bemerkungen}
            onChange={(e) => updateTermin("bemerkungen", e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Offerten Anzahl Selection */}
      <div className="p-6 rounded-xl border-2 border-primary/20 bg-primary/5">
        <OffertenAnzahlSelector
          value={maxCompanies}
          onChange={onMaxCompaniesChange}
        />
      </div>

      {/* Privacy note */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500">
          Mit dem Absenden Ihrer Anfrage stimmen Sie unseren{" "}
          <a href="/agb" className="text-primary hover:underline">AGB</a> und der{" "}
          <a href="/datenschutz" className="text-primary hover:underline">Datenschutzerklärung</a>{" "}
          zu. Ihre Daten werden nur an ausgewählte Reinigungsfirmen weitergegeben.
        </p>
      </div>
    </div>
  );
}

export default Step8Kontakt;


