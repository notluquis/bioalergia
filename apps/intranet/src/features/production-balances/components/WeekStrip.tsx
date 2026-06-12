import { Button, Skeleton } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { chileDay, today } from "@/lib/dates";

import { cn } from "@/lib/utils";

import { DAY_STATUS_DOT_CLASSES, DAY_STATUS_LABELS } from "../labels";
import type { DayCell, WeekData } from "../types";

const SKELETON_KEYS = Array.from({ length: 7 }, (_, index) => `skeleton-${index}`);

// Totales del strip en notación compacta ("$1,9 M") — fmtCLP completo
// desborda las celdas angostas en mobile.
const compactCLP = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 1,
  notation: "compact",
  style: "currency",
});

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
  if (isCollapsed) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-default-100 bg-default-50/30 px-4 py-2">
        {weekData?.weekLabel ? (
          <span className="text-default-500 text-sm">{weekData.weekLabel}</span>
        ) : (
          <Skeleton className="h-4 w-24 rounded-lg" />
        )}
        <div className="flex items-center gap-2">
          <Button
            aria-label="Semana anterior"
            isIconOnly
            size="sm"
            variant="outline"
            onPress={onPrevWeek}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label="Semana siguiente"
            isIconOnly
            size="sm"
            variant="outline"
            onPress={onNextWeek}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-[28px] border border-default-100 bg-default-50/30 p-3 md:p-4">
      {/* Week header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Button
            aria-label="Semana anterior"
            isIconOnly
            size="sm"
            variant="outline"
            onPress={onPrevWeek}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="whitespace-nowrap font-medium text-default-700 text-sm">
            {weekData?.weekLabel ?? "..."}
          </span>
          <Button
            aria-label="Semana siguiente"
            isIconOnly
            size="sm"
            variant="outline"
            onPress={onNextWeek}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onPress={onGoToToday}>
          Hoy
        </Button>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {weekData?.days.map((day) => (
          <DayCellButton
            day={day}
            isSelected={chileDay(day.date) === chileDay(currentDate)}
            isToday={chileDay(day.date) === today()}
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
  return (
    <Button
      aria-label={`${day.dayName} ${day.dayNumber}, ${DAY_STATUS_LABELS[day.status]}${
        day.total > 0 ? `, total ${compactCLP.format(day.total)}` : ""
      }`}
      className={cn(
        "relative h-18! min-w-0 flex-col items-center justify-center gap-0 rounded-xl p-1 md:h-19! md:p-2",
        "hover:bg-default-50",
        isSelected && "bg-primary/10 ring-1 ring-primary/60",
        isToday && !isSelected && "ring-1 ring-primary/30"
      )}
      fullWidth
      onPress={onPress}
      type="button"
      variant="outline"
    >
      {/* Status dot (estado también va en el aria-label, no solo color) */}
      {day.status !== "empty" && (
        <div
          className={cn(
            "absolute top-1.5 right-1.5 size-2 rounded-full md:top-2 md:right-2",
            DAY_STATUS_DOT_CLASSES[day.status]
          )}
        />
      )}

      {/* Day name + number */}
      <span className={cn("font-medium text-xs", isSelected ? "text-primary" : "text-default-500")}>
        {day.dayName}
      </span>
      <span
        className={cn(
          "font-semibold text-base leading-tight tabular-nums",
          isSelected ? "text-primary" : isToday ? "text-foreground" : "text-default-700"
        )}
      >
        {day.dayNumber}
      </span>

      {/* Amount: solo cuando hay movimientos — siete "$0" eran puro ruido */}
      <span
        className={cn(
          "mt-0.5 hidden font-medium text-xs leading-none tabular-nums sm:block",
          day.total === 0 ? "text-default-300" : isSelected ? "text-primary" : "text-default-600"
        )}
      >
        {day.total === 0 ? "—" : compactCLP.format(day.total)}
      </span>
    </Button>
  );
}
