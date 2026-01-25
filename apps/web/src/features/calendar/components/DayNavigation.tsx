import { Button, ButtonGroup } from "@heroui/react";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";

interface DayNavigationProps {
  className?: string;
  onSelect: (date: string) => void;
  /** Optional slot for content to render on the right side of the header */
  rightSlot?: ReactNode;
  /** Optional list of allowed weekdays (dayjs day indices: 0=Sun ... 6=Sat) */
  allowedWeekdays?: number[];
  selectedDate: string;
}

export function DayNavigation({
  className,
  allowedWeekdays,
  onSelect,
  rightSlot,
  selectedDate,
}: Readonly<DayNavigationProps>) {
  const current = useMemo(() => dayjs(selectedDate), [selectedDate]);
  const today = dayjs();
  const allowedSet = useMemo(
    () => (allowedWeekdays?.length ? new Set(allowedWeekdays) : null),
    [allowedWeekdays],
  );

  const isAllowed = useCallback(
    (date: dayjs.Dayjs) => {
      if (!allowedSet) return true;
      return allowedSet.has(date.day());
    },
    [allowedSet],
  );

  const findAdjacentAllowed = useCallback(
    (date: dayjs.Dayjs, direction: 1 | -1) => {
      let cursor = date;
      for (let i = 0; i < 7; i += 1) {
        cursor = cursor.add(direction, "day");
        if (isAllowed(cursor)) {
          return cursor;
        }
      }
      return date;
    },
    [isAllowed],
  );

  const normalizeToAllowed = useCallback(
    (date: dayjs.Dayjs) => {
      if (isAllowed(date)) return date;
      return findAdjacentAllowed(date, 1);
    },
    [findAdjacentAllowed, isAllowed],
  );

  // Generate range of dates (-4 to +4 around selected = 9 days)
  const days = Array.from({ length: 9 }, (_, i) => current.add(i - 4, "day")).filter(isAllowed);

  const handlePrev = () => {
    onSelect(findAdjacentAllowed(current, -1).format("YYYY-MM-DD"));
  };
  const handleNext = () => {
    onSelect(findAdjacentAllowed(current, 1).format("YYYY-MM-DD"));
  };
  const handleToday = () => {
    onSelect(normalizeToAllowed(today).format("YYYY-MM-DD"));
  };

  useEffect(() => {
    if (!isAllowed(current)) {
      const normalized = normalizeToAllowed(current);
      if (!normalized.isSame(current, "day")) {
        onSelect(normalized.format("YYYY-MM-DD"));
      }
    }
  }, [current, isAllowed, normalizeToAllowed, onSelect]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold capitalize sm:text-xl">{current.format("MMMM YYYY")}</h2>

        {/* Right side: optional slot + navigation buttons */}
        <div className="flex items-center gap-2">
          {rightSlot}
          <ButtonGroup size="sm" variant="tertiary">
            <Button aria-label="Día anterior" isIconOnly onPress={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button className="text-xs font-semibold uppercase" onPress={handleToday}>
              Hoy
            </Button>
            <Button aria-label="Día siguiente" isIconOnly onPress={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div className="relative">
        {/* Day Strip */}
        <div className="bg-content1 border-default-200 no-scrollbar flex min-h-16 items-center justify-between overflow-x-auto rounded-xl border p-2 shadow-sm touch-pan-x">
          {days.map((date) => {
            const isSelected = date.isSame(current, "day");
            const isToday = date.isSame(today, "day");

            return (
              <Button
                className={cn(
                  "relative mx-0.5 flex min-h-12 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 transition-all duration-200",
                  isSelected
                    ? "bg-primary text-primary-foreground z-10 scale-105 font-semibold shadow-md"
                    : "hover:bg-default-100 text-foreground-500",
                  isToday && !isSelected && "bg-default-100 text-foreground font-medium",
                )}
                key={date.toString()}
                onPress={() => {
                  onSelect(date.format("YYYY-MM-DD"));
                }}
                size="sm"
                variant="ghost"
              >
                {isToday && !isSelected && (
                  <span className="bg-primary absolute top-1 right-1 h-1.5 w-1.5 rounded-full" />
                )}
                <span
                  className={cn(
                    "text-[10px] tracking-wider uppercase",
                    isSelected ? "text-primary-foreground/90" : "text-foreground-500",
                  )}
                >
                  {date.format("ddd")}
                </span>
                <span
                  className={cn("text-lg leading-none tabular-nums", isSelected && "font-bold")}
                >
                  {date.format("D")}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
