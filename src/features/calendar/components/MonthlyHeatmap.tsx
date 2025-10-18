import { useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/es";

dayjs.extend(isoWeek);

type DayStat = {
  total: number;
  amountExpected: number;
  amountPaid: number;
};

type CalendarDayCell = {
  dateKey: string;
  dayNumber: number;
  stats: DayStat;
  isCurrentMonth: boolean;
  isToday: boolean;
};

type CalendarWeekRow = {
  label: string;
  cells: CalendarDayCell[];
  total: number;
};

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const heatmapColors = ["#f8fafc", "#fef3c7", "#fde68a", "#fbbf24", "#f97316", "#ea580c", "#b91c1c"];

function normalizeStats(value?: DayStat | null): DayStat {
  if (!value) {
    return { total: 0, amountExpected: 0, amountPaid: 0 };
  }
  return {
    total: value.total ?? 0,
    amountExpected: value.amountExpected ?? 0,
    amountPaid: value.amountPaid ?? 0,
  };
}

function buildMonthMatrix(month: Dayjs, statsByDate: Map<string, DayStat>): { weeks: CalendarWeekRow[]; total: number } {
  const firstOfMonth = month.startOf("month");
  const lastOfMonth = month.endOf("month");
  const startDate = firstOfMonth.startOf("week");
  const endDate = lastOfMonth.endOf("week");

  const weeks: CalendarWeekRow[] = [];
  let cursor = startDate;
  const today = dayjs();
  let monthTotal = 0;

  while (cursor.isBefore(endDate) || cursor.isSame(endDate, "day")) {
    const weekIndex = Math.floor(cursor.diff(startDate, "week"));
    if (!weeks[weekIndex]) {
      weeks[weekIndex] = {
        label: `Sem ${weekIndex + 1}`,
        cells: [],
        total: 0,
      };
    }

    const dateKey = cursor.format("YYYY-MM-DD");
    const stats = normalizeStats(statsByDate.get(dateKey));
    const isCurrentMonth = cursor.month() === month.month();

    weeks[weekIndex].cells.push({
      dateKey,
      dayNumber: cursor.date(),
      stats,
      isCurrentMonth,
      isToday: cursor.isSame(today, "day"),
    });

    if (isCurrentMonth) {
      monthTotal += stats.total;
      weeks[weekIndex].total += stats.total;
    }

    cursor = cursor.add(1, "day");
  }

  return { weeks, total: monthTotal };
}

function computeCellColor(value: number, maxValue: number): string {
  if (value <= 0 || maxValue <= 0) {
    return heatmapColors[0];
  }

  const ratio = Math.min(value / maxValue, 1);
  const index = Math.min(heatmapColors.length - 1, Math.floor(ratio * (heatmapColors.length - 1)));
  return heatmapColors[index];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(value);
}

function buildTooltip(cell: CalendarDayCell) {
  const dateLabel = dayjs(cell.dateKey).format("DD MMM YYYY");
  const { total, amountExpected, amountPaid } = cell.stats;
  return [
    dateLabel,
    `${total} evento${total === 1 ? "" : "s"}`,
    `Esperado: ${formatCurrency(amountExpected)}`,
    `Pagado: ${formatCurrency(amountPaid)}`,
  ].join("\n");
}

export function MonthlyHeatmap({
  month,
  statsByDate,
  maxValue,
  titleSuffix,
}: {
  month: Dayjs;
  statsByDate: Map<string, DayStat>;
  maxValue: number;
  titleSuffix?: string;
}) {
  const matrix = useMemo(() => buildMonthMatrix(month, statsByDate), [month, statsByDate]);

  return (
    <section className="glass-card glass-underlay-gradient flex flex-col gap-3 rounded-2xl border border-white/60 p-4 text-xs shadow-sm">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--brand-primary)]">
            {month.format("MMMM YYYY")}
            {titleSuffix ? ` · ${titleSuffix}` : ""}
          </h3>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600">
            Σ = {matrix.total}
          </span>
        </div>
        <p className="text-[11px] text-slate-500">Distribución semanal de eventos</p>
      </header>

      <div className="overflow-auto">
        <div
          className="grid gap-1 text-[11px] text-slate-600"
          style={{ gridTemplateColumns: "72px repeat(7, minmax(0, 1fr)) 64px" }}
        >
          <div />
          {weekdayLabels.map((label) => (
            <div key={label} className="text-center font-semibold uppercase tracking-wide text-[10px] text-slate-400">
              {label}
            </div>
          ))}
          <div className="text-center font-semibold uppercase tracking-wide text-[10px] text-slate-400">Total</div>

          {matrix.weeks.map((week) => (
            <div key={week.label} className="contents">
              <div className="flex items-center justify-center rounded-lg bg-white/70 px-1 py-2 font-semibold text-slate-500">
                {week.label}
              </div>
              {week.cells.map((cell) => {
                const color = computeCellColor(cell.stats.total, maxValue);
                const isMuted = !cell.isCurrentMonth;
                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    title={buildTooltip(cell)}
                    className={`relative flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-white/40 text-xs transition-transform duration-150 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] ${
                      isMuted ? "opacity-50" : "opacity-100"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`${cell.stats.total} eventos el ${dayjs(cell.dateKey).format("DD MMM YYYY")}`}
                  >
                    <span
                      className={`absolute left-2 top-2 text-[10px] font-semibold ${
                        cell.isToday ? "text-[var(--brand-secondary)]" : "text-slate-600"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      {cell.stats.total > 0 ? cell.stats.total : "—"}
                    </span>
                  </button>
                );
              })}
              <div className="flex items-center justify-center rounded-lg bg-white/70 px-2 py-2 font-semibold text-slate-600">
                {week.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="flex items-center justify-between text-[10px] text-slate-500">
        <span>Más oscuro = más eventos</span>
        <span>{dayjs().format("DD MMM YYYY")}</span>
      </footer>
    </section>
  );
}

export type MonthlyHeatmapProps = Parameters<typeof MonthlyHeatmap>[0];
