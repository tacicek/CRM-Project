import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectableCardProps {
  selected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  type?: "checkbox" | "radio";
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function SelectableCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  type = "checkbox",
  disabled = false,
  className,
  children,
}: SelectableCardProps) {
  return (
    <div
      onClick={() => !disabled && onSelect()}
      className={cn(
        "relative rounded-xl border-2 p-4 cursor-pointer transition-all duration-200",
        "hover:border-primary/50 hover:shadow-sm",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-gray-200 bg-white",
        disabled && "opacity-50 cursor-not-allowed hover:border-gray-200",
        className
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all",
          type === "radio" ? "rounded-full" : "rounded-md",
          selected
            ? "bg-primary text-white"
            : "border-2 border-gray-300 bg-white"
        )}
      >
        {selected && <Check className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className="flex items-start gap-3 pr-8">
        {icon && (
          <div
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
              selected ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-600"
            )}
          >
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900">{title}</h4>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {/* Expanded content when selected */}
      {selected && children && (
        <div 
          className="mt-4 pt-4 border-t border-primary/20"
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside children from toggling the card
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Compact version for grid layouts
export function SelectableCardCompact({
  selected,
  onSelect,
  icon,
  title,
  disabled = false,
  className,
}: Omit<SelectableCardProps, "description" | "type" | "children">) {
  return (
    <div
      onClick={() => !disabled && onSelect()}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all duration-200",
        "hover:border-primary/50 hover:shadow-sm min-h-[100px]",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-gray-200 bg-white",
        disabled && "opacity-50 cursor-not-allowed hover:border-gray-200",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            selected ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-600"
          )}
        >
          {icon}
        </div>
      )}
      <span
        className={cn(
          "font-medium text-sm text-center",
          selected ? "text-primary" : "text-gray-700"
        )}
      >
        {title}
      </span>
    </div>
  );
}

export default SelectableCard;


