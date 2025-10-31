import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";

interface MonthlyFlowChartProps {
  data: Array<{ month: string; in: number; out: number; net: number }>;
}

export default function MonthlyFlowChart({ data }: MonthlyFlowChartProps) {
  if (!data.length) return null;
  const maxValue = Math.max(...data.map((row) => Math.max(row.in, row.out)));
  return (
    <section className="space-y-3 bg-base-100 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Flujo mensual</h2>
        <p className="text-xs text-slate-500">Ingresos vs egresos por mes</p>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-2">
        {data.map((row) => {
          const inHeight = maxValue ? Math.max((row.in / maxValue) * 140, 4) : 4;
          const outHeight = maxValue ? Math.max((row.out / maxValue) * 140, 4) : 4;
          return (
            <div key={row.month} className="flex min-w-[80px] flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end gap-2">
                <div
                  title={`Ingresos ${fmtCLP(row.in)}`}
                  className="flex-1 rounded-t bg-emerald-500/80"
                  style={{ height: `${inHeight}px` }}
                />
                <div
                  title={`Egresos ${fmtCLP(row.out)}`}
                  className="flex-1 rounded-t bg-rose-500/80"
                  style={{ height: `${outHeight}px` }}
                />
              </div>
              <div className="text-center text-xs font-medium text-slate-600">{dayjs(row.month).format("MMM YY")}</div>
              <div className={`text-xs font-semibold ${row.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {row.net >= 0 ? fmtCLP(row.net) : `-${fmtCLP(Math.abs(row.net))}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
