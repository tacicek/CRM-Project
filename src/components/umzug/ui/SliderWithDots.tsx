// SliderWithDots.tsx - A visual slider component with dot indicators

import { cn } from "@/lib/utils";

interface SliderWithDotsProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: number[];
  suffix?: string;
  className?: string;
}

export const SliderWithDots = ({
  label,
  value,
  onChange,
  options,
  suffix = "",
  className,
}: SliderWithDotsProps) => {
  const currentIndex = options.indexOf(value);
  
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
          {value}{suffix}
        </span>
      </div>
      
      <div className="relative py-2">
        {/* Track line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2" />
        
        {/* Progress line */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 transition-all duration-200"
          style={{ width: `${(currentIndex / (options.length - 1)) * 100}%` }}
        />
        
        {/* Dots */}
        <div className="relative flex justify-between">
          {options.map((option, index) => {
            const isActive = index <= currentIndex;
            const isCurrent = option === value;
            
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={cn(
                  "w-4 h-4 rounded-full border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isCurrent
                    ? "bg-blue-500 border-blue-500 scale-125"
                    : isActive
                    ? "bg-blue-400 border-blue-400"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400"
                )}
                aria-label={`${option}${suffix}`}
              />
            );
          })}
        </div>
        
        {/* Labels below dots */}
        <div className="flex justify-between mt-2">
          {options.map((option) => (
            <span
              key={option}
              className={cn(
                "text-xs transition-colors",
                option === value
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-500 dark:text-gray-400"
              )}
            >
              {option === options[options.length - 1] && option >= 10 ? `${option}+` : option}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};


