import { Button, Card, Popover, Tooltip } from "@heroui/react";
import clsx from "clsx";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";

import { fmtCLP } from "@/lib/format";

export interface HeatmapMonthProps {
  maxValue: number;
  month: Dayjs;
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
  typeCounts: Record<string, number>;
  type: "day";
}

interface PaddingCell {
  key: string;
  type: "padding";
}

function HeatmapMonthComponent({ maxValue, month, statsByDate }: Readonly<HeatmapMonthProps>) {
  const [tooltipTrigger, setTooltipTrigger] = useState<"focus" | "hover">("hover");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const isTouch = window.matchMedia("(hover: none)").matches;
    setTooltipTrigger(isTouch ? "focus" : "hover");
  }, []);

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
    <Card className="border-default-200 flex flex-col overflow-hidden rounded-2xl border shadow-sm">
      <div className="border-default-200/50 bg-content1/50 flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm">
        <h3 className="text-foreground text-sm font-bold capitalize">{month.format("MMMM")}</h3>
        <span className="text-foreground-500 text-xs font-medium">{month.format("YYYY")}</span>
      </div>

      <div className="grid grid-cols-6 gap-1 p-4">
        {/* Weekday headers */}
        {WEEKDAYS.map((d) => (
          <div
            className="text-foreground-400 py-2 text-center text-[10px] font-bold tracking-widest uppercase select-none"
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
                "relative flex h-full w-full min-h-0 min-w-0 aspect-square cursor-default flex-col items-center justify-center overflow-hidden rounded-md transition-all duration-200",
                // Default empty state
                "bg-default-100/50 text-foreground-500",
                // Intensity colors
                INTENSITY_COLORS[cell.intensity],
                // Conditional classes
                {
                  "cursor-pointer font-semibold": cell.total > 0,
                  // TODAY indicator
                  "ring-warning ring-offset-content1 shadow-warning/40 z-10 shadow-lg ring-2 ring-offset-2":
                    cell.isToday,
                },
                !cell.isToday &&
                  "hover:ring-primary hover:ring-offset-content1 hover:z-10 hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-offset-2",
              )}
              size="sm"
              variant="ghost"
            >
              {/* Day Number */}
              <span
                className={clsx(
                  "absolute top-0.5 left-1 text-[10px] leading-none opacity-60",
                  cell.total > 0 && "text-[9px] font-normal opacity-80",
                )}
              >
                {cell.dayNumber}
              </span>

              {/* Event Count */}
              {cell.total > 0 && (
                <span className="mt-1 text-sm font-bold tracking-tight shadow-sm drop-shadow-sm">
                  {cell.total}
                </span>
              )}
            </Button>
          );

          const cellDetails =
            cell.total > 0 ? (
              <div className="bg-content1 text-foreground border-default-200 rounded-lg border p-3 text-xs shadow-xl">
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

          if (tooltipTrigger === "focus") {
            if (!cellDetails) {
              return <div key={cell.key}>{cellButton}</div>;
            }
            return (
              <Popover key={cell.key}>
                <Popover.Trigger>{cellButton}</Popover.Trigger>
                <Popover.Content className="z-50 max-w-[min(90vw,260px)] p-0" offset={8}>
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
      <div className="bg-content1/30 border-default-200/50 border-t px-4 py-2 text-[10px]">
        <div className="text-foreground-500 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">Σ {monthTotals.events} eventos</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Tooltip delay={0} isDisabled={tooltipTrigger === "focus"} trigger={tooltipTrigger}>
              <Tooltip.Trigger>
                <Button className="h-auto min-w-0 px-0 text-[10px]" size="sm" variant="ghost">
                  Esperado:{" "}
                  <span className="text-foreground font-medium">
                    {fmtCLP(monthTotals.expected)}
                  </span>
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="bg-content1 text-foreground border-default-200 max-w-[min(90vw,220px)] rounded-lg border p-2 text-xs"
                showArrow
              >
                Total esperado del mes completo
              </Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0} isDisabled={tooltipTrigger === "focus"} trigger={tooltipTrigger}>
              <Tooltip.Trigger>
                <Button className="h-auto min-w-0 px-0 text-[10px]" size="sm" variant="ghost">
                  Pagado:{" "}
                  <span className="text-foreground font-medium">{fmtCLP(monthTotals.paid)}</span>
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="bg-content1 text-foreground border-default-200 max-w-[min(90vw,220px)] rounded-lg border p-2 text-xs"
                showArrow
              >
                Total pagado del mes completo
              </Tooltip.Content>
            </Tooltip>
            {monthTotals.unclassified > 0 && (
              <Tooltip delay={0} isDisabled={tooltipTrigger === "focus"} trigger={tooltipTrigger}>
                <Tooltip.Trigger>
                  <Button
                    className="text-warning h-auto min-w-0 px-0 text-[10px]"
                    size="sm"
                    variant="ghost"
                  >
                    No cobrado:{" "}
                    <span className="font-medium">{fmtCLP(monthTotals.unclassified)}</span>
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content
                  className="bg-content1 text-foreground border-default-200 max-w-[min(90vw,220px)] rounded-lg border p-2 text-xs"
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
                  <span className="text-foreground font-medium">
                    {fmtCLP(monthTotals.remaining)}
                  </span>
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="bg-content1 text-foreground border-default-200 max-w-[min(90vw,220px)] rounded-lg border p-2 text-xs"
                showArrow
              >
                Lo que falta pagar desde hoy en adelante (solo eventos futuros)
              </Tooltip.Content>
            </Tooltip>
          </div>
        </div>
        {formatTypeBreakdown(monthTotals.byType).length > 0 && (
          <div className="text-default-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {formatTypeBreakdown(monthTotals.byType).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default HeatmapMonthComponent;

function formatTypeBreakdown(typeCounts: Record<string, number>) {
  return Object.entries(typeCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => {
      const displayLabel = label === "default" ? "Sin tipo" : label;
      return `${count} ${displayLabel}`;
    });
}
