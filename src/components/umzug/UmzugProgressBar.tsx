// UmzugProgressBar.tsx - 17-step progress indicator for Umzug wizard

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface UmzugProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

const STEP_GROUPS = [
  { name: 'Auszug', steps: [1, 2, 3, 4, 5, 6], color: 'blue' },
  { name: 'Einzug', steps: [7, 8, 9, 10, 11, 12], color: 'green' },
  { name: 'Details', steps: [13, 14, 15], color: 'purple' },
  { name: 'Kontakt', steps: [16, 17], color: 'orange' },
];

export const UmzugProgressBar = ({ 
  currentStep, 
  totalSteps = 17 
}: UmzugProgressBarProps) => {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
  
  // Find current group
  const currentGroup = STEP_GROUPS.find(g => g.steps.includes(currentStep)) || STEP_GROUPS[0];
  
  return (
    <div className="w-full space-y-4">
      {/* Main Progress Bar */}
      <div className="relative">
        {/* Track */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-green-500 to-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Step Indicators - Desktop */}
        <div className="hidden md:flex absolute -top-1 left-0 right-0 justify-between">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;
            const group = STEP_GROUPS.find(g => g.steps.includes(step));
            
            return (
              <div
                key={step}
                className={cn(
                  "w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center",
                  isCompleted && "bg-green-500 border-green-500",
                  isCurrent && cn(
                    "border-4 scale-125",
                    group?.color === 'blue' && "border-blue-500 bg-white",
                    group?.color === 'green' && "border-green-500 bg-white",
                    group?.color === 'purple' && "border-purple-500 bg-white",
                    group?.color === 'orange' && "border-orange-500 bg-white"
                  ),
                  !isCompleted && !isCurrent && "bg-white border-gray-300"
                )}
              >
                {isCompleted && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Step Groups - Mobile friendly */}
      <div className="flex justify-between">
        {STEP_GROUPS.map((group) => {
          const isActive = group.steps.includes(currentStep);
          const isCompleted = currentStep > Math.max(...group.steps);
          const firstStep = group.steps[0];
          const lastStep = group.steps[group.steps.length - 1];
          
          return (
            <div
              key={group.name}
              className={cn(
                "flex flex-col items-center transition-all duration-200",
                isActive && "scale-105"
              )}
            >
              <div className={cn(
                "text-xs font-medium mb-1",
                isActive && cn(
                  group.color === 'blue' && "text-blue-600",
                  group.color === 'green' && "text-green-600",
                  group.color === 'purple' && "text-purple-600",
                  group.color === 'orange' && "text-orange-600"
                ),
                isCompleted && "text-green-600",
                !isActive && !isCompleted && "text-gray-400"
              )}>
                {group.name}
              </div>
              <div className={cn(
                "text-xs",
                isActive ? "text-gray-600" : "text-gray-400"
              )}>
                {firstStep}-{lastStep}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Current Step Info */}
      <div className="text-center">
        <span className={cn(
          "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
          currentGroup.color === 'blue' && "bg-blue-100 text-blue-700",
          currentGroup.color === 'green' && "bg-green-100 text-green-700",
          currentGroup.color === 'purple' && "bg-purple-100 text-purple-700",
          currentGroup.color === 'orange' && "bg-orange-100 text-orange-700"
        )}>
          Schritt {currentStep} von {totalSteps}
        </span>
      </div>
    </div>
  );
};


