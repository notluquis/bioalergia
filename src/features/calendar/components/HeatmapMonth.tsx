import dayjs, { type Dayjs } from "dayjs";
import clsx from "clsx";

import "./HeatmapMonth.css";

export type HeatmapMonthProps = {
  month: Dayjs;
  statsByDate: Map<string, { total: number; amountExpected: number; amountPaid: number }>;
  maxValue: number;
};

type WeekCell = {
  dayNumber: number | null;
  isoDate?: string;
  count: number;
  amountExpected: number;
  amountPaid: number;
  isToday?: boolean;
};

type WeekRow = {
  cells: WeekCell[];
  total: number;
};

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const colorPalette = ["#F1F5F9", "#DBEAFE", "#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#1D4ED8"];

function buildWeeks(
  month: Dayjs,
  statsByDate: Map<string, { total: number; amountExpected: number; amountPaid: number }>
): WeekRow[] {
  const start = month.startOf("month");
  const end = month.endOf("month");
  const today = dayjs().startOf("day");

  const weeks: WeekRow[] = [];

  let currentRow: WeekRow | null = null;
  let cursor = start.clone();

  while (cursor.isSame(end) || cursor.isBefore(end)) {
    const weekday = (cursor.day() + 6) % 7; // Monday = 0
    const isSunday = weekday === 6;
    const isoDate = cursor.format("YYYY-MM-DD");
    const stats = statsByDate.get(isoDate);
    const count = stats?.total ?? 0;

    if (!currentRow || weekday === 0) {
      if (currentRow) {
        weeks.push(currentRow);
      }
      currentRow = {
        cells: Array.from({ length: 6 }, () => ({
          dayNumber: null,
          count: 0,
          amountExpected: 0,
          amountPaid: 0,
        })),
        total: 0,
      };
    }

    if (!isSunday && currentRow) {
      currentRow.cells[weekday] = {
        dayNumber: cursor.date(),
        isoDate,
        count,
        amountExpected: stats?.amountExpected ?? 0,
        amountPaid: stats?.amountPaid ?? 0,
        isToday: cursor.isSame(today),
      };
      currentRow.total += count;
    } else if (isSunday && currentRow) {
      currentRow.total += count;
    }

    cursor = cursor.add(1, "day");
  }

  if (currentRow) {
    weeks.push(currentRow);
  }

  return weeks;
}

function colorForValue(count: number, max: number) {
  if (count <= 0 || max <= 0) return colorPalette[0];
  const ratio = count / max;
  if (ratio >= 0.9) return colorPalette[6];
  if (ratio >= 0.75) return colorPalette[5];
  if (ratio >= 0.6) return colorPalette[4];
  if (ratio >= 0.4) return colorPalette[3];
  if (ratio >= 0.25) return colorPalette[2];
  if (ratio >= 0.1) return colorPalette[1];
  return colorPalette[0];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount ?? 0);
}

function buildTooltip(cell: WeekCell) {
  if (!cell.dayNumber || !cell.isoDate) return "Sin datos";
  const dateLabel = dayjs(cell.isoDate).format("DD MMM YYYY");
  return [
    `${dateLabel}`,
    `${cell.count} evento${cell.count === 1 ? "" : "s"}`,
    `Esperado: ${formatCurrency(cell.amountExpected)}`,
    `Pagado: ${formatCurrency(cell.amountPaid)}`,
  ].join("\n");
}

export function HeatmapMonth({ month, statsByDate, maxValue }: HeatmapMonthProps) {
  const weeks = buildWeeks(month, statsByDate);
  const monthTotal = weeks.reduce((acc, week) => acc + week.total, 0);
  const maxCount = Math.max(maxValue, ...weeks.map((week) => Math.max(...week.cells.map((cell) => cell.count))), 1);

  return (
    <section className="calendar-month-card">
      <header className="calendar-month-card__header">
        <div>
          <p className="calendar-month-card__title">{month.format("MMMM YYYY")}</p>
          <p className="calendar-month-card__subtitle">Σ total {monthTotal}</p>
        </div>
      </header>
      <div className="calendar-month-card__grid" role="table" aria-label={`Mapa de calor ${month.format("MMMM YYYY")}`}>
        <div className="calendar-month-card__grid-corner" role="columnheader">
          Sem
        </div>
        {weekdayLabels.map((label) => (
          <div key={label} className="calendar-month-card__column-header" role="columnheader">
            {label}
          </div>
        ))}
        <div
          className="calendar-month-card__column-header calendar-month-card__column-header--total"
          role="columnheader"
        >
          Σ
        </div>
        {weeks.map((week, index) => (
          <div key={`week-${index}`} className="calendar-month-card__row" role="row">
            <div className="calendar-month-card__row-label" role="rowheader">
              Sem {index + 1}
            </div>
            {week.cells.map((cell, cellIndex) => (
              <div
                key={`cell-${index}-${cellIndex}`}
                className={clsx("calendar-month-card__cell", {
                  "calendar-month-card__cell--empty": !cell.dayNumber,
                  "calendar-month-card__cell--today": cell.isToday,
                })}
                style={{ backgroundColor: colorForValue(cell.count, maxCount) }}
                title={cell.dayNumber ? buildTooltip(cell) : undefined}
                role="gridcell"
                aria-label={
                  cell.dayNumber
                    ? `${cell.dayNumber} de ${month.format("MMMM YYYY")}: ${cell.count} eventos`
                    : "Sin datos"
                }
              >
                {cell.dayNumber ? (
                  <>
                    <span className="calendar-month-card__cell-day">{cell.dayNumber}</span>
                    <span className="calendar-month-card__cell-count">{cell.count}</span>
                  </>
                ) : null}
              </div>
            ))}
            <div
              className="calendar-month-card__week-total"
              role="gridcell"
              aria-label={`Total semana ${index + 1}: ${week.total}`}
            >
              {week.total}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default HeatmapMonth;
