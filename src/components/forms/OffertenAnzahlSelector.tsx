import { cn } from "@/lib/utils";
import { CheckCircle2, Star, Crown, Zap } from "lucide-react";

interface OffertenAnzahlOption {
  value: number;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  highlight?: boolean;
}

const OPTIONS: OffertenAnzahlOption[] = [
  {
    value: 1,
    label: "1 Offerte",
    description: "Exklusiv - Sie erhalten eine Premium-Offerte",
    icon: Crown,
    badge: "Exklusiv",
  },
  {
    value: 3,
    label: "3 Offerten",
    description: "Vergleichen Sie Angebote von 3 Firmen",
    icon: Star,
    badge: "Empfohlen",
    highlight: true,
  },
  {
    value: 5,
    label: "5 Offerten",
    description: "Maximale Auswahl aus 5 verschiedenen Angeboten",
    icon: Zap,
  },
];

interface OffertenAnzahlSelectorProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function OffertenAnzahlSelector({
  value,
  onChange,
  className,
}: OffertenAnzahlSelectorProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Wie viele Offerten möchten Sie erhalten?
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Mehr Offerten = mehr Vergleichsmöglichkeiten
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {OPTIONS.map((option) => {
          const isSelected = value === option.value;
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "relative p-5 rounded-xl border-2 text-center transition-all duration-200 hover:shadow-lg group",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50",
                option.highlight && !isSelected && "ring-2 ring-primary/20"
              )}
            >
              {/* Badge */}
              {option.badge && (
                <div
                  className={cn(
                    "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-medium rounded-full",
                    isSelected
                      ? "bg-primary text-white"
                      : option.highlight
                      ? "bg-primary/10 text-primary"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  )}
                >
                  {option.badge}
                </div>
              )}

              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  "w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center transition-colors",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:text-primary"
                )}
              >
                <Icon className="w-6 h-6" />
              </div>

              {/* Label */}
              <div
                className={cn(
                  "font-semibold text-lg mb-1",
                  isSelected
                    ? "text-primary"
                    : "text-gray-800 dark:text-gray-200"
                )}
              >
                {option.label}
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        100% kostenlos und unverbindlich für Sie
      </p>
    </div>
  );
}

export default OffertenAnzahlSelector;



