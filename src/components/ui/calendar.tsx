import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 max-w-[320px] mx-auto", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-2",
        caption: "flex justify-between items-center px-1 pb-1.5 border-b border-indigo-100",
        caption_label: "text-sm font-bold text-gray-900",
        nav: "flex items-center gap-1",
        nav_button: cn(
          "h-7 w-7 rounded-md border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all",
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full border-collapse",
        head_row: "flex w-full mt-2",
        head_cell: "flex-1 text-center text-[10px] font-bold text-indigo-400 uppercase tracking-wider",
        row: "flex w-full mt-0.5",
        cell: "flex-1 text-center p-[1px] relative focus-within:relative focus-within:z-20",
        day: cn(
          "h-9 w-full flex items-center justify-center rounded-md text-[13px] font-medium transition-all cursor-pointer",
          "text-gray-700 hover:bg-indigo-50 hover:text-indigo-700",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "!bg-indigo-600 !text-white font-bold hover:!bg-indigo-700 hover:!text-white shadow-[0_2px_8px_rgba(79,70,229,0.4)]",
        day_today: "bg-indigo-100 text-indigo-700 font-bold ring-1 ring-indigo-300",
        day_outside:
          "day-outside text-gray-300 hover:bg-transparent hover:text-gray-300 cursor-default",
        day_disabled: "text-gray-200 cursor-not-allowed hover:bg-transparent hover:text-gray-200",
        day_range_middle: "aria-selected:bg-indigo-100 aria-selected:text-indigo-700",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-3.5 w-3.5" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-3.5 w-3.5" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
