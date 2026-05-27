import { Check, Truck, Warehouse, Recycle, Home, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServiceType, serviceTypeLabels } from "@/types/klaviertransport";

// Icon mapping for service types
const SERVICE_ICONS: Record<ServiceType, LucideIcon> = {
  transport: Truck,
  storage: Warehouse,
  disposal: Recycle,
  internal_move: Home,
};

interface ServiceTypeCardProps {
  type: ServiceType;
  selected: boolean;
  onClick: () => void;
}

export function ServiceTypeCard({ type, selected, onClick }: ServiceTypeCardProps) {
  const info = serviceTypeLabels[type];
  const IconComponent = SERVICE_ICONS[type];
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative p-5 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-blue-300"
      )}
    >
      {/* Selected Indicator */}
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}
      
      {/* Icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
        selected 
          ? "bg-blue-500 text-white" 
          : "bg-gray-100 text-gray-600"
      )}>
        <IconComponent className="w-6 h-6" />
      </div>
      
      {/* Label */}
      <h4 className={cn(
        "font-semibold mb-1",
        selected ? "text-blue-700" : "text-gray-800"
      )}>
        {info.label}
      </h4>
      
      {/* Description */}
      <p className="text-sm text-gray-500">
        {info.description}
      </p>
    </button>
  );
}
