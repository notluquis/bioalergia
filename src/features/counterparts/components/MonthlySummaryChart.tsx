import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";

interface MonthlySummaryChartProps {
  data: Array<{ month: string; concept: string; total: number }>;
}

export default function MonthlySummaryChart({ data }: MonthlySummaryChartProps) {
  if (!data.length) {
    return <p className="text-xs text-base-content">Sin movimientos en el rango seleccionado.</p>;
  }
  const grouped = data.reduce<Record<string, number>>((acc, row) => {
    const key = row.month;
    acc[key] = (acc[key] ?? 0) + row.total;
    return acc;
  }, {});
  const max = Math.max(...Object.values(grouped));
  return (
    <div className="muted-scrollbar overflow-x-auto">
      <div className="flex items-end gap-4 pb-2">
        {Object.entries(grouped)
          .sort(([a], [b]) => (a > b ? 1 : -1))
          .map(([month, total]) => {
            const height = max ? Math.max((total / max) * 140, 4) : 4;
            return (
              <div key={month} className="flex min-w-[72px] flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end rounded-2xl border border-base-300 bg-base-200 p-1">
                  <div
                    className="w-full rounded-full bg-primary/70 shadow-[0_12px_24px_-18px_rgba(16,37,66,0.4)]"
                    style={{ height: `${height}px` }}
                  />
                </div>
                <span className="text-xs font-medium text-base-content">{dayjs(month).format("MMM YY")}</span>
                <span className="text-xs font-semibold text-primary">{fmtCLP(total)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
