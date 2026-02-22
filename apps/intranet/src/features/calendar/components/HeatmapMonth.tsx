import { Button, Card, Popover, Tooltip } from "@heroui/react";
import clsx from "clsx";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";

import { fmtCLP } from "@/lib/format";

export interface HeatmapMonthProps {
  maxValue: number;
  month: Dayjs;
  onDayClick?: (isoDate: string) => void;
  selectedDate?: string;
  statsByDate: Map<
    string,
    {
      amountExpected: number;
      amountPaid: number;
      total: number;
      typeCounts: Record<string, number>;
    }
  >;
}

// Colors based on intensity (0 to 4)
// Colors based on intensity (0 to 4)
const INTENSITY_COLORS = {
  0: "bg-default-100/50 text-foreground-500", // Empty
  1: "bg-primary/20 text-primary font-medium hover:bg-primary/30", // Low intensity
  2: "bg-primary/40 text-primary font-semibold hover:bg-primary/50", // Med intensity
  3: "bg-primary/70 text-primary-foreground hover:bg-primary/80", // High intensity
  4: "bg-primary text-primary-foreground shadow-md shadow-primary/20", // Max intensity
};

function getIntensity(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) {
    return 0;
  }

  // For small max values, map directly to preserve distinctness
  if (max < 10) {
    if (count <= 2) {
      return 1;
    }
    if (count <= 4) {
      return 2;
    }
    if (count <= 6) {
      return 3;
    }
    return 4;
  }

  // For larger datasets, use quartiles
  const ratio = count / max;
  if (ratio > 0.8) {
    return 4;
  }
  if (ratio > 0.5) {
    return 3;
  }
  if (ratio > 0.2) {
    return 2;
  }
  return 1;
}

// Monday to Sunday (standard calendar)
const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

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
  typeCounts: Record<string, number>;
  type: "day";
}

interface PaddingCell {
  key: string;
  type: "padding";
}

