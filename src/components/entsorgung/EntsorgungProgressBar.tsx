import { cn } from "@/lib/utils";
import { Check, Trash2, Package, MapPin, Key, Wrench, Calendar, User, FileText } from "lucide-react";

interface EntsorgungProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const stepIcons = [
  Trash2,    // 1. Waste type
  Package,   // 2. Items & quantity
  MapPin,    // 3. Address
  Key,       // 4. Access
  Wrench,    // 5. Services
  Calendar,  // 6. Timing
  User,      // 7. Contact
  FileText,  // 8. Summary
];

const stepLabels = [
  "Abfallart",
  "Menge",
  "Adresse",
  "Zugang",
  "Leistungen",
  "Termin",
  "Kontakt",
  "Übersicht",
];

export const EntsorgungProgressBar = ({
  currentStep,
  totalSteps,
}: EntsorgungProgressBarProps) => {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="w-full">
      {/* Mobile: Simple progress bar */}
      <div className="md:hidden">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Schritt {currentStep} von {totalSteps}
          </span>
          <span className="text-sm text-gray-500">
            {stepLabels[currentStep - 1]}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Desktop: Step indicators */}
      <div className="hidden md:block">
        <div className="relative">
          {/* Progress line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step circles */}
          <div className="relative flex justify-between">
            {stepIcons.slice(0, totalSteps).map((Icon, index) => {
              const stepNumber = index + 1;
              const isCompleted = stepNumber < currentStep;
              const isCurrent = stepNumber === currentStep;

              return (
                <div
                  key={stepNumber}
                  className="flex flex-col items-center"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200",
                      isCompleted
                        ? "bg-green-600 border-green-600 text-white"
                        : isCurrent
                        ? "bg-white border-green-600 text-green-600 shadow-md"
                        : "bg-white border-gray-300 text-gray-400"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium text-center max-w-[80px]",
                      isCurrent ? "text-green-600" : "text-gray-500"
                    )}
                  >
                    {stepLabels[index]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntsorgungProgressBar;

