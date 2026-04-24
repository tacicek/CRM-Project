// Step10Summary.tsx - Summary and submission step for Räumung wizard

import { RaeumungAnfrage, serviceTypeConfig } from "@/types/raeumung";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Edit, MapPin, Home, Calendar, User, Package, Settings, AlertTriangle } from "lucide-react";
import { OffertenAnzahlSelector } from "@/components/forms/OffertenAnzahlSelector";

interface Step10SummaryProps {
  data: Partial<RaeumungAnfrage>;
  onEdit: (step: number) => void;
  onUpdateRemarks: (remarks: string) => void;
  onUpdateAGB: (accepted: boolean) => void;
  onUpdateBerechtigung: (confirmed: boolean) => void;
  onUpdateGerichtsbefehl?: (vorhanden: boolean) => void;
  maxCompanies: number;
  onMaxCompaniesChange: (value: number) => void;
}

export const Step10Summary = ({
  data,
  onEdit,
  onUpdateRemarks,
  onUpdateAGB,
  onUpdateBerechtigung,
  onUpdateGerichtsbefehl,
  maxCompanies,
  onMaxCompaniesChange,
}: Step10SummaryProps) => {
  const serviceConfig = data.raeumungs_art ? serviceTypeConfig[data.raeumungs_art] : null;
  const isZwangsraeumung = data.raeumungs_art === "forced_eviction";
  const isSensitive = serviceConfig?.sensitive ?? false;

  const SummarySection = ({
    title,
    icon,
    step,
    children,
  }: {
    title: string;
    icon: React.ReactNode;
    step: number;
    children: React.ReactNode;
  }) => (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-gray-800">{title}</h3>
        </div>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <Edit className="w-4 h-4" />
          Bearbeiten
        </button>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Zusammenfassung
        </h2>
        <p className="text-gray-600">
          Überprüfen Sie Ihre Angaben vor dem Absenden
        </p>
      </div>

      {/* Summary sections */}
      <div className="space-y-4">
        {/* Service Type */}
        <SummarySection
          title="Räumungsart"
          icon={<Package className="w-5 h-5 text-blue-600" />}
          step={1}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{serviceConfig?.icon}</span>
            <div>
              <span className="font-medium">{serviceConfig?.label}</span>
              {isSensitive && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                  Sensibel
                </span>
              )}
              {serviceConfig?.description && (
                <p className="text-sm text-gray-500">{serviceConfig.description}</p>
              )}
            </div>
          </div>
        </SummarySection>

        {/* Property */}
        <SummarySection
          title="Objekt"
          icon={<Home className="w-5 h-5 text-blue-600" />}
          step={2}
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Art:</span>
              <span className="ml-2 font-medium capitalize">
                {data.property?.type?.replace(/_/g, " ")}
              </span>
            </div>
            {data.property?.zimmer_anzahl && (
              <div>
                <span className="text-gray-500">Zimmer:</span>
                <span className="ml-2 font-medium">{data.property.zimmer_anzahl}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Fläche:</span>
              <span className="ml-2 font-medium">{data.property?.flaeche_m2} m²</span>
            </div>
            <div>
              <span className="text-gray-500">Füllgrad:</span>
              <span className="ml-2 font-medium">{data.property?.fuellgrad}%</span>
            </div>
          </div>
        </SummarySection>

        {/* Address */}
        <SummarySection
          title="Adresse"
          icon={<MapPin className="w-5 h-5 text-blue-600" />}
          step={3}
        >
          <div className="text-sm">
            <p className="font-medium">
              {data.adresse?.strasse} {data.adresse?.hausnummer}
            </p>
            <p className="text-gray-600">
              {data.adresse?.plz} {data.adresse?.ort}
              {data.adresse?.kanton && ` (${data.adresse.kanton})`}
            </p>
          </div>
        </SummarySection>

        {/* Access & Scope */}
        <SummarySection
          title="Zugang & Umfang"
          icon={<Settings className="w-5 h-5 text-blue-600" />}
          step={4}
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Stockwerk:</span>
              <span className="ml-2 font-medium capitalize">
                {data.zugang?.stockwerk?.replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Lift:</span>
              <span className="ml-2 font-medium">
                {data.zugang?.lift_vorhanden ? "Ja" : "Nein"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Räumungsumfang:</span>
              <span className="ml-2 font-medium capitalize">
                {data.umfang?.scope === "complete" ? "Komplett" : "Teilweise"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Geschätztes Volumen:</span>
              <span className="ml-2 font-medium">~{data.umfang?.volumen_m3} m³</span>
            </div>
          </div>
        </SummarySection>

        {/* Timing */}
        <SummarySection
          title="Termin"
          icon={<Calendar className="w-5 h-5 text-blue-600" />}
          step={8}
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Wunschdatum:</span>
              <span className="ml-2 font-medium">
                {data.termin?.wunschdatum
                  ? new Date(data.termin.wunschdatum).toLocaleDateString("de-CH")
                  : "Nicht angegeben"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Dringlichkeit:</span>
              <span className="ml-2 font-medium capitalize">
                {data.termin?.dringlichkeit?.replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Besichtigung:</span>
              <span className="ml-2 font-medium">
                {data.termin?.besichtigung_gewuenscht ? "Ja" : "Nein"}
              </span>
            </div>
          </div>
        </SummarySection>

        {/* Contact */}
        <SummarySection
          title="Kontakt"
          icon={<User className="w-5 h-5 text-blue-600" />}
          step={9}
        >
          <div className="text-sm">
            <p className="font-medium">
              {data.anfragender?.anrede === "herr" ? "Herr" : data.anfragender?.anrede === "frau" ? "Frau" : ""}{" "}
              {data.anfragender?.vorname} {data.anfragender?.nachname}
            </p>
            {data.anfragender?.firma && (
              <p className="text-gray-600">{data.anfragender.firma}</p>
            )}
            <p className="text-gray-600">{data.anfragender?.email}</p>
            <p className="text-gray-600">{data.anfragender?.telefon}</p>
          </div>
        </SummarySection>
      </div>

      {/* Additional Remarks */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Zusätzliche Bemerkungen (optional)
        </Label>
        <Textarea
          value={data.bemerkungen || ""}
          onChange={(e) => onUpdateRemarks(e.target.value)}
          placeholder="Haben Sie spezielle Anforderungen oder Hinweise für das Räumungsteam?"
          className="min-h-[100px]"
        />
      </div>

      {/* Legal confirmations */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        {/* Zwangsräumung: Gerichtsbefehl */}
        {isZwangsraeumung && (
          <div className="flex items-start gap-3">
            <Checkbox
              id="gerichtsbefehl"
              checked={data.gerichtsbefehl_vorhanden ?? false}
              onCheckedChange={(checked) => onUpdateGerichtsbefehl?.(checked as boolean)}
            />
            <label
              htmlFor="gerichtsbefehl"
              className={cn(
                "text-sm cursor-pointer",
                data.gerichtsbefehl_vorhanden ? "text-gray-700" : "text-gray-500"
              )}
            >
              <span className="font-medium">Gerichtlicher Räumungsbefehl vorhanden</span>
              <p className="text-xs text-gray-500 mt-1">
                Für Zwangsräumungen ist ein rechtskräftiger Gerichtsbeschluss erforderlich.
              </p>
            </label>
          </div>
        )}

        {/* Berechtigung */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="berechtigung"
            checked={data.berechtigung_bestaetigt ?? false}
            onCheckedChange={(checked) => onUpdateBerechtigung(checked as boolean)}
          />
          <label
            htmlFor="berechtigung"
            className={cn(
              "text-sm cursor-pointer",
              data.berechtigung_bestaetigt ? "text-gray-700" : "text-gray-500"
            )}
          >
            <span className="font-medium">Ich bestätige, dass ich zur Beauftragung berechtigt bin</span>
            <p className="text-xs text-gray-500 mt-1">
              Als {data.anfragender?.rolle === "owner" ? "Eigentümer/in" : 
                   data.anfragender?.rolle === "heir" ? "Erbe/Erbin" :
                   data.anfragender?.rolle === "property_manager" ? "Hausverwaltung" :
                   "berechtigte Person"} handle ich im Auftrag oder mit Vollmacht.
            </p>
          </label>
        </div>

        {/* AGB */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="agb"
            checked={data.agb_akzeptiert ?? false}
            onCheckedChange={(checked) => onUpdateAGB(checked as boolean)}
          />
          <label
            htmlFor="agb"
            className={cn(
              "text-sm cursor-pointer",
              data.agb_akzeptiert ? "text-gray-700" : "text-gray-500"
            )}
          >
            <span className="font-medium">
              Ich akzeptiere die{" "}
              <a href="/agb" target="_blank" className="text-blue-600 hover:underline">
                AGB
              </a>{" "}
              und{" "}
              <a href="/datenschutz" target="_blank" className="text-blue-600 hover:underline">
                Datenschutzbestimmungen
              </a>
            </span>
          </label>
        </div>
      </div>

      {/* Offerten Anzahl Selection */}
      <div className="p-6 rounded-xl border-2 border-primary/20 bg-primary/5">
        <OffertenAnzahlSelector
          value={maxCompanies}
          onChange={onMaxCompaniesChange}
        />
      </div>

      {/* Validation warning */}
      {(!data.agb_akzeptiert || !data.berechtigung_bestaetigt || (isZwangsraeumung && !data.gerichtsbefehl_vorhanden)) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800">
                Bitte bestätigen Sie alle erforderlichen Punkte
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Um Ihre Anfrage absenden zu können, müssen alle Bestätigungen akzeptiert werden.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📨</span>
          <div>
            <h4 className="font-semibold text-blue-800">
              Was passiert als Nächstes?
            </h4>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
              <li>Ihre Anfrage wird an passende Anbieter in Ihrer Region gesendet</li>
              <li>Sie erhalten innerhalb von 24 Stunden unverbindliche Angebote</li>
              <li>Sie entscheiden frei, welches Angebot Sie annehmen möchten</li>
              <li>Der Service ist für Sie kostenlos und unverbindlich</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step10Summary;


