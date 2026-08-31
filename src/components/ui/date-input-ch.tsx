/**
 * Swiss-format date input (DD.MM.YYYY).
 * Internally stores ISO (YYYY-MM-DD); displays and accepts CH format.
 *
 * The parsing lives in `@/lib/dateInputCH` so it can be tested; that file also
 * explains why the validity check is stricter than it looks like it needs to be.
 */
import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { autoFormat, displayToIso, isoToDisplay } from "@/lib/dateInputCH";

interface DateInputCHProps {
  value: string;          // ISO: "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}

export const DateInputCH = forwardRef<HTMLInputElement, DateInputCHProps>(
  ({ value, onChange, id, className, placeholder = "TT.MM.JJJJ" }, ref) => {
    const [display, setDisplay] = useState(isoToDisplay(value));

    // Sync from outside (e.g. form reset / hydration)
    useEffect(() => {
      setDisplay(isoToDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // If user is deleting, allow freeform; otherwise auto-format
      const formatted = raw.length < display.length ? raw : autoFormat(raw);
      setDisplay(formatted);
      const iso = displayToIso(formatted);
      if (iso) onChange(iso);
      else if (formatted === "") onChange("");
    };

    const handleBlur = () => {
      const iso = displayToIso(display);
      if (iso) {
        setDisplay(isoToDisplay(iso)); // normalise
        onChange(iso);
      } else if (display !== "") {
        // Not a date anybody could have meant — revert to the last good value
        // instead of leaving a half-typed entry on screen that saves nothing.
        setDisplay(isoToDisplay(value));
      }
    };

    return (
      <Input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        maxLength={10}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn("h-9 sm:h-10 text-sm", className)}
      />
    );
  }
);
DateInputCH.displayName = "DateInputCH";
