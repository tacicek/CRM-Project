import { EntsorgungAnfrage, getEntsorgungsArtLabel } from "@/types/entsorgung";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Edit2, Trash2, MapPin, Key, Wrench, Calendar, User, FileText, Check } from "lucide-react";

interface Step8SummaryProps {
  data: Partial<EntsorgungAnfrage>;
  onEdit: (step: number) => void;
  onUpdateRemarks: (remarks: string) => void;
  onUpdateAGB: (accepted: boolean) => void;
  onUpdateKorrekteAngaben: (confirmed: boolean) => void;
  maxCompanies: number;
  onMaxCompaniesChange: (value: number) => void;
}

const offerOptions = [
  { value: 1, label: "Exklusiv", description: "1 Firma, höchste Qualität", badge: "Exklusiv" },
  { value: 3, label: "Premium", description: "3 Firmen, gute Auswahl", badge: "Empfohlen" },
  { value: 5, label: "Standard", description: "5 Firmen, maximale Auswahl", badge: "" },
];

export const Step8Summary = ({
  data,
  onEdit,
  onUpdateRemarks,
  onUpdateAGB,
  onUpdateKorrekteAngaben,
  maxCompanies,
  onMaxCompaniesChange,
}: Step8SummaryProps) => {
  const SummarySection = ({
    title,
    icon: Icon,
    step,
    children,
  }: {
    title: string;
    icon: React.ElementType;
    step: number;
    children: React.ReactNode;
  }) => (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
        >
          <Edit2 className="w-4 h-4" />
          Bearbeiten
        </button>
      </div>
      <div className="text-sm text-gray-600 space-y-1">{children}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Zusammenfassung Ihrer Anfrage
        </h2>
        <p className="mt-2 text-gray-600">
          Bitte überprüfen Sie Ihre Angaben
        </p>
      </div>

      {/* Summary sections */}
      <div className="space-y-4">
        {/* Waste Type */}
        <SummarySection title="Abfallart" icon={Trash2} step={1}>
          <p className="font-medium text-gray-900">
            {data.entsorgungs_art ? getEntsorgungsArtLabel(data.entsorgungs_art) : "-"}
          </p>
        </SummarySection>

        {/* Items & Quantity */}
        <SummarySection title="Menge & Gegenstände" icon={FileText} step={2}>
          {data.menge?.container_groesse && (
            <p>Volumen: {data.menge.container_groesse}</p>
          )}
          {data.menge?.volumen_m3 && <p>Volumen: {data.menge.volumen_m3} m³</p>}
          {data.menge?.anzahl_teile && <p>Anzahl Teile: {data.menge.anzahl_teile}</p>}
        </SummarySection>

        {/* Address */}
        <SummarySection title="Adresse" icon={MapPin} step={3}>
          <p>{data.adresse?.strasse} {data.adresse?.hausnummer}</p>
          <p>{data.adresse?.plz} {data.adresse?.ort}</p>
        </SummarySection>

        {/* Access */}
        <SummarySection title="Zugang" icon={Key} step={4}>
          <p>Stockwerk: {data.zugang?.stockwerk || "-"}</p>
          <p>Lift: {data.zugang?.lift_vorhanden ? "Ja" : "Nein"}</p>
          <p>LKW-Zufahrt: {data.zugang?.zufahrt_lkw ? "Möglich" : "Nicht möglich"}</p>
        </SummarySection>

        {/* Services */}
        <SummarySection title="Zusatzleistungen" icon={Wrench} step={5}>
          {data.zusatzleistungen?.demontage && <p>• Demontage</p>}
          {data.zusatzleistungen?.transport_aus_wohnung && <p>• Transport aus Wohnung</p>}
          {data.zusatzleistungen?.besenrein && <p>• Besenreine Übergabe</p>}
          {data.zusatzleistungen?.entsorgungsnachweis && <p>• Entsorgungsnachweis</p>}
          {!Object.values(data.zusatzleistungen || {}).some(Boolean) && <p>Keine ausgewählt</p>}
        </SummarySection>

        {/* Timing */}
        <SummarySection title="Termin" icon={Calendar} step={6}>
          <p>Wunschdatum: {data.termin?.wunschdatum || "-"}</p>
          <p>Flexibilität: {data.termin?.flexibilitaet || "-"}</p>
          <p>Dringlichkeit: {data.termin?.dringlichkeit || "-"}</p>
        </SummarySection>

        {/* Contact */}
        <SummarySection title="Kontakt" icon={User} step={7}>
          <p>{data.anfragender?.anrede === "firma" ? "Firma: " : ""}{data.anfragender?.vorname} {data.anfragender?.nachname}</p>
          <p>{data.anfragender?.email}</p>
          <p>{data.anfragender?.telefon}</p>
        </SummarySection>
      </div>

      {/* Remarks */}
      <div className="space-y-2">
        <Label>Bemerkungen (optional)</Label>
        <Textarea
          placeholder="Zusätzliche Informationen für die Entsorgungsfirmen..."
          value={data.bemerkungen || ""}
          onChange={(e) => onUpdateRemarks(e.target.value)}
          rows={3}
        />
      </div>

      {/* Number of offers */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Anzahl Offerten</Label>
        <div className="grid grid-cols-3 gap-3">
          {offerOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onMaxCompaniesChange(option.value)}
              className={cn(
                "relative p-4 rounded-lg border-2 text-center transition-all",
                maxCompanies === option.value
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              {option.badge && (
                <span className={cn(
                  "absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-xs rounded-full",
                  option.badge === "Empfohlen" ? "bg-green-500 text-white" : "bg-purple-500 text-white"
                )}>
                  {option.badge}
                </span>
              )}
              <div className="font-bold text-2xl">{option.value}</div>
              <div className="text-sm text-gray-600">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Confirmations */}
      <div className="space-y-4 pt-4 border-t">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={data.agb_akzeptiert || false}
            onCheckedChange={(checked) => onUpdateAGB(checked === true)}
            className="mt-1"
          />
          <span className="text-sm text-gray-600">
            Ich akzeptiere die{" "}
            <a href="/agb" target="_blank" className="text-green-600 underline">
              Allgemeinen Geschäftsbedingungen
            </a>{" "}
            und die{" "}
            <a href="/datenschutz" target="_blank" className="text-green-600 underline">
              Datenschutzerklärung
            </a>
            . *
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={data.korrekte_angaben_bestaetigt || false}
            onCheckedChange={(checked) => onUpdateKorrekteAngaben(checked === true)}
            className="mt-1"
          />
          <span className="text-sm text-gray-600">
            Ich bestätige, dass alle Angaben korrekt sind und ich berechtigt bin, 
            diese Entsorgungsanfrage zu stellen. *
          </span>
        </label>
      </div>

      {data.agb_akzeptiert && data.korrekte_angaben_bestaetigt && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-medium text-green-800">Bereit zum Absenden!</p>
            <p className="text-sm text-green-700">
              Klicken Sie auf "Anfrage absenden", um Ihre Entsorgungsanfrage zu übermitteln.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step8Summary;

