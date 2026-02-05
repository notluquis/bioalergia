import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/Button";

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
        <span className="text-default-500 text-sm">{weekData?.weekLabel ?? "Cargando..."}</span>
        <div className="flex items-center gap-2">
          <Button isIconOnly size="sm" variant="ghost" onClick={onPrevWeek}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button isIconOnly size="sm" variant="ghost" onClick={onNextWeek}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-default-100 bg-default-50/30 p-4">
      {/* Week header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button isIconOnly size="sm" variant="ghost" onClick={onPrevWeek}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-medium text-default-700 text-sm">
            SEM {weekData?.weekLabel ?? "..."}
          </span>
          <Button isIconOnly size="sm" variant="ghost" onClick={onNextWeek}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onGoToToday}>
            Hoy
          </Button>
        </div>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekData?.days.map((day) => (
          <DayCellButton
            day={day}
            isSelected={dayjs(day.date).isSame(currentDate, "day")}
            isToday={dayjs(day.date).isSame(today, "day")}
            key={day.date.toISOString()}
            onClick={() => {
              onSelectDate(day.date);
            }}
          />
        )) ??
          // Skeleton
          SKELETON_KEYS.map((key) => (
            <div className="h-16 animate-pulse rounded-xl bg-default-100/30" key={key} />
          ))}
      </div>
    </div>
  );
}

function DayCellButton({
  day,
  isSelected,
  isToday,
  onClick,
}: {
  day: DayCell;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  const statusColors = {
    balanced: "bg-success",
    draft: "bg-warning",
    empty: "bg-default-200",
    unbalanced: "bg-danger",
  };

  return (
    <button
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl p-2 transition-all",
        "hover:bg-default-50 focus:outline-none focus:ring-2 focus:ring-primary/20",
        isSelected && "bg-default-100 ring-2 ring-primary",
        isToday && !isSelected && "ring-1 ring-primary/30",
      )}
      onClick={onClick}
      type="button"
    >
      {/* Status dot */}
      <div className={cn("absolute top-2 right-2 size-2 rounded-full", statusColors[day.status])} />

      {/* Day name */}
      <span className="font-medium text-default-500 text-xs">{day.dayName}</span>

      {/* Amount */}
      <span
        className={cn(
          "mt-1 font-semibold text-sm tabular-nums",
          day.total === 0 ? "text-default-300" : "text-foreground",
        )}
      >
        {day.total === 0 ? "$0" : fmtCLP(day.total)}
      </span>
    </button>
  );
}
