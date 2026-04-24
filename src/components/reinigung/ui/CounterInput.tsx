import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CounterInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}

export function CounterInput({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  icon,
  description,
  className,
}: CounterInputProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <div>
            <span className="font-medium text-sm">{label}</span>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full",
              value <= min && "opacity-50 cursor-not-allowed"
            )}
            onClick={handleDecrement}
            disabled={value <= min}
          >
            <Minus className="h-4 w-4 text-primary" />
          </Button>
          
          <div className="w-12 text-center">
            <span className="font-semibold text-lg">{value}</span>
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full",
              value >= max && "opacity-50 cursor-not-allowed"
            )}
            onClick={handleIncrement}
            disabled={value >= max}
          >
            <Plus className="h-4 w-4 text-primary" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CounterInput;


