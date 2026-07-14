import { useState } from "react";
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useT, useI18n } from "@/i18n/useI18n";
import { cn } from "@/lib/utils";

interface MobileCalendarNavProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "month" | "week" | "day" | "agenda";
  appointmentDates?: string[]; // Dates with appointments (YYYY-MM-DD format)
}

export function MobileCalendarNav({ 
  currentDate, 
  onDateChange, 
  view,
  appointmentDates = []
}: MobileCalendarNavProps) {
  const t = useT();
  const { dateLocale } = useI18n();
  const [open, setOpen] = useState(false);

  const navigateDate = (direction: "prev" | "next") => {
    if (view === "day") {
      onDateChange(direction === "prev" ? subDays(currentDate, 1) : addDays(currentDate, 1));
    } else if (view === "week") {
      onDateChange(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      // Month view
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + (direction === "prev" ? -1 : 1));
      onDateChange(newDate);
    }
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const handleSelectDate = (date: Date | undefined) => {
    if (date) {
      onDateChange(date);
      setOpen(false);
    }
  };

  // For week view, generate week days
  const weekDays = view === "week" ? Array.from({ length: 7 }).map((_, i) => 
    addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i)
  ) : [];

  // Check if a date has appointments
  const hasAppointments = (date: Date) => {
    return appointmentDates.includes(format(date, "yyyy-MM-dd"));
  };

  return (
    <div className="md:hidden">
      {/* Compact Navigation Bar */}
      <div className="flex items-center justify-between bg-card border rounded-lg p-2 mb-3 shadow-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate("prev")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs px-2"
            onClick={goToToday}
          >
            {t("calendar.today")}
          </Button>
          
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">
                  {view === "day"
                    ? format(currentDate, "d. MMM", { locale: dateLocale })
                    : view === "week"
                    ? t("calendar.mobile.week", { week: format(currentDate, "w", { locale: dateLocale }) })
                    : format(currentDate, "MMM yyyy", { locale: dateLocale })
                  }
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[70vh]">
              <SheetHeader>
                <SheetTitle>{t("calendar.mobile.selectDate")}</SheetTitle>
              </SheetHeader>
              <div className="flex justify-center py-4">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={handleSelectDate}
                  locale={dateLocale}
                  className="rounded-md border"
                  modifiers={{
                    hasAppointment: (date) => hasAppointments(date),
                  }}
                  modifiersStyles={{
                    hasAppointment: {
                      fontWeight: "bold",
                      textDecoration: "underline",
                      textDecorationColor: "hsl(var(--secondary))",
                    },
                  }}
                />
              </div>
              <div className="flex justify-center pb-4">
                <Button onClick={() => { onDateChange(new Date()); setOpen(false); }} variant="secondary">
                  {t("calendar.today")}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate("next")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Day Selector for Week View */}
      {view === "week" && (
        <div className="flex gap-1 mb-3 overflow-x-auto pb-2 -mx-2 px-2">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const hasAppts = hasAppointments(day);
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateChange(day)}
                className={cn(
                  "flex flex-col items-center min-w-[44px] py-2 px-2 rounded-lg transition-colors",
                  isSelected 
                    ? "bg-primary text-primary-foreground"
                    : isToday
                    ? "bg-secondary/20 text-secondary-foreground"
                    : "bg-muted/50 hover:bg-muted"
                )}
              >
                <span className="text-[10px] uppercase opacity-70">
                  {format(day, "EEE", { locale: dateLocale })}
                </span>
                <span className={cn(
                  "text-lg font-semibold",
                  hasAppts && !isSelected && "text-secondary"
                )}>
                  {format(day, "d")}
                </span>
                {hasAppts && (
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full mt-0.5",
                    isSelected ? "bg-primary-foreground" : "bg-secondary"
                  )} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Day View Date Header */}
      {view === "day" && (
        <div className="text-center mb-3">
          <div className="text-sm text-muted-foreground">
            {format(currentDate, "EEEE", { locale: dateLocale })}
          </div>
          <div className="text-2xl font-bold">
            {format(currentDate, "d. MMMM yyyy", { locale: dateLocale })}
          </div>
        </div>
      )}
    </div>
  );
}

