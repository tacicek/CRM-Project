import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface KlaviertransportProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const stepLabels = [
  'Instrument',
  'Details',
  'Abholort',
  'Lieferort',
  'Anforderungen',
  'Services',
  'Kontakt',
  'Übersicht'
];

export function KlaviertransportProgressBar({ currentStep, totalSteps }: KlaviertransportProgressBarProps) {
  return (
    <div className="w-full py-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            {/* Step Circle */}
            <div className="relative flex items-center justify-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  step < currentStep
                    ? "bg-green-500 text-white"
                    : step === currentStep
                    ? "bg-blue-500 text-white ring-4 ring-blue-100 dark:ring-blue-900"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                )}
              >
                {step < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step
                )}
              </div>
              
              {/* Step Label - Hidden on mobile */}
              <span
                className={cn(
                  "absolute -bottom-6 text-xs whitespace-nowrap hidden md:block",
                  step === currentStep
                    ? "text-blue-600 dark:text-blue-400 font-medium"
                    : step < currentStep
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-400"
                )}
              >
                {stepLabels[step - 1]}
              </span>
            </div>
            
            {/* Connecting Line */}
            {step < totalSteps && (
              <div className="flex-1 mx-2">
                <div
                  className={cn(
                    "h-1 rounded-full transition-all",
                    step < currentStep
                      ? "bg-green-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Mobile Step Label */}
      <div className="md:hidden text-center mt-4 text-sm">
        <span className="text-gray-500">Schritt {currentStep} von {totalSteps}:</span>{' '}
        <span className="font-medium text-blue-600">{stepLabels[currentStep - 1]}</span>
      </div>
    </div>
  );
}


