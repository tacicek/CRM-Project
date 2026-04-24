import { cn } from "@/lib/utils";
import { SpaceAvailability } from "@/types/moebellift";

interface SpaceAssessmentProps {
  value: SpaceAvailability;
  onChange: (space: SpaceAvailability) => void;
}

const spaceOptions: { value: SpaceAvailability; label: string; description: string; icon: string }[] = [
  {
    value: 'sufficient',
    label: 'Ja, ausreichend Platz',
    description: 'Mehr als 3m x 3m verfügbar',
    icon: '✅'
  },
  {
    value: 'limited',
    label: 'Eingeschränkt',
    description: '1.5m - 3m verfügbar',
    icon: '⚠️'
  },
  {
    value: 'very_limited',
    label: 'Sehr wenig Platz',
    description: 'Weniger als 1.5m',
    icon: '🚫'
  },
  {
    value: 'unsure',
    label: 'Unsicher',
    description: 'Beratung gewünscht',
    icon: '❓'
  }
];

export function SpaceAssessment({ value, onChange }: SpaceAssessmentProps) {
  return (
    <div className="space-y-4">
      {/* Info box */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">
          Der Möbellift benötigt eine freie Fläche vor dem Gebäude:
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-200 rounded flex items-center justify-center">
              <span className="text-blue-700 font-mono text-xs">3x3</span>
            </div>
            <div>
              <p className="font-medium text-blue-700">Anhängerlift</p>
              <p className="text-blue-600 text-xs">mind. 3m x 3m</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-200 rounded flex items-center justify-center">
              <span className="text-blue-700 font-mono text-xs">1.5</span>
            </div>
            <div>
              <p className="font-medium text-blue-700">Stecklift</p>
              <p className="text-blue-600 text-xs">mind. 1.5m x 1.5m</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Space options */}
      <div className="space-y-2">
        <p className="font-medium text-gray-700">
          Ist vor dem Gebäude ausreichend Platz vorhanden?
        </p>
        <div className="space-y-2">
          {spaceOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                "hover:border-orange-300",
                value === option.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1">
                <p className={cn(
                  "font-medium",
                  value === option.value ? "text-orange-700" : "text-gray-800"
                )}>
                  {option.label}
                </p>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
              {value === option.value && (
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Warning for very limited space */}
      {value === 'very_limited' && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
          <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-800">Eingeschränkte Möglichkeiten</p>
            <p className="text-xs text-red-600 mt-0.5">
              Bei sehr wenig Platz ist möglicherweise nur ein Stecklift einsetzbar oder eine alternative Lösung (z.B. Kran) erforderlich.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


