import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // group so children can react to data-state via group-data-[state=...]
      "group peer relative inline-flex h-7 w-[3.25rem] shrink-0 cursor-pointer",
      "items-center rounded-full border-2 border-transparent overflow-hidden",
      "transition-colors",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    {/* "Ja" — left side, visible when checked */}
    <span
      aria-hidden
      className="absolute left-1 text-[9px] font-bold leading-none text-primary-foreground select-none pointer-events-none transition-opacity opacity-0 group-data-[state=checked]:opacity-100"
    >
      Ja
    </span>

    {/* "Nein" — right side, visible when unchecked */}
    <span
      aria-hidden
      className="absolute right-1 text-[9px] font-bold leading-none text-muted-foreground select-none pointer-events-none transition-opacity opacity-100 group-data-[state=checked]:opacity-0"
    >
      Nein
    </span>

    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none relative z-10 block h-5 w-5 rounded-full bg-background shadow-md ring-0",
        "transition-transform",
        "data-[state=checked]:translate-x-[1.625rem]",
        "data-[state=unchecked]:translate-x-0.5",
      )}
    />
  </SwitchPrimitives.Root>
));

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
