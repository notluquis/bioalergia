import CalendarHeatmap from "react-calendar-heatmap";
import dayjs, { type Dayjs } from "dayjs";

import "react-calendar-heatmap/dist/styles.css";
import "./HeatmapMonth.css";

type HeatmapValue = {
  date: string;
  count: number;
  amountExpected: number;
  amountPaid: number;
};

export type HeatmapMonthProps = {
  month: Dayjs;
  statsByDate: Map<string, { total: number; amountExpected: number; amountPaid: number }>;
  maxValue: number;
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

function buildMonthValues(month: Dayjs, stats: Map<string, { total: number; amountExpected: number; amountPaid: number }>): HeatmapValue[] {
  const start = month.startOf("month");
  const end = month.endOf("month");
  const values: HeatmapValue[] = [];
  let cursor = start;
  while (cursor.isSame(end) || cursor.isBefore(end)) {
    const key = cursor.format("YYYY-MM-DD");
    const entry = stats.get(key);
    values.push({
      date: key,
      count: entry?.total ?? 0,
      amountExpected: entry?.amountExpected ?? 0,
      amountPaid: entry?.amountPaid ?? 0,
    });
    cursor = cursor.add(1, "day");
  }
  return values;
}

function classForValue(value: HeatmapValue | null, maxValue: number) {
  if (!value || value.count <= 0 || maxValue <= 0) return "heatmap-color-0";
  const ratio = value.count / maxValue;
  if (ratio >= 0.9) return "heatmap-color-5";
  if (ratio >= 0.7) return "heatmap-color-4";
  if (ratio >= 0.5) return "heatmap-color-3";
  if (ratio >= 0.3) return "heatmap-color-2";
  if (ratio >= 0.1) return "heatmap-color-1";
  return "heatmap-color-0";
}

function tooltipFor(value: HeatmapValue | null) {
  if (!value) return "Sin datos";
  const dateLabel = dayjs(value.date).format("DD MMM YYYY");
  return [
    dateLabel,
    `${value.count} evento${value.count === 1 ? "" : "s"}`,
    `Esperado: ${currencyFormatter.format(value.amountExpected ?? 0)}`,
    `Pagado: ${currencyFormatter.format(value.amountPaid ?? 0)}`,
  ].join("\n");
}

export function HeatmapMonth({ month, statsByDate, maxValue }: HeatmapMonthProps) {
  const values = buildMonthValues(month, statsByDate);

  return (
    <section className="heatmap-month">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--brand-primary)]">
          {month.format("MMMM YYYY")}
        </h3>
        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500">
          Σ = {values.reduce((acc, item) => acc + item.count, 0)}
        </span>
      </header>
      <CalendarHeatmap
        startDate={month.startOf("month").format("YYYY-MM-DD")}
        endDate={month.endOf("month").format("YYYY-MM-DD")}
        values={values}
        classForValue={(value: HeatmapValue | null) => classForValue(value, maxValue)}
        tooltipDataAttrs={(value: HeatmapValue | null) => ({
          title: tooltipFor(value),
        })}
        showWeekdayLabels
        gutterSize={3}
        horizontal
      />
    </section>
  );
}

export default HeatmapMonth;
