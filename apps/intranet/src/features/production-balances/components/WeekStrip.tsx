import { Button, Skeleton } from "@heroui/react";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { fmtCLP } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DayCell, WeekData } from "../types";

const SKELETON_KEYS = Array.from({ length: 7 }, (_, index) => `skeleton-${index}`);

interface WeekStripProps {
  currentDate: Date;
  isCollapsed?: boolean;
  onGoToToday: () => void;
  onNextWeek: () => void;
  onPrevWeek: () => void;
  onSelectDate: (date: Date) => void;
  weekData: null | WeekData;
}

/**
 * Week navigation strip showing L-D with amounts and status dots
 */
export function WeekStrip({
  currentDate,
  isCollapsed = false,
  onGoToToday,
  onNextWeek,
  onPrevWeek,
  onSelectDate,
  weekData,
}: WeekStripProps) {
  const today = useMemo(() => new Date(), []);

  if (isCollapsed) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-default-100 bg-default-50/30 px-4 py-2">
        {weekData?.weekLabel ? (
          <span className="text-default-500 text-sm">{weekData.weekLabel}</span>
        ) : (
          <Skeleton className="h-4 w-24 rounded-lg" />
        )}
        <div className="flex items-center gap-2">
          <Button isIconOnly size="sm" variant="outline" onPress={onPrevWeek}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button isIconOnly size="sm" variant="outline" onPress={onNextWeek}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-[28px] border border-default-100 bg-default-50/30 p-3 md:p-4">
      {/* Week header */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Button isIconOnly size="sm" variant="outline" onPress={onPrevWeek}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-medium text-default-700 text-sm">
            SEM {weekData?.weekLabel ?? "..."}
          </span>
          <Button isIconOnly size="sm" variant="outline" onPress={onNextWeek}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button className="w-full sm:w-auto" variant="outline" size="sm" onPress={onGoToToday}>
            Hoy
          </Button>
        </div>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {weekData?.days.map((day) => (
          <DayCellButton
            day={day}
            isSelected={dayjs(day.date).isSame(currentDate, "day")}
            isToday={dayjs(day.date).isSame(today, "day")}
            key={day.date.toISOString()}
            onPress={() => {
              onSelectDate(day.date);
            }}
          />
        )) ??
          // Skeleton
          SKELETON_KEYS.map((key) => (
            <div className="h-16 rounded-xl bg-default-100/30" key={key} />
          ))}
      </div>
    </div>
  );
}

function DayCellButton({
  day,
  isSelected,
  isToday,
  onPress,
}: {
  day: DayCell;
  isSelected: boolean;
  isToday: boolean;
  onPress: () => void;
}) {
  const statusColors = {
    balanced: "bg-success",
    draft: "bg-warning",
    empty: "bg-default-200",
    unbalanced: "bg-danger",
  };

  return (
    <Button
      className={cn(
        "relative h-18! min-w-0 flex-col items-center justify-center rounded-xl p-1.5 md:h-19! md:p-2",
        "hover:bg-default-50",
        isSelected && "bg-primary/10 ring-1 ring-primary/60",
        isToday && !isSelected && "ring-1 ring-primary/30"
      )}
      fullWidth
      onPress={onPress}
      type="button"
      variant="outline"
    >
      {/* Status dot */}
      <div className={cn("absolute top-2 right-2 size-2 rounded-full", statusColors[day.status])} />

      {/* Day name */}
      <span className={cn("font-medium text-xs", isSelected ? "text-primary" : "text-default-500")}>
        {day.dayName}
      </span>

      {/* Amount */}
      <span
        className={cn(
          "mt-1 font-semibold text-sm leading-none tabular-nums",
          day.total === 0
            ? isSelected
              ? "text-primary/70"
              : "text-default-300"
            : isSelected
              ? "text-primary"
              : "text-foreground"
        )}
      >
        {day.total === 0 ? "$0" : fmtCLP(day.total)}
      </span>
    </Button>
  );
}
