// FloorSelector.tsx - Floor level selector with visual cards

import { cn } from "@/lib/utils";
import { FloorLevel, FLOOR_LEVEL_LABELS } from "@/types/umzug";
import { ArrowDown, DoorOpen, ArrowUp, Check } from "lucide-react";
import React from "react";

interface FloorSelectorProps {
  value: FloorLevel;
  onChange: (value: FloorLevel) => void;
  className?: string;
}

interface FloorOption {
  value: FloorLevel;
  icon: React.ReactNode;
  label: string;
}

const FLOOR_OPTIONS: FloorOption[] = [
  { value: 'basement', icon: <ArrowDown className="w-5 h-5" />, label: 'UG' },
  { value: 'ground_floor', icon: <DoorOpen className="w-5 h-5" />, label: 'EG' },
  { value: 'raised_ground', icon: <ArrowUp className="w-5 h-5" />, label: 'HP' },
  { value: 'floor_1', icon: <span className="text-lg font-bold">1</span>, label: '' },
  { value: 'floor_2', icon: <span className="text-lg font-bold">2</span>, label: '' },
  { value: 'floor_3', icon: <span className="text-lg font-bold">3</span>, label: '' },
  { value: 'floor_4', icon: <span className="text-lg font-bold">4</span>, label: '' },
  { value: 'floor_5_plus', icon: <span className="text-lg font-bold">5+</span>, label: '' },
];

export const FloorSelector = ({
  value,
  onChange,
  className,
}: FloorSelectorProps) => {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3", className)}>
      {FLOOR_OPTIONS.map((option) => {
        const isSelected = value === option.value;
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative p-4 rounded-xl border-2 transition-all duration-200",
              "hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-gray-200 bg-white"
            )}
          >
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            
            {/* Icon */}
            <div className={cn(
              "w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center",
              isSelected 
                ? "bg-primary/10 text-primary" 
                : "bg-gray-100 text-gray-600"
            )}>
              {option.icon}
            </div>
            
            {/* Label */}
            <span className={cn(
              "text-sm font-medium block text-center",
              isSelected 
                ? "text-primary" 
                : "text-gray-700"
            )}>
              {FLOOR_LEVEL_LABELS[option.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
};


