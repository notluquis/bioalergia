import { Button, ButtonGroup } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo } from "react";

import { addDays, chileDay, civilNoon, formatChile, today as todayISO, weekday } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface DayNavigationProps {
  className?: string;
  onSelect: (date: Date) => void;
  /** Optional slot for content to render on the right side of the header */
  rightSlot?: ReactNode;
  /** Optional list of allowed weekdays (0=Sun ... 6=Sat) */
  allowedWeekdays?: number[];
  selectedDate: Date;
}

export function DayNavigation({
  className,
  allowedWeekdays,
  onSelect,
  rightSlot,
  selectedDate,
}: Readonly<DayNavigationProps>) {
  const current = useMemo(() => chileDay(selectedDate), [selectedDate]);
  const today = todayISO();
  const allowedSet = useMemo(
    () => (allowedWeekdays?.length ? new Set(allowedWeekdays) : null),
    [allowedWeekdays]
  );

  const isAllowed = useCallback(
    (date: string) => {
      if (!allowedSet) {
        return true;
      }
      return allowedSet.has(weekday(date));
    },
    [allowedSet]
  );

  const findAdjacentAllowed = useCallback(
    (date: string, direction: 1 | -1) => {
      let cursor = date;
      for (let i = 0; i < 7; i += 1) {
        cursor = addDays(cursor, direction);
        if (isAllowed(cursor)) {
          return cursor;
        }
      }
      return date;
    },
    [isAllowed]
  );

  const normalizeToAllowed = useCallback(
    (date: string) => {
      if (isAllowed(date)) {
        return date;
      }
      return findAdjacentAllowed(date, 1);
    },
    [findAdjacentAllowed, isAllowed]
  );

  // Generate range of dates (-4 to +4 around selected = 9 days)
  const days = Array.from({ length: 9 }, (_, i) => addDays(current, i - 4)).filter(isAllowed);

  const handlePrev = () => {
    onSelect(civilNoon(findAdjacentAllowed(current, -1)));
  };
  const handleNext = () => {
    onSelect(civilNoon(findAdjacentAllowed(current, 1)));
  };
  const handleToday = () => {
    onSelect(civilNoon(normalizeToAllowed(today)));
  };

  useEffect(() => {
    if (!isAllowed(current)) {
      const normalized = normalizeToAllowed(current);
      if (normalized !== current) {
        onSelect(civilNoon(normalized));
      }
    }
  }, [current, isAllowed, normalizeToAllowed, onSelect]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-lg capitalize sm:text-xl">
          {formatChile(current, "MMMM YYYY")}
        </h2>

        {/* Right side: optional slot + navigation buttons */}
        <div className="flex items-center gap-2">
          {rightSlot}
          <ButtonGroup className="shadow-sm" size="sm" variant="tertiary">
            <Button aria-label="Día anterior" isIconOnly onPress={handlePrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button className="font-semibold text-xs" onPress={handleToday}>
              Hoy
            </Button>
            <Button aria-label="Día siguiente" isIconOnly onPress={handleNext}>
              <ChevronRight className="size-4" />
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div className="relative">
        {/* Day Strip */}
        <div className="no-scrollbar flex min-h-16 touch-pan-x items-center justify-between overflow-x-auto rounded-xl border border-default-200 bg-content1 p-3 shadow-sm">
          {days.map((date) => {
            const isSelected = date === current;
            const isToday = date === today;

            return (
              <Button
                className={cn(
                  "relative mx-0.5 flex min-h-12 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 ",
                  isSelected
                    ? "z-10 scale-105 bg-primary font-semibold text-primary-foreground shadow-md"
                    : "text-foreground-500 hover:bg-default-100",
                  isToday && !isSelected && "bg-default-100 font-medium text-foreground"
                )}
                key={date}
                onPress={() => {
                  onSelect(civilNoon(date));
                }}
                size="sm"
                variant="outline"
              >
                {isToday && !isSelected && (
                  <span className="absolute top-1 right-1 rounded-full bg-primary size-1.5" />
                )}
                <span
                  className={cn(
                    "text-xs",
                    isSelected ? "text-primary-foreground/90" : "text-foreground-500"
                  )}
                >
                  {formatChile(date, "ddd").replace(/\.$/, "")}
                </span>
                <span
                  className={cn("text-lg tabular-nums leading-none", isSelected && "font-bold")}
                >
                  {formatChile(date, "D")}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
