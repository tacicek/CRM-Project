// ConditionCard.tsx - Card for selecting condition level with visual indicators

import { cn } from "@/lib/utils";
import { Check, Sparkles, Brush, AlertTriangle, AlertOctagon } from "lucide-react";
import { ConditionLevel } from "@/types/raeumung";
import React from "react";

interface ConditionOption {
  value: ConditionLevel;
  label: string;
  description: string;
  icon: React.ReactNode;
  level: number;
}

const conditionOptions: ConditionOption[] = [
  {
    value: "normal",
    label: "Normal",
    description: "Sauber und ordentlich",
    icon: <Sparkles className="w-5 h-5" />,
    level: 1,
  },
  {
    value: "dirty",
    label: "Verschmutzt",
    description: "Oberflächliche Verschmutzung",
    icon: <Brush className="w-5 h-5" />,
    level: 2,
  },
  {
    value: "very_dirty",
    label: "Stark verschmutzt",
    description: "Erhebliche Verschmutzung",
    icon: <AlertTriangle className="w-5 h-5" />,
    level: 3,
  },
  {
    value: "extreme",
    label: "Extrem",
    description: "Spezialreinigung erforderlich",
    icon: <AlertOctagon className="w-5 h-5" />,
    level: 4,
  },
];

interface ConditionCardProps {
  value: ConditionLevel;
  onChange: (value: ConditionLevel) => void;
  label?: string;
}

export const ConditionCard = ({
  value,
  onChange,
  label = "Allgemeiner Zustand",
}: ConditionCardProps) => {
  return (
    <div className="space-y-4">
      {label && (
        <label className="block font-medium text-gray-700">{label}</label>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {conditionOptions.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 bg-white hover:border-primary/50"
              )}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Icon */}
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center mb-2",
                isSelected ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
              )}>
                {option.icon}
              </div>

              {/* Label */}
              <span className={cn(
                "font-medium text-sm",
                isSelected ? "text-primary" : "text-gray-700"
              )}>
                {option.label}
              </span>

              {/* Description */}
              <span className="text-xs text-gray-500 text-center mt-1">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ConditionCard;


