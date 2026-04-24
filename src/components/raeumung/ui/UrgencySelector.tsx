// UrgencySelector.tsx - Selector for urgency level with visual indicators

import { cn } from "@/lib/utils";
import { Check, Clock, AlertCircle, AlertTriangle, Zap } from "lucide-react";
import { UrgencyLevel } from "@/types/raeumung";

interface UrgencyOption {
  value: UrgencyLevel;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  timeline: string;
}

const urgencyOptions: UrgencyOption[] = [
  {
    value: "normal",
    label: "Normal",
    description: "Flexible Terminplanung",
    icon: <Clock className="w-5 h-5" />,
    color: "text-gray-600",
    bgColor: "bg-gray-50 border-gray-200 hover:border-gray-400",
    timeline: "2-4 Wochen",
  },
  {
    value: "urgent",
    label: "Dringend",
    description: "Zeitnahe Durchführung",
    icon: <AlertCircle className="w-5 h-5" />,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200 hover:border-yellow-400",
    timeline: "1-2 Wochen",
  },
  {
    value: "very_urgent",
    label: "Sehr dringend",
    description: "Schnelle Reaktion",
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200 hover:border-orange-400",
    timeline: "3-7 Tage",
  },
  {
    value: "emergency",
    label: "Notfall",
    description: "Sofortige Bearbeitung",
    icon: <Zap className="w-5 h-5" />,
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200 hover:border-red-400",
    timeline: "24-48 Stunden",
  },
];

interface UrgencySelectorProps {
  value: UrgencyLevel;
  onChange: (value: UrgencyLevel) => void;
  label?: string;
}

export const UrgencySelector = ({
  value,
  onChange,
  label = "Dringlichkeit",
}: UrgencySelectorProps) => {
  return (
    <div className="space-y-4">
      {label && (
        <label className="block font-medium text-gray-700">{label}</label>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {urgencyOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200",
              option.bgColor,
              value === option.value && "ring-2 ring-offset-2 ring-blue-500 shadow-md"
            )}
          >
            {/* Selected indicator */}
            {value === option.value && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}

            {/* Icon */}
            <div className={cn("mb-2", option.color)}>
              {option.icon}
            </div>

            {/* Label */}
            <span className={cn("font-medium text-sm", option.color)}>
              {option.label}
            </span>

            {/* Timeline */}
            <span className="text-xs text-gray-500 mt-1">
              {option.timeline}
            </span>

            {/* Description */}
            <span className="text-xs text-gray-400 text-center mt-1">
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default UrgencySelector;