function HeatmapMonthComponent({
  maxValue,
  month,
  onDayClick,
  selectedDate,
  statsByDate,
}: Readonly<HeatmapMonthProps>) {
  const [tooltipTrigger, setTooltipTrigger] = useState<"focus" | "hover">("hover");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const isTouch = window.matchMedia("(hover: none)").matches;
    setTooltipTrigger(isTouch ? "focus" : "hover");
  }, []);

  // KEEP useMemo: Heavy Array generation with multiple map/format operations
  const dates = useMemo(() => {
    const startOfMonth = month.startOf("month");
    const endOfMonth = month.endOf("month");
    const daysInMonth = endOfMonth.date();

    // Adjust for Monday start using ISO 8601 (1=Mon, 7=Sun)
    // Grid displays Mon-Sun (7 columns), so: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const jsDay = startOfMonth.isoWeekday(); // 1=Mon, 2=Tue, ..., 7=Sun
    // ISO weekday → grid column: Mon(1)→0, Tue(2)→1, Wed(3)→2, Thu(4)→3, Fri(5)→4, Sat(6)→5, Sun(7)→6
    const startDayOfWeek = jsDay - 1;

    // Generate padding days for start grid alignment (7 columns)
    const paddingStart: PaddingCell[] = Array.from({ length: startDayOfWeek }).map((_, i) => ({
      key: `pad-start-${i}`,
      type: "padding",
    }));

    // Generate actual days (Mon-Sun)
    const days: DayCell[] = Array.from({ length: daysInMonth }).map((_, i) => {
      const date = startOfMonth.add(i, "day");
      const isoDate = date.format("YYYY-MM-DD");
      const stats = statsByDate.get(isoDate) ?? {
        amountExpected: 0,
        amountPaid: 0,
        total: 0,
        typeCounts: {},
      };

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
    });

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
    const byType: Record<string, number> = {};

    for (const d of dates) {
      if (d.type === "day") {
        events += d.total;
        expected += d.amountExpected;
        paid += d.amountPaid;
        for (const [label, count] of Object.entries(d.typeCounts)) {
          byType[label] = (byType[label] ?? 0) + count;
        }

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

    // Unclassified: past events that weren't classified (no-shows, cancelled, etc.)
    const unclassified = expectedPast - paidPast;
    // Remaining: what's left to pay from today onwards (future only)
    const remaining = expectedFuture;

    return { events, expected, paid, remaining, unclassified, byType };
  }, [dates]);

  return (
    <Card className="flex flex-col overflow-hidden rounded-2xl border border-default-200 shadow-sm">
      <div className="flex items-center justify-between border-default-200/50 border-b bg-content1/50 px-4 py-3 backdrop-blur-sm">
        <h3 className="font-bold text-foreground text-sm capitalize">{month.format("MMMM")}</h3>
        <span className="font-medium text-foreground-500 text-xs">{month.format("YYYY")}</span>
      </div>

      <div className="grid grid-cols-7 gap-1 p-4">
        {/* Weekday headers */}
        {WEEKDAYS.map((d) => (
          <div
            className="select-none py-2 text-center font-bold text-[10px] text-foreground-400 uppercase tracking-widest"
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

          const cellButton = (
            <Button
              className={clsx(
                "relative flex aspect-square h-full min-h-0 w-full min-w-0 cursor-default flex-col items-center justify-center overflow-hidden rounded-md transition-all duration-200",
                // Default empty state
                "bg-default-100/50 text-foreground-500",
                // Intensity colors
                INTENSITY_COLORS[cell.intensity],
                // Conditional classes
                {
                  "cursor-pointer font-semibold": cell.total > 0 || !!onDayClick,
                  // TODAY indicator
                  "z-10 shadow-lg shadow-warning/40 ring-2 ring-warning ring-offset-2 ring-offset-content1":
                    cell.isToday,
                  "ring-2 ring-primary ring-offset-2 ring-offset-content1":
                    selectedDate === cell.isoDate && !cell.isToday,
                },
                !cell.isToday &&
                  "hover:z-10 hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-content1",
              )}
              onPress={() => onDayClick?.(cell.isoDate)}
              size="sm"
              variant="ghost"
            >
              {/* Day Number */}
              <span
                className={clsx(
                  "absolute top-0.5 left-1 text-[10px] leading-none opacity-60",
                  cell.total > 0 && "font-normal text-[9px] opacity-80",
                )}
              >
                {cell.dayNumber}
              </span>

              {/* Event Count */}
              {cell.total > 0 && (
                <span className="mt-1 font-bold text-sm tracking-tight shadow-sm drop-shadow-sm">
                  {cell.total}
                </span>
              )}
            </Button>
          );

          const cellDetails =
            cell.total > 0 ? (
              <div className="rounded-lg border border-default-200 bg-content1 p-3 text-foreground text-xs shadow-xl">
                <p className="mb-1 font-bold">{cell.date.format("dddd DD MMMM")}</p>
                <div className="space-y-0.5">
                  <p>
                    {cell.total} evento{cell.total !== 1 && "s"}
                  </p>
                  {formatTypeBreakdown(cell.typeCounts).map((line) => (
                    <p className="text-default-600" key={line}>
                      {line}
                    </p>
                  ))}
                  <p className="opacity-80">Esperado: {fmtCLP(cell.amountExpected)}</p>
                  <p className="opacity-80">Pagado: {fmtCLP(cell.amountPaid)}</p>
                </div>
              </div>
            ) : null;

          if (onDayClick) {
            return <div key={cell.key}>{cellButton}</div>;
          }

          if (tooltipTrigger === "focus") {
            if (!cellDetails) {
              return <div key={cell.key}>{cellButton}</div>;
            }
            return (
              <Popover key={cell.key}>
                <Popover.Trigger>{cellButton}</Popover.Trigger>
                <Popover.Content className="max-w-[min(90vw,260px)] p-0" offset={8}>
                  <Popover.Dialog className="p-0">{cellDetails}</Popover.Dialog>
                </Popover.Content>
              </Popover>
            );
          }

          return (
            <Tooltip delay={0} key={cell.key} trigger={tooltipTrigger}>
              <Tooltip.Trigger>{cellButton}</Tooltip.Trigger>
              <Tooltip.Content className="max-w-[min(90vw,260px)] p-0" showArrow>
                {cellDetails}
              </Tooltip.Content>
            </Tooltip>
          );
        })}
      </div>

      {/* Footer Summary */}
      <div className="border-default-200/50 border-t bg-content1/30 px-4 py-2 text-[10px]">
        <div className="flex flex-wrap items-center justify-between gap-2 text-foreground-500">
          <span className="font-semibold">Σ {monthTotals.events} eventos</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Tooltip delay={0} isDisabled={tooltipTrigger === "focus"} trigger={tooltipTrigger}>
              <Tooltip.Trigger>
                <Button className="h-auto min-w-0 px-0 text-[10px]" size="sm" variant="ghost">
                  Esperado:{" "}
                  <span className="font-medium text-foreground">
                    {fmtCLP(monthTotals.expected)}
                  </span>
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="max-w-[min(90vw,220px)] rounded-lg border border-default-200 bg-content1 p-2 text-foreground text-xs"
                showArrow
              >
                Total esperado del mes completo
              </Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0} isDisabled={tooltipTrigger === "focus"} trigger={tooltipTrigger}>
              <Tooltip.Trigger>
                <Button className="h-auto min-w-0 px-0 text-[10px]" size="sm" variant="ghost">
                  Pagado:{" "}
                  <span className="font-medium text-foreground">{fmtCLP(monthTotals.paid)}</span>
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="max-w-[min(90vw,220px)] rounded-lg border border-default-200 bg-content1 p-2 text-foreground text-xs"
                showArrow
              >
                Total pagado del mes completo
              </Tooltip.Content>
            </Tooltip>
            {monthTotals.unclassified > 0 && (
              <Tooltip delay={0} isDisabled={tooltipTrigger === "focus"} trigger={tooltipTrigger}>
                <Tooltip.Trigger>
                  <Button
                    className="h-auto min-w-0 px-0 text-[10px] text-warning"
                    size="sm"
                    variant="ghost"
                  >
                    No cobrado:{" "}
                    <span className="font-medium">{fmtCLP(monthTotals.unclassified)}</span>
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content
                  className="max-w-[min(90vw,220px)] rounded-lg border border-default-200 bg-content1 p-2 text-foreground text-xs"
                  showArrow
                >
                  Eventos pasados que no fueron cobrados (no asistieron, cancelaron, etc.)
                </Tooltip.Content>
              </Tooltip>
            )}
            <Tooltip delay={0} isDisabled={tooltipTrigger === "focus"} trigger={tooltipTrigger}>
              <Tooltip.Trigger>
                <Button className="h-auto min-w-0 px-0 text-[10px]" size="sm" variant="ghost">
                  Restante:{" "}
                  <span className="font-medium text-foreground">
                    {fmtCLP(monthTotals.remaining)}
                  </span>
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="max-w-[min(90vw,220px)] rounded-lg border border-default-200 bg-content1 p-2 text-foreground text-xs"
                showArrow
              >
                Lo que falta pagar desde hoy en adelante (solo eventos futuros)
              </Tooltip.Content>
            </Tooltip>
          </div>
        </div>
        {formatTypeBreakdown(monthTotals.byType).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-default-400">
            {formatTypeBreakdown(monthTotals.byType).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
export { HeatmapMonthComponent as HeatmapMonth };

function formatTypeBreakdown(typeCounts: Record<string, number>) {
  return Object.entries(typeCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => {
      const displayLabel = label === "default" ? "Sin tipo" : label;
      return `${count} ${displayLabel}`;
    });
}
