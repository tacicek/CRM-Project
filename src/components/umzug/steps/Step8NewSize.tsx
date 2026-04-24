// Step8NewSize.tsx - New property size details

import { SliderWithDots } from "../ui/SliderWithDots";
import { PropertyDetails } from "@/types/umzug";
import { CounterInput } from "@/components/reinigung/ui/CounterInput";

interface Step8Props {
  data: PropertyDetails;
  onChange: (data: Partial<PropertyDetails>) => void;
}

const ROOM_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

export const Step8NewSize = ({ data, onChange }: Step8Props) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 mb-4">
          <span className="text-3xl">🏠</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          Grösse der neuen Unterkunft
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Informationen zu Ihrem neuen Zuhause
        </p>
      </div>

      <div className="space-y-8">
        {/* Room Count */}
        <div className="space-y-4">
          <SliderWithDots
            label="Anzahl der Zimmer"
            value={data.anzahl_zimmer || 3}
            onChange={(value) => onChange({ anzahl_zimmer: value })}
            options={ROOM_OPTIONS}
            suffix=" Zimmer"
          />
        </div>

        {/* Number of Floors - Only for houses */}
        {data.property_type === 'haus' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-200">
                  Anzahl Etagen im Haus
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Wie viele Stockwerke hat das Haus?
                </p>
              </div>
              <CounterInput
                value={data.anzahl_stockwerke || 1}
                onChange={(value) => onChange({ anzahl_stockwerke: value })}
                min={1}
                max={5}
              />
            </div>
          </div>
        )}

        {/* Living Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800 dark:text-gray-200">
                Wohnfläche
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ungefähre Wohnfläche in Quadratmetern
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <CounterInput
              value={data.wohnflaeche_m2 || 70}
              onChange={(value) => onChange({ wohnflaeche_m2: value })}
              min={10}
              max={500}
              step={5}
            />
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              m²
            </span>
          </div>
          
          {/* Quick select buttons */}
          <div className="flex flex-wrap gap-2">
            {[30, 50, 70, 100, 150, 200].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ wohnflaeche_m2: size })}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  data.wohnflaeche_m2 === size
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {size} m²
              </button>
            ))}
          </div>
        </div>

        {/* Property-specific fields */}
        {data.property_type === 'haus' && (
          <div className="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-800 dark:text-gray-200">
              Zusätzliche Bereiche im neuen Haus
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.zusatz?.garage || false}
                  onChange={(e) => onChange({ 
                    zusatz: { ...data.zusatz, garage: e.target.checked } 
                  })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-gray-700 dark:text-gray-300">Garage</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.zusatz?.garten || false}
                  onChange={(e) => onChange({ 
                    zusatz: { ...data.zusatz, garten: e.target.checked } 
                  })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-gray-700 dark:text-gray-300">Garten</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.zusatz?.keller || false}
                  onChange={(e) => onChange({ 
                    zusatz: { ...data.zusatz, keller: e.target.checked } 
                  })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-gray-700 dark:text-gray-300">Keller</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.zusatz?.estrich || false}
                  onChange={(e) => onChange({ 
                    zusatz: { ...data.zusatz, estrich: e.target.checked } 
                  })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-gray-700 dark:text-gray-300">Estrich</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


