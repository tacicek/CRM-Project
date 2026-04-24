import { cn } from "@/lib/utils";
import { Purpose, purposeConfig } from "@/types/moebellift";

interface PurposeCardProps {
  purpose: Purpose;
  selected: boolean;
  onClick: () => void;
}

export function PurposeCard({ purpose, selected, onClick }: PurposeCardProps) {
  const config = purposeConfig[purpose];
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200",
        "hover:border-orange-300 hover:shadow-md",
        "min-h-[140px] w-full",
        selected
          ? "border-orange-500 bg-orange-50 shadow-md"
          : "border-gray-200 bg-white"
      )}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      
      {/* Icon */}
      <div className="text-4xl mb-3">
        {config.icon}
      </div>
      
      {/* Title */}
      <h3 className={cn(
        "font-semibold text-lg mb-1",
        selected ? "text-orange-700" : "text-gray-800"
      )}>
        {config.label}
      </h3>
      
      {/* Description */}
      <p className="text-sm text-gray-500 text-center">
        {config.description}
      </p>
    </button>
  );
}


