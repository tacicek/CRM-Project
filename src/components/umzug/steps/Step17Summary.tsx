// Step17Summary.tsx - Summary and final notes

import { UmzugAnfrage, PROPERTY_TYPE_LABELS, FLOOR_LEVEL_LABELS, LIFT_TYPE_LABELS } from "@/types/umzug";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { 
  MapPin, 
  Calendar, 
  Package, 
  Truck, 
  User, 
  Edit2,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { OffertenAnzahlSelector } from "@/components/forms/OffertenAnzahlSelector";

interface Step17Props {
  data: Partial<UmzugAnfrage>;
  bemerkungen: string;
  onBemerkungenChange: (value: string) => void;
  agbAccepted: boolean;
  onAgbChange: (value: boolean) => void;
  onEditStep: (step: number) => void;
  maxCompanies: number;
  onMaxCompaniesChange: (value: number) => void;
}

const SectionCard = ({ 
  title, 
  icon, 
  children, 
  editStep, 
  onEdit 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode;
  editStep: number;
  onEdit: (step: number) => void;
}) => (
  <div className="rounded-xl border border-gray-200 overflow-hidden">
    <div className="flex items-center justify-between p-3 bg-gray-50">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="font-medium text-gray-800">{title}</h4>
      </div>
      <button
        type="button"
        onClick={() => onEdit(editStep)}
        className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <Edit2 className="w-4 h-4 text-gray-500" />
      </button>
    </div>
    <div className="p-4 text-sm space-y-1">
      {children}
    </div>
  </div>
);

export const Step17Summary = ({ 
  data, 
  bemerkungen, 
  onBemerkungenChange,
  agbAccepted,
  onAgbChange,
  onEditStep,
  maxCompanies,
  onMaxCompaniesChange
}: Step17Props) => {
  const formatAddress = (adresse?: { strasse: string; hausnummer: string; plz: string; ort: string }) => {
    if (!adresse) return '-';
    return `${adresse.strasse} ${adresse.hausnummer}, ${adresse.plz} ${adresse.ort}`;
  };

  const getActiveServices = () => {
    const services = [];
    if (data.zusatzleistungen?.verpackung.aktiv) services.push('Verpackung');
    if (data.zusatzleistungen?.auspacken) services.push('Auspacken');
    if (data.zusatzleistungen?.moebelmontage) services.push('Möbelmontage');
    if (data.zusatzleistungen?.entsorgung?.aktiv) services.push('Entsorgung');
    if (data.zusatzleistungen?.endreinigung) services.push('Endreinigung');
    if (data.zusatzleistungen?.zwischenlagerung?.aktiv) services.push('Zwischenlagerung');
    if (data.zusatzleistungen?.moebellift?.aktiv) services.push('Möbellift');
    return services.length > 0 ? services.join(', ') : 'Keine';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
          Zusammenfassung
        </h2>
        <p className="text-gray-600">
          Prüfen Sie Ihre Angaben und senden Sie die Anfrage ab
        </p>
      </div>

      {/* Summary Sections */}
      <div className="space-y-4">
        {/* Current Property (Auszug) */}
        <SectionCard
          title="Auszugsadresse"
          icon={<MapPin className="w-4 h-4 text-blue-500" />}
          editStep={1}
          onEdit={onEditStep}
        >
          <p><strong>Typ:</strong> {data.auszug?.property_type ? PROPERTY_TYPE_LABELS[data.auszug.property_type] : '-'}</p>
          <p><strong>Adresse:</strong> {formatAddress(data.auszug?.adresse)}</p>
          <p><strong>Grösse:</strong> {data.auszug?.anzahl_zimmer || '-'} Zimmer, {data.auszug?.wohnflaeche_m2 || '-'} m²</p>
          <p><strong>Stockwerk:</strong> {data.auszug?.stockwerk ? FLOOR_LEVEL_LABELS[data.auszug.stockwerk] : '-'}</p>
          <p><strong>Lift:</strong> {data.auszug?.lift?.vorhanden 
            ? `Ja (${data.auszug.lift.typ ? LIFT_TYPE_LABELS[data.auszug.lift.typ].label : '-'})` 
            : 'Nein'
          }</p>
        </SectionCard>

        {/* New Property (Einzug) */}
        <SectionCard
          title="Einzugsadresse"
          icon={<MapPin className="w-4 h-4 text-green-500" />}
          editStep={7}
          onEdit={onEditStep}
        >
          <p><strong>Typ:</strong> {data.einzug?.property_type ? PROPERTY_TYPE_LABELS[data.einzug.property_type] : '-'}</p>
          <p><strong>Adresse:</strong> {formatAddress(data.einzug?.adresse)}</p>
          <p><strong>Grösse:</strong> {data.einzug?.anzahl_zimmer || '-'} Zimmer, {data.einzug?.wohnflaeche_m2 || '-'} m²</p>
          <p><strong>Stockwerk:</strong> {data.einzug?.stockwerk ? FLOOR_LEVEL_LABELS[data.einzug.stockwerk] : '-'}</p>
          <p><strong>Lift:</strong> {data.einzug?.lift?.vorhanden 
            ? `Ja (${data.einzug.lift.typ ? LIFT_TYPE_LABELS[data.einzug.lift.typ].label : '-'})` 
            : 'Nein'
          }</p>
        </SectionCard>

        {/* Moving Details */}
        <SectionCard
          title="Umzugstermin"
          icon={<Calendar className="w-4 h-4 text-purple-500" />}
          editStep={13}
          onEdit={onEditStep}
        >
          <p><strong>Datum:</strong> {data.umzug_details?.datum 
            ? format(new Date(data.umzug_details.datum), 'EEEE, d. MMMM yyyy', { locale: de }) 
            : '-'
          }</p>
          <p><strong>Flexibilität:</strong> {data.umzug_details?.flexibilitaet || '-'}</p>
          <p><strong>Startzeit:</strong> {data.umzug_details?.startzeit || '-'}</p>
        </SectionCard>

        {/* Inventory */}
        <SectionCard
          title="Inventar"
          icon={<Package className="w-4 h-4 text-orange-500" />}
          editStep={14}
          onEdit={onEditStep}
        >
          <p><strong>Umzugskartons:</strong> ca. {data.inventar?.geschaetzte_kartons || 0}</p>
          
          {/* Regular Items - Grouped by Category */}
          {data.inventar?.items && data.inventar.items.length > 0 ? (
            <div className="mt-2">
              <strong>Möbelstücke ({data.inventar.items.reduce((sum, item) => sum + item.anzahl, 0)}):</strong>
              <div className="mt-1 pl-2 space-y-0.5">
                {/* Group items by category */}
                {Object.entries(
                  data.inventar.items.reduce((acc, item) => {
                    if (!acc[item.kategorie]) acc[item.kategorie] = [];
                    acc[item.kategorie].push(item);
                    return acc;
                  }, {} as Record<string, typeof data.inventar.items>)
                ).map(([category, items]) => (
                  <div key={category}>
                    <span className="text-gray-500 text-xs">{category}:</span>{' '}
                    <span className="text-gray-700">
                      {items.map(item => `${item.anzahl}x ${item.name}`).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p><strong>Möbelstücke:</strong> 0</p>
          )}
          
          {/* Special/Heavy Items */}
          {data.inventar?.schwere_gegenstaende && data.inventar.schwere_gegenstaende.length > 0 ? (
            <div className="mt-2">
              <strong className="text-orange-600">
                Spezielle Gegenstände ({data.inventar.schwere_gegenstaende.length}):
              </strong>
              <div className="mt-1 pl-2 space-y-0.5">
                {data.inventar.schwere_gegenstaende.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-gray-700">
                    <span>{item.anzahl}x {item.name}</span>
                    {item.aufpreis_chf && (
                      <span className="text-orange-600 text-xs">
                        +CHF {item.aufpreis_chf * item.anzahl}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p><strong>Spezielle Gegenstände:</strong> Keine</p>
          )}
        </SectionCard>

        {/* Additional Services */}
        <SectionCard
          title="Zusatzleistungen"
          icon={<Truck className="w-4 h-4 text-teal-500" />}
          editStep={15}
          onEdit={onEditStep}
        >
          <p>{getActiveServices()}</p>
        </SectionCard>

        {/* Contact */}
        <SectionCard
          title="Kontaktdaten"
          icon={<User className="w-4 h-4 text-indigo-500" />}
          editStep={16}
          onEdit={onEditStep}
        >
          <p><strong>Name:</strong> {data.kunde?.anrede ? `${data.kunde.anrede === 'herr' ? 'Herr' : data.kunde.anrede === 'frau' ? 'Frau' : ''} ${data.kunde.vorname} ${data.kunde.nachname}` : '-'}</p>
          <p><strong>E-Mail:</strong> {data.kunde?.email || '-'}</p>
          <p><strong>Telefon:</strong> {data.kunde?.telefon || '-'}</p>
        </SectionCard>
      </div>

      {/* Offerten Anzahl Selection */}
      <div className="p-6 rounded-xl border-2 border-primary/20 bg-primary/5">
        <OffertenAnzahlSelector
          value={maxCompanies}
          onChange={onMaxCompaniesChange}
        />
      </div>

      {/* Additional Notes */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">
          Zusätzliche Bemerkungen
        </h3>
        <Textarea
          value={bemerkungen}
          onChange={(e) => onBemerkungenChange(e.target.value)}
          placeholder="Haben Sie spezielle Anforderungen oder Hinweise für das Umzugsteam?"
          className="min-h-[100px]"
        />
      </div>

      {/* Terms & Conditions */}
      <div className={cn(
        "p-4 rounded-xl border-2 transition-colors",
        agbAccepted 
          ? "border-green-500 bg-green-50" 
          : "border-gray-200"
      )}>
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={agbAccepted}
            onCheckedChange={(checked) => onAgbChange(checked as boolean)}
            className="mt-0.5"
          />
          <span className="text-sm text-gray-700">
            Ich akzeptiere die{' '}
            <a href="/agb" target="_blank" className="text-blue-600 hover:underline">
              AGB
            </a>{' '}
            und{' '}
            <a href="/datenschutz" target="_blank" className="text-blue-600 hover:underline">
              Datenschutzbestimmungen
            </a>
            . Ich bin damit einverstanden, dass meine Daten an ausgewählte 
            Umzugsunternehmen weitergegeben werden.
          </span>
        </label>
      </div>

      {/* Info Note */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-700">
          📧 Nach dem Absenden erhalten Sie eine Bestätigung per E-Mail. 
          Die Umzugsfirmen werden sich innerhalb von 24 Stunden bei Ihnen melden.
        </p>
      </div>
    </div>
  );
};

