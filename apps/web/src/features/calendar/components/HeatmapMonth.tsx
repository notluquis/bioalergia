import clsx from "clsx";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { fmtCLP } from "@/lib/format";

export interface HeatmapMonthProps {
  maxValue: number;
  month: Dayjs;
  statsByDate: Map<string, { amountExpected: number; amountPaid: number; total: number }>;
}

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

// Monday to Saturday only (excluding Sunday)
const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

interface DayCell {
  amountExpected: number;
  amountPaid: number;
  date: Dayjs;
  dayNumber: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  isoDate: string;
  isToday: boolean;
  key: string;
  total: number;
  type: "day";
}

interface PaddingCell {
  key: string;
  type: "padding";
}

function HeatmapMonthComponent({ maxValue, month, statsByDate }: Readonly<HeatmapMonthProps>) {
  // KEEP useMemo: Heavy Array generation with multiple map/format operations
  const dates = useMemo(() => {
    const startOfMonth = month.startOf("month");
    const endOfMonth = month.endOf("month");
    const daysInMonth = endOfMonth.date();

    // Adjust for Monday start (0=Mon, 5=Sat in our 6-day week)
    // Sunday is excluded, so we map: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5
    const jsDay = startOfMonth.day(); // 0=Sun, 1=Mon, ..., 6=Sat
    // For a Mon-Sat grid: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5
    // If jsDay=0 (Sun), it's not shown, but for month start we treat it as would be after Sat
    // jsDay=1 (Mon) -> 0, jsDay=2 (Tue) -> 1, ..., jsDay=6 (Sat) -> 5, jsDay=0 (Sun) -> 6 (but clamp to 0)
    const startDayOfWeek = jsDay === 0 ? 0 : jsDay - 1; // Sun treated as Monday position (0)

    // Generate padding days for start grid alignment (now 6 columns)
    const paddingStart: PaddingCell[] = Array.from({ length: startDayOfWeek }).map((_, i) => ({
      key: `pad-start-${i}`,
      type: "padding",
    }));

    // Generate actual days, excluding Sundays
    const days: DayCell[] = Array.from({ length: daysInMonth })
      .map((_, i) => {
        const date = startOfMonth.add(i, "day");
        const isoDate = date.format("YYYY-MM-DD");
        const stats = statsByDate.get(isoDate) ?? { amountExpected: 0, amountPaid: 0, total: 0 };

        return {
          date: date,
          dayNumber: i + 1,
          isoDate,
          key: isoDate,
          type: "day" as const,
          ...stats,
          intensity: getIntensity(stats.total, maxValue),
          isToday: date.isSame(dayjs(), "day"),
        };
      })
      .filter((day) => day.date.day() !== 0); // Filter out Sundays (day() === 0)

    return [...paddingStart, ...days];
  }, [month, statsByDate, maxValue]);

  // KEEP useMemo: Aggregation over dates array with past/future split
  const monthTotals = useMemo(() => {
    const today = dayjs();
    let events = 0;
    let expected = 0;
    let paid = 0;
    let expectedFuture = 0; // Expected from today onwards
    let expectedPast = 0; // Expected before today
    let paidPast = 0; // Paid before today

    for (const d of dates) {
      if (d.type === "day") {
        events += d.total;
        expected += d.amountExpected;
        paid += d.amountPaid;

        // Split by past/future relative to today
        if (d.date.isBefore(today, "day")) {
          expectedPast += d.amountExpected;
          paidPast += d.amountPaid;
        } else {
          // Today and future days
          expectedFuture += d.amountExpected;
        }
      }
    }

    // Overdue: what should have been paid but wasn't (past days only)
    const overdue = expectedPast - paidPast;
    // Remaining: what's left to pay from today onwards
    const remaining = expectedFuture + overdue;

    return { events, expected, overdue, paid, remaining };
  }, [dates]);

  return (
    <TooltipProvider delayDuration={0}>
      <article className="bg-base-100 border-base-200 flex flex-col overflow-hidden rounded-2xl border shadow-sm">
        <header className="border-base-200/50 bg-base-100/50 flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm">
          <h3 className="text-base-content text-sm font-bold capitalize">{month.format("MMMM")}</h3>
          <span className="text-base-content/50 text-xs font-medium">{month.format("YYYY")}</span>
        </header>

        <div className="grid grid-cols-6 gap-1 p-4">
          {/* Weekday headers */}
          {WEEKDAYS.map((d) => (
            <div
              className="text-base-content/40 py-2 text-center text-[10px] font-bold tracking-widest uppercase select-none"
              key={d}
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
                        "cursor-pointer font-semibold": cell.total > 0,
                        // TODAY indicator - prominent ring with glow effect
                        "ring-warning ring-offset-base-100 shadow-warning/40 z-10 shadow-lg ring-2 ring-offset-2":
                          cell.isToday,
                      },
                      !cell.isToday &&
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
                    className="bg-base-300 border-base-content/10 text-base-content z-50 rounded-xl border p-3 text-xs shadow-xl"
                    side="top"
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
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    Esperado: <span className="font-medium">{fmtCLP(monthTotals.expected)}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-base-300 border-base-content/10 text-base-content max-w-xs rounded-lg border p-2 text-xs">
                  Total esperado del mes completo
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    Pagado: <span className="font-medium">{fmtCLP(monthTotals.paid)}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-base-300 border-base-content/10 text-base-content max-w-xs rounded-lg border p-2 text-xs">
                  Total pagado del mes completo
                </TooltipContent>
              </Tooltip>
              {monthTotals.overdue > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-error cursor-help">
                      Atrasado: <span className="font-medium">{fmtCLP(monthTotals.overdue)}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-base-300 border-base-content/10 text-base-content max-w-xs rounded-lg border p-2 text-xs">
                    Lo que debió estar pagado antes de hoy pero no se pagó
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    Restante: <span className="font-medium">{fmtCLP(monthTotals.remaining)}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-base-300 border-base-content/10 text-base-content max-w-xs rounded-lg border p-2 text-xs">
                  Lo que falta pagar desde hoy en adelante (incluye atrasos)
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </article>
    </TooltipProvider>
  );
}

export default HeatmapMonthComponent;
