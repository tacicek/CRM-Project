import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { 
  KlaviertransportAnfrage, 
  AdditionalServices,
  TuningTime,
  StorageDuration,
  instrumentSpecs,
  createEmptyAdditionalServices
} from "@/types/klaviertransport";

interface Step6Props {
  data: Partial<KlaviertransportAnfrage>;
  updateServices: (services: AdditionalServices) => void;
  errors: Record<string, string>;
}

const tuningTimeOptions: { value: TuningTime; label: string; recommended?: boolean }[] = [
  { value: 'direkt', label: 'Direkt nach Transport' },
  { value: 'nach_2_3_wochen', label: 'Nach 2-3 Wochen Akklimatisierung', recommended: true },
  { value: 'spaeter', label: 'Zu einem späteren Zeitpunkt' }
];

const storageDurationOptions: { value: StorageDuration; label: string }[] = [
  { value: '1_2_weeks', label: '1-2 Wochen' },
  { value: '1_month', label: '1 Monat' },
  { value: '2_3_months', label: '2-3 Monate' },
  { value: '3_6_months', label: '3-6 Monate' },
  { value: 'over_6_months', label: 'Länger als 6 Monate' }
];

const insuranceSums = [10000, 25000, 50000, 100000];

interface ServiceCardProps {
  title: string;
  subtitle: string;
  icon: string;
  price: string;
  active: boolean;
  onToggle: (active: boolean) => void;
  children?: React.ReactNode;
}

