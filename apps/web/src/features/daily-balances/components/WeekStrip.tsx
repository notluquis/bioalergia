import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { fmtCLP } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DayCell, WeekData } from "../types";

interface WeekStripProps {
  currentDate: string;
  weekData: WeekData | null;
  onSelectDate: (date: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  isCollapsed?: boolean;
}

/**
 * Week navigation strip showing L-D with amounts and status dots
 */
export function WeekStrip({
  currentDate,
  weekData,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
  isCollapsed = false,
}: WeekStripProps) {
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  if (isCollapsed) {
    return (
      <div className="bg-base-200/30 border-base-content/5 mb-4 flex items-center justify-between rounded-2xl border px-4 py-2">
        <span className="text-base-content/60 text-sm">{weekData?.weekLabel ?? "Cargando..."}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevWeek} className="btn btn-ghost btn-xs btn-square">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={onNextWeek} className="btn btn-ghost btn-xs btn-square">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base-200/30 border-base-content/5 mb-4 rounded-2xl border p-4">
      {/* Week header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevWeek} className="btn btn-ghost btn-xs btn-square">
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-base-content/80 text-sm font-medium">SEM {weekData?.weekLabel ?? "..."}</span>
          <button type="button" onClick={onNextWeek} className="btn btn-ghost btn-xs btn-square">
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onGoToToday} className="btn btn-outline btn-xs">
            Hoy
          </button>
        </div>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekData?.days.map((day) => (
          <DayCellButton
            key={day.date}
            day={day}
            isSelected={day.date === currentDate}
            isToday={day.date === today}
            onClick={() => onSelectDate(day.date)}
          />
        )) ??
          // Skeleton
          Array.from({ length: 7 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="bg-base-300/30 h-16 animate-pulse rounded-xl" />
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
    empty: "bg-base-content/20",
    draft: "bg-warning",
    balanced: "bg-success",
    unbalanced: "bg-error",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl p-2 transition-all",
        "hover:bg-base-content/5 focus:ring-primary/20 focus:ring-2 focus:outline-none",
        isSelected && "bg-base-content/10 ring-primary ring-2",
        isToday && !isSelected && "ring-primary/30 ring-1"
      )}
    >
      {/* Status dot */}
      <div className={cn("absolute top-2 right-2 size-2 rounded-full", statusColors[day.status])} />

      {/* Day name */}
      <span className="text-base-content/60 text-xs font-medium">{day.dayName}</span>

      {/* Amount */}
      <span
        className={cn(
          "mt-1 text-sm font-semibold tabular-nums",
          day.total === 0 ? "text-base-content/40" : "text-base-content"
        )}
      >
        {day.total === 0 ? "$0" : fmtCLP(day.total)}
      </span>
    </button>
  );
}
