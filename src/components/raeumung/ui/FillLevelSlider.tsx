// FillLevelSlider.tsx - Visual slider for indicating fill level percentage

import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Package } from "lucide-react";

interface FillLevelSliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  showPercentage?: boolean;
  showLabels?: boolean;
}

const fillLevelLabels = [
  { value: 0, label: "Leer" },
  { value: 25, label: "Wenig" },
  { value: 50, label: "Halb" },
  { value: 75, label: "Voll" },
  { value: 100, label: "Überfüllt" },
];

const getFillLevelInfo = (value: number) => {
  if (value <= 25) return { label: "Wenig gefüllt" };
  if (value <= 50) return { label: "Halb gefüllt" };
  if (value <= 75) return { label: "Stark gefüllt" };
  return { label: "Komplett voll" };
};

export const FillLevelSlider = ({
  value,
  onChange,
  label = "Füllgrad",
  showPercentage = true,
  showLabels = true,
}: FillLevelSliderProps) => {
  const levelInfo = getFillLevelInfo(value);

  return (
    <div className="space-y-4">
      {/* Header with label and percentage */}
      <div className="flex justify-between items-center">
        <span className="font-medium text-gray-700">{label}</span>
        {showPercentage && (
          <span className="font-semibold text-lg text-gray-700">
            {value}% - {levelInfo.label}
          </span>
        )}
      </div>

      {/* Visual fill indicator */}
      <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
        <div
          className="absolute left-0 top-0 h-full transition-all duration-300 bg-primary/70"
          style={{ width: `${value}%` }}
        />
        {/* Box icons to represent items */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 px-4">
          {Array.from({ length: Math.ceil(value / 20) }).map((_, i) => (
            <Package key={i} className="w-4 h-4 text-white opacity-80" />
          ))}
        </div>
      </div>

      {/* Slider */}
      <Slider
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        min={0}
        max={100}
        step={5}
        className="w-full"
      />

      {/* Labels below slider */}
      {showLabels && (
        <div className="flex justify-between text-xs text-gray-500">
          {fillLevelLabels.map((level) => (
            <span
              key={level.value}
              className={cn(
                "transition-colors",
                value >= level.value ? "text-gray-700" : "text-gray-400"
              )}
            >
              {level.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default FillLevelSlider;