function ServiceCard({ title, subtitle, icon, price, active, onToggle, children }: ServiceCardProps) {
  return (
    <div className={cn(
      "rounded-xl border-2 transition-all overflow-hidden",
      active 
        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30" 
        : "border-gray-200 dark:border-gray-700"
    )}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="font-semibold">{title}</div>
              <div className="text-sm text-gray-500">{subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-blue-600 dark:text-blue-400">{price}</span>
            <Switch checked={active} onCheckedChange={onToggle} />
          </div>
        </div>
      </div>
      
      {active && children && (
        <div className="px-4 pb-4 pt-2 border-t border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          {children}
        </div>
      )}
    </div>
  );
}

export function Step6AdditionalServices({ data, updateServices, errors: _errors }: Step6Props) {
  const services = data.zusatzleistungen || createEmptyAdditionalServices();
  const isDigital = data.instrument_type === 'digitalpiano';
  const spec = data.instrument_type ? instrumentSpecs[data.instrument_type] : null;
  
  const updateService = <K extends keyof AdditionalServices>(
    field: K, 
    value: AdditionalServices[K]
  ) => {
    updateServices({ ...services, [field]: value });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">✨ Zusätzliche Dienstleistungen</h3>
        <p className="text-sm text-gray-500">Wählen Sie optionale Services für Ihren Transport</p>
      </div>
      
      <div className="space-y-4">
        {/* Tuning Service - Hide for digital pianos */}
        {!isDigital && (
          <ServiceCard
            title="Klavierstimmen"
            subtitle="Nach dem Transport durch Fachmann"
            icon="🎵"
            price="CHF 180-280"
            active={services.stimmen.aktiv}
            onToggle={(active) => updateService('stimmen', { ...services.stimmen, aktiv: active })}
          >
            <div className="space-y-2">
              <Label className="text-sm">Wann soll gestimmt werden?</Label>
              <div className="space-y-2">
                {tuningTimeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateService('stimmen', { 
                      ...services.stimmen, 
                      zeitpunkt: option.value 
                    })}
                    className={cn(
                      "w-full p-2 rounded-lg border text-left text-sm transition-all flex items-center justify-between",
                      services.stimmen.zeitpunkt === option.value
                        ? "border-blue-500 bg-white dark:bg-gray-800"
                        : "border-gray-200 dark:border-gray-600"
                    )}
                  >
                    <span>{option.label}</span>
                    {option.recommended && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        empfohlen
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </ServiceCard>
        )}
        
        {/* Special Packaging */}
        <ServiceCard
          title="Spezialverpackung"
          subtitle="Extra Schutz für wertvolle Instrumente"
          icon="📦"
          price="CHF 50-150"
          active={services.verpackung}
          onToggle={(active) => updateService('verpackung', active)}
        />
        
        {/* Storage */}
        <ServiceCard
          title="Zwischenlagerung"
          subtitle="Klimatisierte Lagerung"
          icon="🏠"
          price="CHF 100-200/Mt."
          active={services.lagerung.aktiv}
          onToggle={(active) => updateService('lagerung', { ...services.lagerung, aktiv: active })}
        >
          <div className="space-y-2">
            <Label className="text-sm">Voraussichtliche Lagerdauer</Label>
            <div className="grid grid-cols-2 gap-2">
              {storageDurationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateService('lagerung', { 
                    ...services.lagerung, 
                    dauer: option.value 
                  })}
                  className={cn(
                    "p-2 rounded-lg border text-sm transition-all",
                    services.lagerung.dauer === option.value
                      ? "border-blue-500 bg-white dark:bg-gray-800"
                      : "border-gray-200 dark:border-gray-600"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </ServiceCard>
        
        {/* Insurance */}
        <ServiceCard
          title="Zusatzversicherung"
          subtitle="Erhöhter Versicherungsschutz"
          icon="🛡️"
          price="~1-2% vom Wert"
          active={services.versicherung.aktiv}
          onToggle={(active) => updateService('versicherung', { ...services.versicherung, aktiv: active })}
        >
          <div className="space-y-2">
            <Label className="text-sm">Gewünschte Versicherungssumme</Label>
            <div className="grid grid-cols-2 gap-2">
              {insuranceSums.map((sum) => (
                <button
                  key={sum}
                  type="button"
                  onClick={() => updateService('versicherung', { 
                    ...services.versicherung, 
                    summe: sum 
                  })}
                  className={cn(
                    "p-2 rounded-lg border text-sm transition-all",
                    services.versicherung.summe === sum
                      ? "border-blue-500 bg-white dark:bg-gray-800"
                      : "border-gray-200 dark:border-gray-600"
                  )}
                >
                  CHF {sum.toLocaleString('de-CH')}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-sm">Andere Summe:</Label>
              <Input
                type="number"
                placeholder="CHF"
                className="w-32"
                value={services.versicherung.summe && !insuranceSums.includes(services.versicherung.summe) 
                  ? services.versicherung.summe 
                  : ''}
                onChange={(e) => updateService('versicherung', { 
                  ...services.versicherung, 
                  summe: parseInt(e.target.value) || undefined 
                })}
              />
            </div>
          </div>
        </ServiceCard>
        
        {/* Old instrument disposal */}
        <ServiceCard
          title="Entsorgung Altinstrument"
          subtitle="Altes Klavier fachgerecht entsorgen"
          icon="♻️"
          price={spec?.is_grand ? "CHF 350-600" : "CHF 200-400"}
          active={services.entsorgung_alt}
          onToggle={(active) => updateService('entsorgung_alt', active)}
        />
      </div>
      
      {/* Summary of selected services */}
      {(services.stimmen.aktiv || services.verpackung || services.lagerung.aktiv || 
        services.versicherung.aktiv || services.entsorgung_alt) && (
        <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
            Gewählte Zusatzleistungen
          </h4>
          <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
            {services.stimmen.aktiv && (
              <li>✓ Klavierstimmen {services.stimmen.zeitpunkt && `(${tuningTimeOptions.find(o => o.value === services.stimmen.zeitpunkt)?.label})`}</li>
            )}
            {services.verpackung && <li>✓ Spezialverpackung</li>}
            {services.lagerung.aktiv && (
              <li>✓ Zwischenlagerung {services.lagerung.dauer && `(${storageDurationOptions.find(o => o.value === services.lagerung.dauer)?.label})`}</li>
            )}
            {services.versicherung.aktiv && (
              <li>✓ Zusatzversicherung {services.versicherung.summe && `(CHF ${services.versicherung.summe.toLocaleString('de-CH')})`}</li>
            )}
            {services.entsorgung_alt && <li>✓ Entsorgung Altinstrument</li>}
          </ul>
        </div>
      )}
    </div>
  );
}


