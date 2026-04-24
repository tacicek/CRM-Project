import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceEstimate } from "../ui/PriceEstimate";
import { 
  MoebelliftAnfrage, 
  purposeConfig, 
  floorHeights, 
  singleItemConfig,
  recommendLiftType,
  liftSpecs
} from "@/types/moebellift";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { OffertenAnzahlSelector } from "@/components/forms/OffertenAnzahlSelector";

interface Step7Props {
  data: MoebelliftAnfrage;
  updateData: (updates: Partial<MoebelliftAnfrage>) => void;
  maxCompanies: number;
  onMaxCompaniesChange: (value: number) => void;
}

export function Step7Summary({ data, updateData, maxCompanies, onMaxCompaniesChange }: Step7Props) {
  const serviceLabels = {
    with_operator: 'Mit Bediener',
    self_service: 'Ohne Bediener (Selbstbedienung)',
    pickup: 'Selbstabholung'
  };

  const directionLabels = {
    up: 'Hinauf (Einzug)',
    down: 'Hinunter (Auszug)',
    both: 'Beides (Umzug)'
  };

  const accessLabels = {
    window: 'Fenster',
    balcony: 'Balkon',
    roof_window: 'Dachfenster',
    terrace: 'Terrasse (EG)'
  };

  const spaceLabels = {
    sufficient: 'Ausreichend (> 3m x 3m)',
    limited: 'Eingeschränkt (1.5m - 3m)',
    very_limited: 'Sehr wenig (< 1.5m)',
    unsure: 'Unsicher'
  };

  const parkingLabels = {
    parking_available: 'Parkplatz vorhanden',
    no_parking_zone: 'Halteverbot nötig',
    street_side: 'Strassenrand',
    unsure: 'Unsicher'
  };

  const durationLabels = {
    short: 'Kurz (1-2h)',
    half_day: 'Halbtags (3-4h)',
    full_day: 'Ganztags (5-8h)',
    multi_day: 'Mehrtägig'
  };

  const timeLabels = {
    early: 'Früh (07:00-09:00)',
    morning: 'Vormittags (09:00-12:00)',
    afternoon: 'Nachmittags (13:00-17:00)',
    flexible: 'Flexibel'
  };

  const recommendedLift = recommendLiftType(data);
  const liftInfo = liftSpecs[recommendedLift];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          Zusammenfassung Ihrer Möbellift-Anfrage
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Bitte überprüfen Sie Ihre Angaben
        </p>
      </div>

      {/* Lift Recommendation */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🏗️</span>
          <div>
            <p className="font-semibold text-blue-800">Empfohlener Lift-Typ</p>
            <p className="text-lg font-bold text-blue-700">{liftInfo.label}</p>
            <div className="mt-2 text-sm text-blue-600 space-y-1">
              <p>✓ Max. Höhe: {liftInfo.max_height_m}m • Tragkraft: {liftInfo.max_load_kg}kg</p>
              <p>✓ Plattform: {liftInfo.platform_size}</p>
              <p>✓ Min. Stellfläche: {liftInfo.min_space_m}m x {liftInfo.min_space_m}m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Price Estimate */}
      <PriceEstimate data={data} />

      {/* Summary Sections */}
      <div className="space-y-4">
        {/* Service & Purpose */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>🔧</span> Service & Einsatzzweck
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500">Service-Art:</span>
              <p className="font-medium text-gray-800">{serviceLabels[data.service_type]}</p>
            </div>
            <div>
              <span className="text-gray-500">Einsatzzweck:</span>
              <p className="font-medium text-gray-800">{purposeConfig[data.zweck].label}</p>
            </div>
            <div>
              <span className="text-gray-500">Richtung:</span>
              <p className="font-medium text-gray-800">{directionLabels[data.richtung]}</p>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>📍</span> Einsatzort
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="col-span-2">
              <span className="text-gray-500">Adresse:</span>
              <p className="font-medium text-gray-800">
                {data.einsatzort.adresse.strasse} {data.einsatzort.adresse.hausnummer}, {data.einsatzort.adresse.plz} {data.einsatzort.adresse.ort}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Stockwerk:</span>
              <p className="font-medium text-gray-800">
                {data.einsatzort.stockwerk.replace('floor_', '').replace('_plus', '+')}. OG (~{floorHeights[data.einsatzort.stockwerk]}m)
              </p>
            </div>
            <div>
              <span className="text-gray-500">Zugang:</span>
              <p className="font-medium text-gray-800">{accessLabels[data.einsatzort.zugang]}</p>
            </div>
            <div>
              <span className="text-gray-500">Öffnung:</span>
              <p className="font-medium text-gray-800">
                {data.einsatzort.oeffnung.breite_cm} x {data.einsatzort.oeffnung.hoehe_cm} cm
              </p>
            </div>
          </div>
        </div>

        {/* Site Conditions */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>🏢</span> Gegebenheiten vor Ort
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500">Stellfläche:</span>
              <p className="font-medium text-gray-800">{spaceLabels[data.gegebenheiten.stellflaeche]}</p>
            </div>
            <div>
              <span className="text-gray-500">Parkplatz:</span>
              <p className="font-medium text-gray-800">{parkingLabels[data.gegebenheiten.parkplatz]}</p>
            </div>
            {!data.gegebenheiten.hindernisse.keine && (
              <div className="col-span-2">
                <span className="text-gray-500">Hindernisse:</span>
                <p className="font-medium text-gray-800">
                  {Object.entries(data.gegebenheiten.hindernisse)
                    .filter(([k, v]) => v && k !== 'keine')
                    .map(([k]) => {
                      const labels: Record<string, string> = {
                        baeume: 'Bäume', stromleitungen: 'Stromleitungen', vordach: 'Vordach',
                        parkierte_fahrzeuge: 'Parkierte Fahrzeuge', baustelle: 'Baustelle',
                        enge_zufahrt: 'Enge Zufahrt', hang: 'Hang'
                      };
                      return labels[k];
                    })
                    .join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Transport Items */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>📦</span> Transportgut
          </h3>
          <div className="text-sm">
            {data.zweck === 'umzug' && data.transport.umzug && (
              <div className="space-y-1">
                <p><span className="text-gray-500">Wohnungsgrösse:</span> <span className="font-medium">{data.transport.umzug.wohnungsgroesse.replace('_room', '-Zimmer').replace('_plus', '+')}</span></p>
                <p><span className="text-gray-500">Menge:</span> <span className="font-medium">{data.transport.umzug.menge === 'small' ? 'Wenig' : data.transport.umzug.menge === 'medium' ? 'Mittel' : data.transport.umzug.menge === 'large' ? 'Viel' : 'Sehr viel'}</span></p>
              </div>
            )}
            {data.zweck === 'einzelstueck' && data.transport.einzelstueck && (
              <div className="space-y-1">
                <p><span className="text-gray-500">Gegenstand:</span> <span className="font-medium">{singleItemConfig[data.transport.einzelstueck.typ].label}</span></p>
                <p><span className="text-gray-500">Gewicht:</span> <span className="font-medium">{data.transport.einzelstueck.gewicht === 'light' ? 'Leicht' : data.transport.einzelstueck.gewicht === 'medium' ? 'Mittel' : data.transport.einzelstueck.gewicht === 'heavy' ? 'Schwer' : 'Sehr schwer'}</span></p>
                {data.transport.einzelstueck.beschreibung && (
                  <p><span className="text-gray-500">Beschreibung:</span> <span className="font-medium">{data.transport.einzelstueck.beschreibung}</span></p>
                )}
              </div>
            )}
            {data.zweck === 'baumaterial' && data.transport.baumaterial && (
              <div className="space-y-1">
                <p><span className="text-gray-500">Material:</span> <span className="font-medium">{data.transport.baumaterial.art}</span></p>
                <p><span className="text-gray-500">Menge:</span> <span className="font-medium">{data.transport.baumaterial.menge} {data.transport.baumaterial.einheit}</span></p>
              </div>
            )}
            {data.transport.sonstiges && (
              <p className="font-medium">{data.transport.sonstiges}</p>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>📅</span> Termin
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500">Datum:</span>
              <p className="font-medium text-gray-800">
                {data.termin.wunschdatum 
                  ? format(new Date(data.termin.wunschdatum), 'dd. MMMM yyyy', { locale: de })
                  : 'Nicht angegeben'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Zeit:</span>
              <p className="font-medium text-gray-800">{timeLabels[data.termin.wunschzeit]}</p>
            </div>
            <div>
              <span className="text-gray-500">Dauer:</span>
              <p className="font-medium text-gray-800">{durationLabels[data.termin.dauer]}</p>
            </div>
          </div>
        </div>

        {/* Additional Services */}
        {(data.zusatzleistungen.halteverbot || data.zusatzleistungen.helfer.aktiv || 
          data.zusatzleistungen.verpackung || data.zusatzleistungen.entsorgung || 
          data.zusatzleistungen.lagerung) && (
          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>➕</span> Zusatzleistungen
            </h3>
            <div className="text-sm space-y-1">
              {data.zusatzleistungen.halteverbot && <p>✓ Halteverbotszone</p>}
              {data.zusatzleistungen.helfer.aktiv && <p>✓ {data.zusatzleistungen.helfer.anzahl}x Umzugshelfer</p>}
              {data.zusatzleistungen.verpackung && <p>✓ Verpackungsmaterial</p>}
              {data.zusatzleistungen.entsorgung && <p>✓ Entsorgung Altmöbel</p>}
              {data.zusatzleistungen.lagerung && <p>✓ Zwischenlagerung</p>}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>👤</span> Kontaktdaten
          </h3>
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-800">
              {data.kunde.anrede === 'herr' ? 'Herr' : data.kunde.anrede === 'frau' ? 'Frau' : ''} {data.kunde.vorname} {data.kunde.nachname}
            </p>
            {data.kunde.firma && <p>{data.kunde.firma}</p>}
            <p>{data.kunde.email}</p>
            <p>{data.kunde.telefon}</p>
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      <div className="space-y-2">
        <Label className="font-semibold text-gray-800">Zusätzliche Bemerkungen</Label>
        <Textarea
          value={data.bemerkungen || ''}
          onChange={(e) => updateData({ bemerkungen: e.target.value })}
          placeholder="Haben Sie spezielle Anforderungen oder Hinweise?"
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
      <div className="space-y-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
        <div className="flex items-start gap-3">
          <Checkbox
            id="agb"
            checked={data.agb_akzeptiert}
            onCheckedChange={(checked) => updateData({ agb_akzeptiert: checked as boolean })}
          />
          <Label htmlFor="agb" className="text-sm cursor-pointer">
            Ich akzeptiere die <a href="/agb" className="text-orange-600 underline" target="_blank">AGB</a> und <a href="/datenschutz" className="text-orange-600 underline" target="_blank">Datenschutzbestimmungen</a> *
          </Label>
        </div>
        
        <div className="flex items-start gap-3">
          <Checkbox
            id="stellflaeche"
            checked={data.stellflaeche_bestaetigt}
            onCheckedChange={(checked) => updateData({ stellflaeche_bestaetigt: checked as boolean })}
          />
          <Label htmlFor="stellflaeche" className="text-sm cursor-pointer">
            Ich bestätige, dass die Angaben zur Stellfläche korrekt sind *
          </Label>
        </div>
        
        <div className="flex items-start gap-3">
          <Checkbox
            id="berechtigung"
            checked={data.berechtigung_bestaetigt}
            onCheckedChange={(checked) => updateData({ berechtigung_bestaetigt: checked as boolean })}
          />
          <Label htmlFor="berechtigung" className="text-sm cursor-pointer">
            Ich bin berechtigt, diese Buchung vorzunehmen *
          </Label>
        </div>
      </div>
    </div>
  );
}


