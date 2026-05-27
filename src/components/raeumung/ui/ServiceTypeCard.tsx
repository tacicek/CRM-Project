// ServiceTypeCard.tsx - Card for selecting service type in Räumung wizard
// Updated to match Umzug PropertyTypeSelector style

import { cn } from "@/lib/utils";
import {
  Check,
  Info,
  Home,
  Building2,
  Package,
  Trash2,
  Heart,
  FileText,
  AlertTriangle,
  Scale,
  DoorOpen,
  Warehouse,
  Car,
  Briefcase,
  Factory,
  Archive,
  LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RaeumungsArt } from "@/types/raeumung";

// Icon mapping for service types
const SERVICE_ICONS: Record<RaeumungsArt, LucideIcon> = {
  household_dissolution: Home,
  apartment_clearance: Building2,
  house_clearance: Home,
  decluttering: Trash2,
  death_clearance: Heart,
  estate_clearance: FileText,
  hoarder_clearance: AlertTriangle,
  forced_eviction: Scale,
  cellar_clearance: DoorOpen,
  attic_clearance: Archive,
  garage_clearance: Car,
  office_clearance: Briefcase,
  company_dissolution: Factory,
  storage_clearance: Warehouse,
};

interface ServiceTypeCardProps {
  serviceType?: RaeumungsArt;
  icon?: string; // Legacy emoji icon support
  label: string;
  description?: string;
  sensitive?: boolean;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const ServiceTypeCard = ({
  serviceType,
  icon: _icon,
  label,
  description,
  sensitive,
  selected,
  onClick,
  disabled,
}: ServiceTypeCardProps) => {
  // Get the Lucide icon component
  const IconComponent = serviceType ? SERVICE_ICONS[serviceType] : Package;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-start p-5 rounded-xl border-2 transition-all duration-200 text-left w-full min-h-[140px]",
        "hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-blue-300",
        disabled && "opacity-50 cursor-not-allowed",
        sensitive && !selected && "border-amber-200 bg-amber-50/30"
      )}
    >
      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Sensitive indicator */}
      {sensitive && !selected && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute top-3 right-3">
                <Info className="w-4 h-4 text-amber-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">Sensible Anfrage - Diskrete Behandlung garantiert</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
        selected 
          ? "bg-blue-500 text-white" 
          : sensitive 
            ? "bg-amber-100 text-amber-600"
            : "bg-gray-100 text-gray-600"
      )}>
        <IconComponent className="w-6 h-6" />
      </div>

      {/* Label */}
      <h4 className={cn(
        "font-semibold mb-1",
        selected 
          ? "text-blue-700" 
          : "text-gray-800"
      )}>
        {label}
      </h4>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-500">
          {description}
        </p>
      )}
    </button>
  );
};

export default ServiceTypeCard;
