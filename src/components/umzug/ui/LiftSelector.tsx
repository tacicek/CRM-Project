// LiftSelector.tsx - Elevator type selector with visual cards

import { cn } from "@/lib/utils";
import { LiftType, LIFT_TYPE_LABELS } from "@/types/umzug";

interface LiftSelectorProps {
  value: LiftType;
  onChange: (value: LiftType) => void;
  className?: string;
}

export const LiftSelector = ({
  value,
  onChange,
  className,
}: LiftSelectorProps) => {
  const liftTypes: LiftType[] = ['small_elevator', 'large_elevator', 'cargo_elevator'];
  
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {liftTypes.map((liftType) => {
        const info = LIFT_TYPE_LABELS[liftType];
        const isSelected = value === liftType;
        
        return (
          <button
            key={liftType}
            type="button"
            onClick={() => onChange(liftType)}
            className={cn(
              "relative p-4 rounded-xl border-2 transition-all duration-200 text-left",
              "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              isSelected
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300"
            )}
          >
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            
            {/* Lift Icon */}
            <div className="mb-3 flex justify-center">
              <LiftIcon type={liftType} className={cn(
                "w-16 h-20",
                isSelected ? "text-blue-600" : "text-gray-400"
              )} />
            </div>
            
            {/* Label */}
            <h4 className={cn(
              "font-semibold text-center mb-1",
              isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"
            )}>
              {info.label}
            </h4>
            
            {/* Capacity info */}
            <div className="text-center space-y-0.5">
              <p className="text-sm text-gray-500 dark:text-gray-400">{info.capacity}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{info.weight}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// Lift icon component
const LiftIcon = ({ type, className }: { type: LiftType; className?: string }) => {
  // Different sizes based on lift type
  const sizes = {
    small_elevator: { width: 24, height: 32, persons: 4 },
    large_elevator: { width: 32, height: 36, persons: 8 },
    cargo_elevator: { width: 40, height: 40, persons: 13 },
  };
  
  const size = sizes[type] || sizes.small_elevator;
  
  return (
    <svg viewBox="0 0 64 80" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      {/* Elevator frame */}
      <rect 
        x={32 - size.width / 2} 
        y={40 - size.height / 2} 
        width={size.width} 
        height={size.height} 
        rx="2" 
        strokeWidth="2.5"
      />
      
      {/* Door line */}
      <line x1="32" y1={40 - size.height / 2 + 4} x2="32" y2={40 + size.height / 2 - 4} strokeWidth="1.5" />
      
      {/* Person icons (simplified) */}
      {type === 'small_elevator' && (
        <>
          <circle cx="28" cy="52" r="2" fill="currentColor" />
          <circle cx="36" cy="52" r="2" fill="currentColor" />
        </>
      )}
      {type === 'large_elevator' && (
        <>
          <circle cx="24" cy="52" r="2" fill="currentColor" />
          <circle cx="32" cy="52" r="2" fill="currentColor" />
          <circle cx="40" cy="52" r="2" fill="currentColor" />
        </>
      )}
      {type === 'cargo_elevator' && (
        <>
          <circle cx="20" cy="52" r="2" fill="currentColor" />
          <circle cx="28" cy="52" r="2" fill="currentColor" />
          <circle cx="36" cy="52" r="2" fill="currentColor" />
          <circle cx="44" cy="52" r="2" fill="currentColor" />
          <rect x="24" y="30" width="16" height="10" rx="1" fill="currentColor" opacity="0.3" />
        </>
      )}
      
      {/* Up/Down arrows */}
      <path d="M32 8 L36 14 L28 14 Z" fill="currentColor" />
      <path d="M32 72 L36 66 L28 66 Z" fill="currentColor" />
    </svg>
  );
};


