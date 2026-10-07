import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2 sm:p-4", className)}
      classNames={{
        months:
          "flex flex-col sm:flex-row gap-4",

        month:
          "w-full sm:w-auto space-y-3 rounded-2xl border border-border bg-background shadow-sm p-3 sm:p-5",

        caption:
          "flex items-center justify-between px-1 mb-2",

        caption_label:
          "text-sm sm:text-base font-semibold tracking-tight",

        nav:
          "flex items-center gap-1 sm:gap-2",

        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 sm:h-8 sm:w-8 bg-transparent p-0 rounded-full opacity-60 hover:opacity-100 hover:bg-muted transition-all duration-150"
        ),

        nav_button_previous: "static",
        nav_button_next: "static",

        // ✅ KEY FIX: use "flex w-full" instead of grid
        // react-day-picker renders <tr> elements; grid on <tr> doesn't work.
        // flex + flex-1 on children gives equal 7-column layout correctly.
        table:
          "w-full border-collapse",

        head_row:
          "flex w-full mb-1",

        head_cell:
          "flex-1 text-muted-foreground text-center text-[0.6rem] sm:text-[0.65rem] uppercase tracking-widest font-medium py-1",

        row:
          "flex w-full mt-1",

        cell: cn(
          "flex-1 relative p-0 text-center text-xs sm:text-sm focus-within:relative focus-within:z-20",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-full [&:has(>.day-range-start)]:rounded-full"
            : ""
        ),

        day: cn(
          buttonVariants({ variant: "ghost" }),
          "mx-auto h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 text-xs sm:text-sm font-medium",
          "aria-selected:opacity-100",
          "hover:bg-muted hover:scale-105 transition-all duration-100"
        ),

        day_range_start: "day-range-start rounded-full",
        day_range_end: "day-range-end rounded-full",

        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-sm",

        day_today:
          "ring-2 ring-primary ring-offset-2 ring-offset-background font-semibold",

        day_outside:
          "day-outside text-muted-foreground/40 aria-selected:bg-accent/30 aria-selected:text-muted-foreground",

        day_disabled:
          "text-muted-foreground/30 cursor-not-allowed",

        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground rounded-none",

        day_hidden: "invisible",

        ...classNames,
      }}
      components={{
        IconLeft: ({ className: iconClass, ...iconProps }) => (
          <ChevronLeft
            className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", iconClass)}
            {...iconProps}
          />
        ),
        IconRight: ({ className: iconClass, ...iconProps }) => (
          <ChevronRight
            className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", iconClass)}
            {...iconProps}
          />
        ),
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }