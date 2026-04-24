/**
 * Swiss-format date input (DD.MM.YYYY).
 * Internally stores ISO (YYYY-MM-DD); displays and accepts CH format.
 */
import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateInputCHProps {
  value: string;          // ISO: "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}

/** "2026-04-29" → "29.04.2026" */
function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

/** "29.04.2026" → "2026-04-29" or "" if invalid */
function displayToIso(display: string): string {
  const clean = display.replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return "";
  const day = d.padStart(2, "0");
  const mon = m.padStart(2, "0");
  const iso = `${y}-${mon}-${day}`;
  // Basic validity check
  const date = new Date(`${y}-${mon}-${day}`);
  if (isNaN(date.getTime())) return "";
  return iso;
}

/** Auto-insert dots as user types: "2904" → "29.04." */
function autoFormat(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
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
        // Invalid — revert to last known good value
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
