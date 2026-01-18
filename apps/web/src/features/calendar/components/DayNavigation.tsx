import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DayNavigationProps {
  className?: string;
  onSelect: (date: string) => void;
  /** Optional slot for content to render on the right side of the header */
  rightSlot?: ReactNode;
  selectedDate: string;
}

export function DayNavigation({ className, onSelect, rightSlot, selectedDate }: DayNavigationProps) {
  const current = dayjs(selectedDate);
  const today = dayjs();

  // Generate range of dates (-4 to +4 around selected = 9 days)
  const days = Array.from({ length: 9 }, (_, i) => {
    return current.add(i - 4, "day");
  });

  const handlePrev = () => {
    onSelect(current.subtract(1, "day").format("YYYY-MM-DD"));
  };
  const handleNext = () => {
    onSelect(current.add(1, "day").format("YYYY-MM-DD"));
  };
  const handleToday = () => {
    onSelect(today.format("YYYY-MM-DD"));
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold capitalize sm:text-xl">{current.format("MMMM YYYY")}</h2>

        {/* Right side: optional slot + navigation buttons */}
        <div className="flex items-center gap-2">
          {rightSlot}
          <div className="bg-base-200 flex gap-0.5 rounded-lg p-1">
            <button
              aria-label="Día anterior"
              className="hover:bg-base-100 text-base-content/70 hover:text-primary rounded-md p-1.5 transition-colors"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              className="hover:bg-base-100 rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors"
              onClick={handleToday}
            >
              Hoy
            </button>

            <button
              aria-label="Día siguiente"
              className="hover:bg-base-100 text-base-content/70 hover:text-primary rounded-md p-1.5 transition-colors"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Day Strip */}
        <div className="bg-base-100 border-base-200 no-scrollbar flex items-center justify-between overflow-x-auto rounded-xl border p-1 shadow-sm">
          {days.map((date) => {
            const isSelected = date.isSame(current, "day");
            const isToday = date.isSame(today, "day");

            return (
              <button
                className={cn(
                  "relative mx-0.5 flex min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 transition-all duration-200",
                  isSelected
                    ? "bg-primary text-primary-content z-10 scale-105 font-semibold shadow-md"
                    : "hover:bg-base-200/50 text-base-content/60",
                  isToday && !isSelected && "bg-base-200 text-base-content font-medium"
                )}
                key={date.toString()}
                onClick={() => {
                  onSelect(date.format("YYYY-MM-DD"));
                }}
              >
                {isToday && !isSelected && (
                  <span className="bg-primary absolute top-1 right-1 h-1.5 w-1.5 rounded-full" />
                )}
                <span
                  className={cn(
                    "text-[10px] tracking-wider uppercase",
                    isSelected ? "text-primary-content/80" : "text-base-content/50"
                  )}
                >
                  {date.format("ddd")}
                </span>
                <span className={cn("text-lg leading-none tabular-nums", isSelected && "font-bold")}>
                  {date.format("D")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
