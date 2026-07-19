/**
 * Swiss-format time input (24-hour HH:MM).
 * Text-based like DateInputCH — deliberately NOT native <input type="time">, whose
 * 12h/24h display follows the browser/OS locale (AM/PM on an English browser).
 * Switzerland uses 24-hour time; this input renders it consistently everywhere.
 * Internally stores and emits "HH:MM" (matches the DB `time` column / PDF slice).
 */
import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeDisplay, autoFormat, displayToValue } from "@/lib/timeInputCH";

interface TimeInputCHProps {
  value: string;          // "HH:MM" (24h) or ""
  onChange: (hhmm: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}

export const TimeInputCH = forwardRef<HTMLInputElement, TimeInputCHProps>(
  ({ value, onChange, id, className, placeholder = "08:00" }, ref) => {
    const [display, setDisplay] = useState(normalizeDisplay(value));

    // Sync from outside (e.g. form reset / hydration).
    useEffect(() => {
      setDisplay(normalizeDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // While deleting, keep freeform; otherwise auto-format.
      const formatted = raw.length < display.length ? raw : autoFormat(raw);
      setDisplay(formatted);
      const hhmm = displayToValue(formatted);
      if (hhmm) onChange(hhmm);
      else if (formatted === "") onChange("");
    };

    const handleBlur = () => {
      const hhmm = displayToValue(display);
      if (hhmm) {
        setDisplay(hhmm); // normalise ("8:5" → "08:05")
        onChange(hhmm);
      } else if (display !== "") {
        // Incomplete/invalid — revert to last known good value.
        setDisplay(normalizeDisplay(value));
      }
    };

    return (
      <Input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn("h-9 sm:h-10 text-sm", className)}
      />
    );
  }
);
TimeInputCH.displayName = "TimeInputCH";
