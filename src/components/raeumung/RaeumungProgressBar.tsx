// RaeumungProgressBar.tsx - Progress indicator for Räumung wizard

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  number: number;
  label: string;
  shortLabel?: string;
}

const defaultSteps: Step[] = [
  { number: 1, label: "Räumungsart", shortLabel: "Art" },
  { number: 2, label: "Objekt", shortLabel: "Objekt" },
  { number: 3, label: "Adresse", shortLabel: "Adresse" },
  { number: 4, label: "Zugang", shortLabel: "Zugang" },
  { number: 5, label: "Umfang", shortLabel: "Umfang" },
  { number: 6, label: "Zustand", shortLabel: "Zustand" },
  { number: 7, label: "Services", shortLabel: "Services" },
  { number: 8, label: "Termin", shortLabel: "Termin" },
  { number: 9, label: "Kontakt", shortLabel: "Kontakt" },
  { number: 10, label: "Übersicht", shortLabel: "Senden" },
];

interface RaeumungProgressBarProps {
  currentStep: number;
  totalSteps?: number;
  showConditionStep?: boolean; // Some services skip condition step
}

export const RaeumungProgressBar = ({
  currentStep,
  totalSteps = 10,
  showConditionStep = true,
}: RaeumungProgressBarProps) => {
  // Filter steps if condition step is not shown
  const steps = showConditionStep
    ? defaultSteps
    : defaultSteps.filter((s) => s.number !== 6);

  // Adjust step numbers if condition step is skipped
  const adjustedSteps = showConditionStep
    ? steps
    : steps.map((s, idx) => ({ ...s, number: idx + 1 }));

  const adjustedTotalSteps = showConditionStep ? totalSteps : totalSteps - 1;
  const adjustedCurrentStep = !showConditionStep && currentStep > 5 ? currentStep - 1 : currentStep;

  return (
    <div className="w-full">
      {/* Desktop: Full progress bar */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between relative">
          {/* Background line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
          
          {/* Progress line */}
          <div
            className="absolute top-5 left-0 h-0.5 bg-blue-500 transition-all duration-500"
            style={{
              width: `${((adjustedCurrentStep - 1) / (adjustedTotalSteps - 1)) * 100}%`,
            }}
          />

          {/* Steps */}
          {adjustedSteps.map((step) => {
            const isCompleted = adjustedCurrentStep > step.number;
            const isCurrent = adjustedCurrentStep === step.number;

            return (
              <div
                key={step.number}
                className="relative flex flex-col items-center z-10"
                style={{ width: `${100 / adjustedTotalSteps}%` }}
              >
                {/* Circle */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300",
                    isCompleted
                      ? "bg-blue-500 text-white"
                      : isCurrent
                      ? "bg-blue-500 text-white ring-4 ring-blue-100"
                      : "bg-white border-2 border-gray-300 text-gray-400"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "mt-2 text-xs text-center transition-colors",
                    isCurrent ? "text-blue-600 font-medium" : "text-gray-500"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: Simplified progress */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Schritt {adjustedCurrentStep} von {adjustedTotalSteps}
          </span>
          <span className="text-sm text-blue-600 font-medium">
            {adjustedSteps.find((s) => s.number === adjustedCurrentStep)?.label}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{
              width: `${(adjustedCurrentStep / adjustedTotalSteps) * 100}%`,
            }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-between mt-2">
          {adjustedSteps.map((step) => (
            <div
              key={step.number}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                adjustedCurrentStep >= step.number ? "bg-blue-500" : "bg-gray-300"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RaeumungProgressBar;


