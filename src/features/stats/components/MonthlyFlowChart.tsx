import dayjs from "dayjs";
import { fmtCLP } from "@/lib/format";

interface MonthlyFlowChartProps {
  data: Array<{ month: string; in: number; out: number; net: number }>;
}

export default function MonthlyFlowChart({ data }: MonthlyFlowChartProps) {
  if (!data.length) return null;
  const maxValue = Math.max(...data.map((row) => Math.max(row.in, row.out)));
  return (
    <section className="bg-base-100 space-y-3 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-primary text-lg font-semibold">Flujo mensual</h2>
        <p className="text-base-content/60 text-xs">Ingresos vs egresos por mes</p>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-2">
        {data.map((row) => {
          const inHeight = maxValue ? Math.max((row.in / maxValue) * 140, 4) : 4;
          const outHeight = maxValue ? Math.max((row.out / maxValue) * 140, 4) : 4;
          return (
            <div key={row.month} className="flex min-w-20 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end gap-2">
                <div
                  title={`Ingresos ${fmtCLP(row.in)}`}
                  className="bg-success/80 flex-1 rounded-t"
                  style={{ height: `${inHeight}px` }}
                />
                <div
                  title={`Egresos ${fmtCLP(row.out)}`}
                  className="bg-error/80 flex-1 rounded-t"
                  style={{ height: `${outHeight}px` }}
                />
              </div>
              <div className="text-base-content text-center text-xs font-medium">
                {dayjs(row.month).format("MMM YY")}
              </div>
              <div className={`text-xs font-semibold ${row.net >= 0 ? "text-success" : "text-error"}`}>
                {row.net >= 0 ? fmtCLP(row.net) : `-${fmtCLP(Math.abs(row.net))}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
