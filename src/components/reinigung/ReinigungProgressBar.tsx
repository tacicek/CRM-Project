import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReinigungProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

const DEFAULT_LABELS = [
  "Unterkunft",
  "Räume",
  "Besonderheiten",
  "Badezimmer",
  "Fenster",
  "Storen",
  "Extras",
  "Kontakt",
];

export function ReinigungProgressBar({
  currentStep,
  totalSteps,
  stepLabels = DEFAULT_LABELS,
}: ReinigungProgressBarProps) {
  return (
    <div className="w-full">
      {/* Desktop version with labels */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Progress line background */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200" />
        
        {/* Progress line filled */}
        <div
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-300"
          style={{
            width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
          }}
        />

        {/* Steps */}
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const isPending = step > currentStep;

          return (
            <div
              key={step}
              className="flex flex-col items-center relative z-10"
            >
              {/* Step circle */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-all",
                  isCompleted && "bg-primary text-white",
                  isCurrent && "bg-primary text-white ring-4 ring-primary/20",
                  isPending && "bg-gray-200 text-gray-500"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step
                )}
              </div>

              {/* Step label */}
              <span
                className={cn(
                  "mt-2 text-xs font-medium transition-colors",
                  isCurrent && "text-primary",
                  isCompleted && "text-gray-600",
                  isPending && "text-gray-400"
                )}
              >
                {stepLabels[step - 1]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile version - compact */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary">
            Schritt {currentStep} von {totalSteps}
          </span>
          <span className="text-sm text-gray-500">
            {stepLabels[currentStep - 1]}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{
              width: `${(currentStep / totalSteps) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default ReinigungProgressBar;


