import { cn } from "@/lib/utils";
import { FloorLevel, floorHeights } from "@/types/moebellift";

interface FloorSelectorProps {
  value: FloorLevel;
  onChange: (floor: FloorLevel) => void;
}

const floors: { value: FloorLevel; label: string }[] = [
  { value: 'floor_1', label: '1. OG' },
  { value: 'floor_2', label: '2. OG' },
  { value: 'floor_3', label: '3. OG' },
  { value: 'floor_4', label: '4. OG' },
  { value: 'floor_5', label: '5. OG' },
  { value: 'floor_6', label: '6. OG' },
  { value: 'floor_7_plus', label: '7.+ OG' },
  { value: 'roof', label: 'Dach' },
];

export function FloorSelector({ value, onChange }: FloorSelectorProps) {
  const selectedHeight = floorHeights[value];
  
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Wohin sollen die Gegenstände geliftet werden?
      </p>
      
      {/* Floor selection grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {floors.map((floor) => (
          <button
            key={floor.value}
            type="button"
            onClick={() => onChange(floor.value)}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
              "hover:border-orange-300",
              value === floor.value
                ? "border-orange-500 bg-orange-50"
                : "border-gray-200 bg-white"
            )}
          >
            <span className={cn(
              "font-semibold text-sm",
              value === floor.value ? "text-orange-600" : "text-gray-700"
            )}>
              {floor.label}
            </span>
            <span className="text-xs text-gray-400 mt-1">
              ~{floorHeights[floor.value]}m
            </span>
          </button>
        ))}
      </div>
      
      {/* Height indicator */}
      <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
        <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-orange-700">
          Geschätzte Höhe: <strong>~{selectedHeight} Meter</strong>
        </span>
      </div>
      
      {/* Warning for high floors */}
      {['floor_6', 'floor_7_plus', 'roof'].includes(value) && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Hohe Etage</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Für diese Höhe ist ein Anhängerlift mit entsprechender Reichweite erforderlich.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


