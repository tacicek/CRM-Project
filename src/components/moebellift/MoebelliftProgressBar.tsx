import { cn } from "@/lib/utils";

interface MoebelliftProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const stepLabels = [
  'Service',
  'Ort',
  'Vor Ort',
  'Transport',
  'Termin',
  'Kontakt',
  'Übersicht'
];

export function MoebelliftProgressBar({ currentStep, totalSteps }: MoebelliftProgressBarProps) {
  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between relative">
          {/* Progress line background */}
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200" />
          
          {/* Progress line filled */}
          <div 
            className="absolute left-0 top-4 h-0.5 bg-orange-500 transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          />
          
          {/* Steps */}
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <div key={step} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200",
                  step < currentStep
                    ? "bg-orange-500 text-white"
                    : step === currentStep
                    ? "bg-orange-500 text-white ring-4 ring-orange-100"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {step < currentStep ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium",
                  step === currentStep ? "text-orange-600" : "text-gray-500"
                )}
              >
                {stepLabels[step - 1]}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Mobile view */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-orange-600">
            Schritt {currentStep} von {totalSteps}
          </span>
          <span className="text-sm text-gray-500">
            {stepLabels[currentStep - 1]}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}


