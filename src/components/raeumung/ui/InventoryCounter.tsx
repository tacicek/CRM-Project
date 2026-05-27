// InventoryCounter.tsx - Counter component for inventory items with icons

import React from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InventoryCounterProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  icon?: React.ReactNode;
  unit?: string;
  description?: string;
  showWarning?: boolean;
  warningText?: string;
}

export const InventoryCounter = ({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  icon,
  unit,
  description,
  showWarning,
  warningText,
}: InventoryCounterProps) => {
  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-all",
        value > 0
          ? "bg-primary/5 border-primary/30"
          : "bg-white border-gray-200 hover:border-gray-300"
      )}
    >
      {/* Left side: Icon and label */}
      <div className="flex items-center gap-3">
        {icon && <div className="w-8 h-8 flex items-center justify-center text-gray-500">{icon}</div>}
        <div>
          <span className={cn(
            "font-medium text-sm",
            value > 0 ? "text-primary" : "text-gray-700"
          )}>
            {label}
          </span>
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
          {showWarning && value > 0 && warningText && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {warningText}
            </p>
          )}
        </div>
      </div>

      {/* Right side: Counter */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={handleDecrement}
          disabled={value <= min}
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="w-12 text-center">
          <span className={cn(
            "font-semibold text-lg",
            value > 0 ? "text-blue-600" : "text-gray-400"
          )}>
            {value}
          </span>
          {unit && (
            <span className="text-xs text-gray-500 ml-1">{unit}</span>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
          onClick={handleIncrement}
          disabled={value >= max}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default InventoryCounter;


