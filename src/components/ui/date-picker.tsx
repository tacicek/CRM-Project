import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/useI18n";
import { cn } from "@/lib/utils";

/**
 * Locale-stable date field (Swiss DD.MM.YYYY display) replacing native <input type="date">,
 * whose display format follows the BROWSER locale (en-US users saw MM/DD/YYYY — ambiguous).
 *
 * Contract is identical to the native input it replaces: `value`/`onChange` speak ISO
 * "YYYY-MM-DD" (or "" for empty), so all existing form state and save logic is untouched —
 * only the visual representation changes.
 *
 * The DD.MM.YYYY *number* format stays fixed in all languages (Swiss convention); only the
 * month/weekday names in the calendar follow the locale. This primitive is also used on the
 * public pages, which render OUTSIDE the I18nProvider — `useI18n()` degrades to the German
 * translator there instead of throwing, so the component keeps working unchanged.
 */
export interface DatePickerProps {
  id?: string;
  value: string; // "YYYY-MM-DD" | ""
  onChange: (value: string) => void;
  min?: string; // "YYYY-MM-DD" — earliest selectable day
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/** Parse "YYYY-MM-DD" as a LOCAL date (avoids the UTC shift of new Date("YYYY-MM-DD")). */
const parseLocal = (iso: string): Date | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const toIso = (d: Date): string => format(d, "yyyy-MM-dd");

export const DatePicker = ({
  id,
  value,
  onChange,
  min,
  disabled,
  placeholder,
  className,
}: DatePickerProps) => {
  const { t, dateLocale } = useI18n();
  const selected = value ? parseLocal(value) : undefined;
  const minDate = min ? parseLocal(min) : undefined;
  const emptyLabel = placeholder ?? t("common.selectDate");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          {selected ? format(selected, "dd.MM.yyyy", { locale: dateLocale }) : emptyLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => onChange(d ? toIso(d) : "")}
          disabled={minDate ? { before: minDate } : undefined}
          locale={dateLocale}
          weekStartsOn={1}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};
