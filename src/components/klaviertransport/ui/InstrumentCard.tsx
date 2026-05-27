import { 
  Check, 
  CheckCircle2,
  Piano, 
  Music2, 
  Music4, 
  Keyboard, 
  HelpCircle,
  LucideIcon 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InstrumentType, instrumentSpecs, getWeightDisplay } from "@/types/klaviertransport";

// Icon mapping for instrument types - using appropriate icons
const INSTRUMENT_ICONS: Record<InstrumentType, LucideIcon> = {
  digitalpiano: Keyboard,
  spinett: Piano,
  pianino_small: Piano,
  pianino_medium: Piano,
  pianino_large: Piano,
  stutzfluegel: Music2,
  salonfluegel: Music2,
  halbkonzertfluegel: Music2,
  konzertfluegel: Music4,
  cembalo: Music2,
  orgel: Music4,
  other: HelpCircle,
};

interface InstrumentCardProps {
  type: InstrumentType;
  selected: boolean;
  onClick: () => void;
}

export function InstrumentCard({ type, selected, onClick }: InstrumentCardProps) {
  const spec = instrumentSpecs[type];
  const IconComponent = INSTRUMENT_ICONS[type];
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative p-5 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-blue-300"
      )}
    >
      {/* Selected Indicator */}
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}
      
      {/* Icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
        selected 
          ? "bg-blue-500 text-white" 
          : "bg-gray-100 text-gray-600"
      )}>
        <IconComponent className="w-6 h-6" />
      </div>
      
      {/* Label */}
      <h4 className={cn(
        "font-semibold text-sm mb-1",
        selected ? "text-blue-700" : "text-gray-800"
      )}>
        {spec.labelShort}
      </h4>
      
      {/* Weight & Dimensions */}
      <div className="flex flex-wrap gap-1 text-xs text-gray-500 mb-2">
        <span className="bg-gray-100 px-2 py-0.5 rounded">
          {getWeightDisplay(type)}
        </span>
      </div>
      
      {/* Demontage Badge */}
      {spec.needs_demontage && (
        <div className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Demontage inkl.
        </div>
      )}
    </button>
  );
}
