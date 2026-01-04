import clsx from "clsx";
import dayjs, { type Dayjs } from "dayjs";
import React, { useMemo } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { fmtCLP } from "@/lib/format";

export type HeatmapMonthProps = {
  month: Dayjs;
  statsByDate: Map<string, { total: number; amountExpected: number; amountPaid: number }>;
  maxValue: number;
};

// Colors based on intensity (0 to 4)
// Colors based on intensity (0 to 4)
const INTENSITY_COLORS = {
  0: "bg-base-200/50 text-base-content/70", // Empty
  1: "bg-primary/20 text-primary font-medium hover:bg-primary/30", // Low intensity: Darker text on light bg
  2: "bg-primary/40 text-primary font-semibold hover:bg-primary/50", // Med intensity: Darker text on med bg
  3: "bg-primary/70 text-primary-content hover:bg-primary/80", // High intensity: White text ok
  4: "bg-primary text-primary-content shadow-md shadow-primary/20", // Max intensity
};

function getIntensity(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;

  // For small max values, map directly to preserve distinctness
  if (max < 10) {
    if (count <= 2) return 1;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    return 4;
  }

  // For larger datasets, use quartiles
  const ratio = count / max;
  if (ratio > 0.8) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.2) return 2;
  return 1;
}

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

type PaddingCell = {
  key: string;
  type: "padding";
};

type DayCell = {
  key: string;
  type: "day";
  date: Dayjs;
  dayNumber: number;
  isoDate: string;
  total: number;
  amountExpected: number;
  amountPaid: number;
  isToday: boolean;
  intensity: 0 | 1 | 2 | 3 | 4;
};

type DateCell = PaddingCell | DayCell;

function HeatmapMonthComponent({ month, statsByDate, maxValue }: HeatmapMonthProps) {
  const dates = useMemo<DateCell[]>(() => {
    const startOfMonth = month.startOf("month");
    const endOfMonth = month.endOf("month");
    const daysInMonth = endOfMonth.date();

    // Adjust for Monday start (0=Mon, 6=Sun in our consistent handling)
    const startDayOfWeek = (startOfMonth.day() + 6) % 7;

    // Generate padding days for start grid alignment
    const paddingStart: PaddingCell[] = Array.from({ length: startDayOfWeek }).map((_, i) => ({
      key: `pad-start-${i}`,
      type: "padding",
    }));

    // Generate actual days
    const days: DayCell[] = Array.from({ length: daysInMonth }).map((_, i) => {
      const date = startOfMonth.add(i, "day");
      const isoDate = date.format("YYYY-MM-DD");
      const stats = statsByDate.get(isoDate) || { total: 0, amountExpected: 0, amountPaid: 0 };

      return {
        key: isoDate,
        type: "day",
        date: date,
        dayNumber: i + 1,
        isoDate,
        ...stats,
        isToday: date.isSame(dayjs(), "day"),
        intensity: getIntensity(stats.total, maxValue),
      };
    });

    return [...paddingStart, ...days];
  }, [month, statsByDate, maxValue]);

  const monthTotals = useMemo(() => {
    let events = 0;
    let expected = 0;
    let paid = 0;
    for (const d of dates) {
      if (d.type === "day") {
        events += d.total;
        expected += d.amountExpected;
        paid += d.amountPaid;
      }
    }
    return { events, expected, paid };
  }, [dates]);

  return (
    <TooltipProvider delayDuration={0}>
      <article className="bg-base-100 border-base-200 flex flex-col overflow-hidden rounded-2xl border shadow-sm">
        <header className="border-base-200/50 bg-base-100/50 flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm">
          <h3 className="text-base-content text-sm font-bold capitalize">{month.format("MMMM")}</h3>
          <span className="text-base-content/50 text-xs font-medium">{month.format("YYYY")}</span>
        </header>

        <div className="grid grid-cols-7 gap-1 p-4">
          {/* Weekday headers */}
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-base-content/40 py-2 text-center text-[10px] font-bold tracking-widest uppercase select-none"
            >
              {d}
            </div>
          ))}

          {/* Days */}
          {dates.map((cell) => {
            if (cell.type === "padding") {
              return <div key={cell.key} />;
            }

            return (
              <Tooltip key={cell.key}>
                <TooltipTrigger asChild>
                  <div
                    className={clsx(
                      "relative flex aspect-square w-full cursor-default flex-col items-center justify-center overflow-hidden rounded-md transition-all duration-200",
                      // Default empty state - Use higher opacity text for visibility
                      "bg-base-200/30 text-base-content/70",
                      // Intensity colors overlap default
                      INTENSITY_COLORS[cell.intensity],
                      {
                        "ring-primary/50 relative ring-1 ring-inset": cell.isToday,
                        "cursor-pointer font-semibold": cell.total > 0,
                      },
                      "hover:ring-primary hover:ring-offset-base-100 hover:z-10 hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-offset-2"
                    )}
                  >
                    {/* Day Number - Top Left, smaller */}
                    <span
                      className={clsx(
                        "absolute top-0.5 left-1 text-[10px] leading-none opacity-60",
                        cell.total > 0 && "text-[9px] font-normal opacity-80" // Adjust if has data
                      )}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Event Count - Center, Bold */}
                    {cell.total > 0 && (
                      <span className="mt-1 text-sm font-bold tracking-tight shadow-sm drop-shadow-sm">
                        {cell.total}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                {cell.total > 0 && (
                  <TooltipContent
                    side="top"
                    className="bg-base-300 border-base-content/10 text-base-content z-50 rounded-xl border p-3 text-xs shadow-xl"
                  >
                    <p className="mb-1 font-bold">{cell.date.format("dddd DD MMMM")}</p>
                    <div className="space-y-0.5">
                      <p>
                        {cell.total} evento{cell.total !== 1 && "s"}
                      </p>
                      <p className="opacity-80">Esperado: {fmtCLP(cell.amountExpected)}</p>
                      <p className="opacity-80">Pagado: {fmtCLP(cell.amountPaid)}</p>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* Footer Summary */}
        <div className="bg-base-100/30 border-base-200/50 border-t px-4 py-2 text-[10px]">
          <div className="text-base-content/60 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Σ {monthTotals.events} eventos</span>
            <div className="flex gap-3">
              <span>
                Esperado: <span className="font-medium">{fmtCLP(monthTotals.expected)}</span>
              </span>
              <span>
                Pagado: <span className="font-medium">{fmtCLP(monthTotals.paid)}</span>
              </span>
            </div>
          </div>
        </div>
      </article>
    </TooltipProvider>
  );
}

export const HeatmapMonth = React.memo(HeatmapMonthComponent);
export default HeatmapMonth;
