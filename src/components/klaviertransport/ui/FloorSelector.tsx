import { cn } from "@/lib/utils";
import { FloorLevel, floorLabels } from "@/types/klaviertransport";

interface FloorSelectorProps {
  value: FloorLevel;
  onChange: (value: FloorLevel) => void;
  showPriceHint?: boolean;
  pricePerFloor?: number;
}

const floors: FloorLevel[] = [
  'basement',
  'ground_floor',
  'floor_1',
  'floor_2',
  'floor_3',
  'floor_4',
  'floor_5_plus'
];

const floorShortLabels: Record<FloorLevel, string> = {
  basement: 'UG',
  ground_floor: 'EG',
  floor_1: '1.',
  floor_2: '2.',
  floor_3: '3.',
  floor_4: '4.',
  floor_5_plus: '5.+'
};

export function FloorSelector({ value, onChange, showPriceHint, pricePerFloor = 40 }: FloorSelectorProps) {
  const getFloorNumber = (floor: FloorLevel): number => {
    const map: Record<FloorLevel, number> = {
      basement: 0,
      ground_floor: 0,
      floor_1: 1,
      floor_2: 2,
      floor_3: 3,
      floor_4: 4,
      floor_5_plus: 5
    };
    return map[floor];
  };
  
  const selectedFloorNum = getFloorNumber(value);
  
  return (
    <div className="space-y-3">
      {/* Floor Selection */}
      <div className="flex flex-wrap gap-2">
        {floors.map((floor) => (
          <button
            key={floor}
            type="button"
            onClick={() => onChange(floor)}
            className={cn(
              "px-4 py-2 rounded-lg border-2 font-medium transition-all",
              value === floor
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                : "border-gray-200 dark:border-gray-700 hover:border-blue-300 text-gray-600 dark:text-gray-400"
            )}
          >
            {floorShortLabels[floor]}
          </button>
        ))}
      </div>
      
      {/* Selected Floor Label */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Gewählt: <span className="font-medium">{floorLabels[value]}</span>
      </div>
      
      {/* Price Hint */}
      {showPriceHint && selectedFloorNum > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
          {selectedFloorNum}. Stock ohne Lift = ca. +CHF {selectedFloorNum * pricePerFloor}.-
        </div>
      )}
    </div>
  );
}


