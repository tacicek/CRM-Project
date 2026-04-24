import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  KlaviertransportAnfrage, 
  instrumentSpecs,
  serviceTypeLabels,
  floorLabels,
  calculatePriceEstimate
} from "@/types/klaviertransport";
import { CostEstimate } from "../ui";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { OffertenAnzahlSelector } from "@/components/forms/OffertenAnzahlSelector";

interface Step8Props {
  data: Partial<KlaviertransportAnfrage>;
  updateData: (field: keyof KlaviertransportAnfrage, value: unknown) => void;
  errors: Record<string, string>;
  maxCompanies: number;
  onMaxCompaniesChange: (value: number) => void;
}

export function Step8Summary({ data, updateData, errors, maxCompanies, onMaxCompaniesChange }: Step8Props) {
  const spec = data.instrument_type ? instrumentSpecs[data.instrument_type] : null;
  const serviceInfo = data.service_type ? serviceTypeLabels[data.service_type] : null;
  const priceEstimate = calculatePriceEstimate(data);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">📋 Zusammenfassung Ihrer Anfrage</h3>
        <p className="text-sm text-gray-500">Bitte überprüfen Sie Ihre Angaben</p>
      </div>
      
      {/* Price Estimate */}
      <CostEstimate 
        estimate={priceEstimate} 
        instrumentType={data.instrument_type}
        showDetails={true}
      />
      
      {/* Summary Sections */}
      <div className="space-y-4">
        {/* Service & Instrument */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <span>{spec?.icon || '🎹'}</span>
            Instrument & Service
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Dienstleistung:</span>
              <div className="font-medium">{serviceInfo?.label}</div>
            </div>
            <div>
              <span className="text-gray-500">Instrument:</span>
              <div className="font-medium">{spec?.label}</div>
            </div>
            {data.instrument_brand && (
              <div>
                <span className="text-gray-500">Marke:</span>
                <div className="font-medium">{data.instrument_brand}</div>
              </div>
            )}
            {data.instrument_model && (
              <div>
                <span className="text-gray-500">Modell:</span>
                <div className="font-medium">{data.instrument_model}</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Pickup Location */}
        {data.abholort && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              📍 Abholadresse
            </h4>
            <div className="text-sm space-y-1">
              <div className="font-medium">
                {data.abholort.strasse} {data.abholort.hausnummer}
              </div>
              <div>{data.abholort.plz} {data.abholort.ort}</div>
              <div className="text-gray-500">
                {floorLabels[data.abholort.stockwerk]} • 
                Lift: {data.abholort.lift_vorhanden ? 'Ja' : 'Nein'}
              </div>
            </div>
          </div>
        )}
        
        {/* Delivery Location */}
        {data.lieferort && data.service_type === 'transport' && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              📍 Lieferadresse
            </h4>
            <div className="text-sm space-y-1">
              <div className="font-medium">
                {data.lieferort.strasse} {data.lieferort.hausnummer}
              </div>
              <div>{data.lieferort.plz} {data.lieferort.ort}</div>
              <div className="text-gray-500">
                {floorLabels[data.lieferort.stockwerk]} • 
                Lift: {data.lieferort.lift_vorhanden ? 'Ja' : 'Nein'}
              </div>
            </div>
          </div>
        )}
        
        {/* Schedule */}
        {data.wunschdatum && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              📅 Termin
            </h4>
            <div className="text-sm space-y-1">
              <div className="font-medium">
                {format(new Date(data.wunschdatum), 'EEEE, d. MMMM yyyy', { locale: de })}
              </div>
              <div className="text-gray-500">
                {data.flexibilitaet === 'fixed' ? 'Festes Datum' : 
                  data.flexibilitaet === 'flex_3_days' ? '± 3 Tage flexibel' :
                  data.flexibilitaet === 'flex_1_week' ? '± 1 Woche flexibel' : 'Komplett flexibel'}
                {' • '}
                {data.uhrzeit === 'morning' ? 'Vormittags' : 
                  data.uhrzeit === 'afternoon' ? 'Nachmittags' : 'Flexibel'}
              </div>
            </div>
          </div>
        )}
        
        {/* Contact */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            👤 Kontakt
          </h4>
          <div className="text-sm space-y-1">
            <div className="font-medium">
              {data.anrede === 'herr' ? 'Herr' : data.anrede === 'frau' ? 'Frau' : ''} {data.vorname} {data.nachname}
            </div>
            <div>{data.email}</div>
            <div>{data.telefon}</div>
          </div>
        </div>
      </div>
      
      {/* Additional Remarks */}
      <div className="space-y-2">
        <Label>Zusätzliche Bemerkungen (optional)</Label>
        <Textarea
          placeholder="Haben Sie spezielle Anforderungen oder Hinweise für das Transportteam?"
          value={data.bemerkungen || ''}
          onChange={(e) => updateData('bemerkungen', e.target.value)}
          rows={3}
        />
      </div>
      
      {/* Offerten Anzahl Selection */}
      <div className="p-6 rounded-xl border-2 border-primary/20 bg-primary/5">
        <OffertenAnzahlSelector
          value={maxCompanies}
          onChange={onMaxCompaniesChange}
        />
      </div>

      {/* Agreements */}
      <div className="space-y-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
        <h4 className="font-semibold text-amber-800 dark:text-amber-200">
          Bestätigungen
        </h4>
        
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="agb"
              checked={data.agb_akzeptiert || false}
              onCheckedChange={(checked) => updateData('agb_akzeptiert', !!checked)}
            />
            <label htmlFor="agb" className="text-sm leading-tight">
              Ich akzeptiere die <a href="/agb" className="text-blue-600 underline" target="_blank">AGB</a> und{' '}
              <a href="/datenschutz" className="text-blue-600 underline" target="_blank">Datenschutzbestimmungen</a> *
            </label>
          </div>
          {errors.agb_akzeptiert && (
            <p className="text-sm text-red-500 ml-6">{errors.agb_akzeptiert}</p>
          )}
          
          <div className="flex items-start space-x-3">
            <Checkbox
              id="transportfaehig"
              checked={data.transportfaehig_bestaetigt || false}
              onCheckedChange={(checked) => updateData('transportfaehig_bestaetigt', !!checked)}
            />
            <label htmlFor="transportfaehig" className="text-sm leading-tight">
              Das Instrument ist spielbereit und transportfähig *
            </label>
          </div>
          {errors.transportfaehig_bestaetigt && (
            <p className="text-sm text-red-500 ml-6">{errors.transportfaehig_bestaetigt}</p>
          )}
          
          <div className="flex items-start space-x-3">
            <Checkbox
              id="berechtigung"
              checked={data.berechtigung_bestaetigt || false}
              onCheckedChange={(checked) => updateData('berechtigung_bestaetigt', !!checked)}
            />
            <label htmlFor="berechtigung" className="text-sm leading-tight">
              Ich bin berechtigt, den Transport zu beauftragen *
            </label>
          </div>
          {errors.berechtigung_bestaetigt && (
            <p className="text-sm text-red-500 ml-6">{errors.berechtigung_bestaetigt}</p>
          )}
        </div>
      </div>
      
      {/* Final Note */}
      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <span className="text-xl">ℹ️</span>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Was passiert als nächstes?</p>
            <p>
              Nach dem Absenden erhalten Sie innerhalb von 24 Stunden unverbindliche Angebote 
              von geprüften Klaviertransport-Spezialisten in Ihrer Region. Bei komplexen 
              Situationen wird möglicherweise eine Vorbesichtigung empfohlen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


