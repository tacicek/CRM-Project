// DistanceSlider.tsx - Distance slider with non-linear steps

import { cn } from "@/lib/utils";

interface DistanceSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

// Non-linear distance options in meters
const DISTANCE_OPTIONS = [0, 10, 20, 30, 40, 50, 75, 100, 150, 200];

export const DistanceSlider = ({
  label,
  value,
  onChange,
  className,
}: DistanceSliderProps) => {
  const currentIndex = DISTANCE_OPTIONS.indexOf(value);
  const normalizedIndex = currentIndex === -1 ? 0 : currentIndex;
  
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {label}
        </span>
        <span className="text-lg font-bold text-blue-600">
          {value === 200 ? '200+' : value} Meter
        </span>
      </div>
      
      <div className="relative py-2">
        {/* Track line */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 rounded-full" />
        
        {/* Progress line */}
        <div 
          className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 -translate-y-1/2 rounded-full transition-all duration-200"
          style={{ width: `${(normalizedIndex / (DISTANCE_OPTIONS.length - 1)) * 100}%` }}
        />
        
        {/* Dots */}
        <div className="relative flex justify-between">
          {DISTANCE_OPTIONS.map((option, index) => {
            const isActive = index <= normalizedIndex;
            const isCurrent = option === value;
            
            // Color based on distance (green = close, red = far)
            const colorClass = index <= 3 
              ? "bg-green-500 border-green-500" 
              : index <= 6 
              ? "bg-yellow-500 border-yellow-500" 
              : "bg-red-500 border-red-500";
            
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={cn(
                  "w-4 h-4 rounded-full border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isCurrent
                    ? cn(colorClass, "scale-125")
                    : isActive
                    ? colorClass
                    : "bg-white border-gray-300 hover:border-blue-400"
                )}
                aria-label={`${option} Meter`}
              />
            );
          })}
        </div>
        
        {/* Labels below dots */}
        <div className="flex justify-between mt-2">
          {DISTANCE_OPTIONS.map((option, index) => (
            <span
              key={option}
              className={cn(
                "text-xs transition-colors",
                option === value
                  ? "text-blue-600 font-medium"
                  : "text-gray-500",
                // Hide some labels on mobile for better spacing
                index % 2 !== 0 && "hidden sm:block"
              )}
            >
              {option === 200 ? '200+' : option}
            </span>
          ))}
        </div>
      </div>
      
      {/* Visual indicator */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-500">Nah</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-gray-500">Mittel</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-gray-500">Weit</span>
        </div>
      </div>
    </div>
  );
};


