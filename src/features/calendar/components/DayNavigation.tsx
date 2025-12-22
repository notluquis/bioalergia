import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayNavigationProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  className?: string;
}

export function DayNavigation({ selectedDate, onSelect, className }: DayNavigationProps) {
  const current = dayjs(selectedDate);
  const today = dayjs();

  // Generate range of dates (-3 to +3 around selected)
  // Or maybe a wider range but fixed view?
  // Let's do a wider range to allow some scrolling, e.g. -14 to +14
  // But centering is key.

  // Actually, to make it simple and robust, let's just generate -4 to +4 (9 days)
  // and buttons to jump.
  const days = Array.from({ length: 9 }, (_, i) => {
    return current.add(i - 4, "day");
  });

  const handlePrev = () => onSelect(current.subtract(1, "day").format("YYYY-MM-DD"));
  const handleNext = () => onSelect(current.add(1, "day").format("YYYY-MM-DD"));
  const handleToday = () => onSelect(today.format("YYYY-MM-DD"));

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold capitalize">{current.format("MMMM YYYY")}</h2>
        <div className="bg-base-200 flex gap-1 rounded-lg p-1">
          <button
            onClick={handlePrev}
            className="hover:bg-base-100 text-base-content/70 hover:text-primary rounded-md p-1.5 transition-colors"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            onClick={handleToday}
            className="hover:bg-base-100 rounded-md px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors"
          >
            Hoy
          </button>

          <button
            onClick={handleNext}
            className="hover:bg-base-100 text-base-content/70 hover:text-primary rounded-md p-1.5 transition-colors"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
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
                key={date.toString()}
                onClick={() => onSelect(date.format("YYYY-MM-DD"))}
                className={cn(
                  "relative mx-0.5 flex min-w-[3.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 transition-all duration-200",
                  isSelected
                    ? "bg-primary text-primary-content z-10 scale-105 font-semibold shadow-md"
                    : "hover:bg-base-200/50 text-base-content/60",
                  isToday && !isSelected && "bg-base-200 text-base-content font-medium"
                )}
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
