// AreaCheckboxCard.tsx - Checkbox card for selecting areas to clear

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface AreaCheckboxCardProps {
  id: string;
  label: string;
  icon?: string;
  selected: boolean;
  onChange: (selected: boolean) => void;
  disabled?: boolean;
}

export const AreaCheckboxCard = ({
  id: _id,
  label,
  icon,
  selected,
  onChange,
  disabled,
}: AreaCheckboxCardProps) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!selected)}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 w-full text-left",
        "hover:border-blue-300",
        selected
          ? "border-blue-500 bg-blue-50/50"
          : "border-gray-200 bg-white",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
          selected ? "bg-blue-500" : "border-2 border-gray-300 bg-white"
        )}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Icon */}
      {icon && <span className="text-lg">{icon}</span>}

      {/* Label */}
      <span
        className={cn(
          "font-medium text-sm",
          selected ? "text-blue-700" : "text-gray-700"
        )}
      >
        {label}
      </span>
    </button>
  );
};

export default AreaCheckboxCard;


