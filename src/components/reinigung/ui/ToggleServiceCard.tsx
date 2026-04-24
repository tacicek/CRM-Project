import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ToggleServiceCardProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  expandable?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function ToggleServiceCard({
  active,
  onToggle,
  icon,
  title,
  subtitle,
  expandable = false,
  disabled = false,
  className,
  children,
}: ToggleServiceCardProps) {
  const [isExpanded, setIsExpanded] = useState(active);

  const handleToggle = (checked: boolean) => {
    onToggle(checked);
    if (expandable) {
      setIsExpanded(checked);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 transition-all duration-200 overflow-hidden",
        active
          ? "border-amber-400 bg-amber-50/50 shadow-sm"
          : "border-gray-200 bg-white",
        disabled && "opacity-50",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between p-4",
          expandable && active && children && "cursor-pointer"
        )}
        onClick={() => {
          if (expandable && active && children) {
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                active ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500"
              )}
            >
              {icon}
            </div>
          )}
          <div>
            <h4 className="font-medium text-sm text-gray-900">{title}</h4>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={active}
            onCheckedChange={handleToggle}
            disabled={disabled}
            className="data-[state=checked]:bg-primary"
          />
          {expandable && active && children && (
            <ChevronDown
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expandable && active && children && isExpanded && (
        <div className="px-4 pb-4 border-t border-amber-200/50 pt-4">
          {children}
        </div>
      )}

      {/* Always visible children when not expandable */}
      {!expandable && active && children && (
        <div className="px-4 pb-4 border-t border-amber-200/50 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default ToggleServiceCard;


