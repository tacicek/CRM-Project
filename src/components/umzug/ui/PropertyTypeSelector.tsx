// PropertyTypeSelector.tsx - Property type selector with visual cards

import { cn } from "@/lib/utils";
import { PropertyType, PROPERTY_TYPE_LABELS } from "@/types/umzug";
import { Home, Building2, Users, Warehouse, Briefcase } from "lucide-react";

interface PropertyTypeSelectorProps {
  value: PropertyType;
  onChange: (value: PropertyType) => void;
  className?: string;
}

const PROPERTY_OPTIONS: { 
  value: PropertyType; 
  icon: React.ComponentType<{ className?: string }>; 
  description: string;
}[] = [
  { value: 'haus', icon: Home, description: 'Einfamilienhaus oder Villa' },
  { value: 'wohnung', icon: Building2, description: 'Mietwohnung oder Eigentum' },
  { value: 'wg_zimmer', icon: Users, description: 'Zimmer in Wohngemeinschaft' },
  { value: 'lager', icon: Warehouse, description: 'Lagerraum oder Garage' },
  { value: 'buero', icon: Briefcase, description: 'Büro oder Geschäftsräume' },
];

export const PropertyTypeSelector = ({
  value,
  onChange,
  className,
}: PropertyTypeSelectorProps) => {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {PROPERTY_OPTIONS.map((option) => {
        const isSelected = value === option.value;
        const Icon = option.icon;
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative p-5 rounded-xl border-2 transition-all duration-200 text-left",
              "hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              isSelected
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300"
            )}
          >
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            
            {/* Icon */}
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
              isSelected 
                ? "bg-blue-500 text-white" 
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            )}>
              <Icon className="w-6 h-6" />
            </div>
            
            {/* Label */}
            <h4 className={cn(
              "font-semibold mb-1",
              isSelected 
                ? "text-blue-700 dark:text-blue-300" 
                : "text-gray-800 dark:text-gray-200"
            )}>
              {PROPERTY_TYPE_LABELS[option.value]}
            </h4>
            
            {/* Description */}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {option.description}
            </p>
          </button>
        );
      })}
    </div>
  );
};


