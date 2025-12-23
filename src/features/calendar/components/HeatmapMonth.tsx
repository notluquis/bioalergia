import { useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
import clsx from "clsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { fmtCLP } from "@/lib/format";
import "./HeatmapMonth.css";

export type HeatmapMonthProps = {
  month: Dayjs;
  statsByDate: Map<string, { total: number; amountExpected: number; amountPaid: number }>;
  maxValue: number;
};

// Colors based on intensity (0 to 4)
const INTENSITY_COLORS = {
  0: "bg-base-200/30 text-base-content/30", // Empty
  1: "bg-primary/20 text-primary-content/80 dark:text-primary-content", // 1-2 events
  2: "bg-primary/40 text-primary-content", // Low
  3: "bg-primary/70 text-primary-content", // Medium
  4: "bg-primary text-primary-content", // High
};

function getIntensity(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 2) return 1; // Explicit low count check for visibility
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.45) return 3;
  return 2;
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

export function HeatmapMonth({ month, statsByDate, maxValue }: HeatmapMonthProps) {
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

  const monthTotal = useMemo(() => dates.reduce((acc, d) => (d.type === "day" ? acc + d.total : acc), 0), [dates]);

  return (
    <TooltipProvider delayDuration={0}>
      <article className="heatmap-month">
        <header className="heatmap-month__header">
          <h3 className="heatmap-month__title">{month.format("MMMM")}</h3>
          <span className="heatmap-month__subtitle">{month.format("YYYY")}</span>
        </header>

        <div className="heatmap-month__grid">
          {/* Weekday headers */}
          {WEEKDAYS.map((d) => (
            <div key={d} className="heatmap-month__weekday">
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
                    className={clsx("heatmap-cell", INTENSITY_COLORS[cell.intensity], {
                      "heatmap-cell--today": cell.isToday,
                      "heatmap-cell--has-data": cell.total > 0,
                    })}
                  >
                    <span className="heatmap-cell__date">{cell.dayNumber}</span>
                  </div>
                </TooltipTrigger>
                {cell.total > 0 && (
                  <TooltipContent side="top" className="text-xs">
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
        <div className="bg-base-100/30 text-base-content/40 border-base-200/50 border-t px-4 py-2 text-right text-[10px] font-medium">
          Total: {monthTotal}
        </div>
      </article>
    </TooltipProvider>
  );
}

export default HeatmapMonth;
