// Step15AdditionalServices.tsx - Additional moving services

import { AdditionalServices } from "@/types/umzug";
import { CounterInput } from "@/components/reinigung/ui/CounterInput";
import { cn } from "@/lib/utils";
import { 
  Package, 
  PackageOpen, 
  Wrench, 
  Trash2, 
  SprayCan, 
  Warehouse, 
  CableCar,
  Info,
  Check
} from "lucide-react";

interface Step15Props {
  data: AdditionalServices;
  onChange: (data: Partial<AdditionalServices>) => void;
}

interface ServiceCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  highlight?: boolean;
}

const ServiceCard = ({ 
  icon, 
  title, 
  subtitle, 
  active, 
  onToggle, 
  children,
  highlight 
}: ServiceCardProps) => (
  <div className={cn(
    "rounded-xl border-2 transition-all duration-200 overflow-hidden",
    active
      ? highlight 
        ? "border-orange-500 bg-orange-50"
        : "border-blue-500 bg-blue-50"
      : "border-gray-200 hover:border-blue-300"
  )}>
    <button
      type="button"
      onClick={onToggle}
      className="w-full p-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          active 
            ? highlight
              ? "bg-orange-500 text-white"
              : "bg-blue-500 text-white" 
            : "bg-gray-100 text-gray-600"
        )}>
          {icon}
        </div>
        <div className="text-left">
          <span className={cn(
            "font-medium block",
            active 
              ? highlight 
                ? "text-orange-700"
                : "text-blue-700" 
              : "text-gray-800"
          )}>
            {title}
          </span>
          <span className="text-sm text-gray-500">
            {subtitle}
          </span>
        </div>
      </div>
      
      {/* Toggle Switch */}
      <div className={cn(
        "w-12 h-6 rounded-full relative transition-colors",
        active 
          ? highlight
            ? "bg-orange-500"
            : "bg-blue-500" 
          : "bg-gray-300"
      )}>
        <div className={cn(
          "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform",
          active ? "translate-x-6" : "translate-x-0.5"
        )} />
      </div>
    </button>
    
    {/* Expanded Content */}
    {active && children && (
      <div className="px-4 pb-4 pt-2 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
        {children}
      </div>
    )}
  </div>
);

export const Step15AdditionalServices = ({ data, onChange }: Step15Props) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <Package className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
          Zusätzliche Dienstleistungen
        </h2>
        <p className="text-gray-600">
          Optionale Services für einen sorgenfreien Umzug
        </p>
      </div>

      <div className="space-y-4">
        {/* Packing Service */}
        <ServiceCard
          icon={<Package className="w-5 h-5" />}
          title="Verpackungsservice"
          subtitle="Wir verpacken Ihre Sachen professionell"
          active={data.verpackung.aktiv}
          onToggle={() => onChange({ 
            verpackung: { 
              ...data.verpackung, 
              aktiv: !data.verpackung.aktiv 
            } 
          })}
        >
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-3">
              Umfang des Verpackungsservice:
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onChange({ 
                  verpackung: { ...data.verpackung, umfang: 'alles' } 
                })}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  data.verpackung.umfang === 'alles'
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700"
                )}
              >
                Alles verpacken
              </button>
              <button
                type="button"
                onClick={() => onChange({ 
                  verpackung: { ...data.verpackung, umfang: 'nur_fragiles' } 
                })}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  data.verpackung.umfang === 'nur_fragiles'
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700"
                )}
              >
                Nur Fragiles
              </button>
            </div>
          </div>
        </ServiceCard>

        {/* Unpacking Service */}
        <ServiceCard
          icon={<PackageOpen className="w-5 h-5" />}
          title="Auspackservice"
          subtitle="Wir packen am Zielort aus"
          active={data.auspacken}
          onToggle={() => onChange({ auspacken: !data.auspacken })}
        />

        {/* Furniture Assembly */}
        <ServiceCard
          icon={<Wrench className="w-5 h-5" />}
          title="Möbelmontage/-demontage"
          subtitle="Auf- und Abbau Ihrer Möbel"
          active={data.moebelmontage}
          onToggle={() => onChange({ moebelmontage: !data.moebelmontage })}
        />

        {/* Disposal */}
        <ServiceCard
          icon={<Trash2 className="w-5 h-5" />}
          title="Entsorgung"
          subtitle="Wir entsorgen nicht benötigte Gegenstände"
          active={data.entsorgung.aktiv}
          onToggle={() => onChange({ 
            entsorgung: { 
              ...data.entsorgung, 
              aktiv: !data.entsorgung.aktiv 
            } 
          })}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Geschätztes Volumen (m³):
            </span>
            <CounterInput
              value={data.entsorgung.volumen_m3}
              onChange={(value) => onChange({ 
                entsorgung: { ...data.entsorgung, volumen_m3: value } 
              })}
              min={1}
              max={20}
            />
          </div>
        </ServiceCard>

        {/* End Cleaning */}
        <ServiceCard
          icon={<SprayCan className="w-5 h-5" />}
          title="Endreinigung"
          subtitle="Übergabereinigung der alten Wohnung"
          active={data.endreinigung}
          onToggle={() => onChange({ endreinigung: !data.endreinigung })}
          highlight
        >
          <div className="flex items-start gap-2 text-sm text-orange-700">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Die Endreinigung kann separat über unser detailliertes 
              Reinigungsformular konfiguriert werden.
            </p>
          </div>
        </ServiceCard>

        {/* Temporary Storage */}
        <ServiceCard
          icon={<Warehouse className="w-5 h-5" />}
          title="Zwischenlagerung"
          subtitle="Temporäre Lagerung Ihrer Möbel"
          active={data.zwischenlagerung.aktiv}
          onToggle={() => onChange({ 
            zwischenlagerung: { 
              ...data.zwischenlagerung, 
              aktiv: !data.zwischenlagerung.aktiv 
            } 
          })}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Dauer (Wochen):
            </span>
            <CounterInput
              value={data.zwischenlagerung.dauer_wochen}
              onChange={(value) => onChange({ 
                zwischenlagerung: { ...data.zwischenlagerung, dauer_wochen: value } 
              })}
              min={1}
              max={52}
            />
          </div>
        </ServiceCard>

        {/* Furniture Lift */}
        <ServiceCard
          icon={<CableCar className="w-5 h-5" />}
          title="Möbellift"
          subtitle="Für schwer zugängliche Stockwerke"
          active={data.moebellift.aktiv}
          onToggle={() => onChange({ 
            moebellift: { 
              ...data.moebellift, 
              aktiv: !data.moebellift.aktiv 
            } 
          })}
        >
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-3">
              Wo wird der Möbellift benötigt?
            </p>
            <div className="flex gap-2">
              {(['auszug', 'einzug', 'beide'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange({ 
                    moebellift: { ...data.moebellift, standort: option } 
                  })}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    data.moebellift.standort === option
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-700"
                  )}
                >
                  {option === 'auszug' && 'Auszug'}
                  {option === 'einzug' && 'Einzug'}
                  {option === 'beide' && 'Beide'}
                </button>
              ))}
            </div>
          </div>
        </ServiceCard>
      </div>

      {/* Summary */}
      {Object.values(data).some(v => 
        typeof v === 'boolean' ? v : 
        typeof v === 'object' ? v.aktiv : false
      ) && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">
            Sie haben zusätzliche Services ausgewählt. Diese werden im Angebot 
            berücksichtigt und können jederzeit angepasst werden.
          </p>
        </div>
      )}
    </div>
  );
};


