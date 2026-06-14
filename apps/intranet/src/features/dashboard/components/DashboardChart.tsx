import { formatChile } from "@/lib/dates";
import { fmtCLP } from "@/lib/format";
import { Skeleton } from "@heroui/react";

const RANGE_DAYS = 30;
const HALF_AREA_PX = 78;
const MIN_BAR_PX = 2;
const MAX_LABELS = 8;

export function DashboardChart({
  data,
  loading,
}: {
  data: { in: number; month: string; net: number; out: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="surface-recessed space-y-4 rounded-[28px] p-6">
        <Skeleton className="h-5 w-72 rounded-md" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="surface-recessed rounded-[28px] p-6 text-foreground text-sm">
        No se registran movimientos recientes.
      </div>
    );
  }

  // Stats may emit `out` as a negative magnitude depending on the grouping —
  // normalize to absolute values so bar heights always render upward.
  const magnitude = (row: { in: number; out: number }) => ({
    in: Math.abs(row.in),
    out: Math.abs(row.out),
  });

  const maxValue = Math.max(
    1,
    ...data.map((row) => Math.max(magnitude(row).in, magnitude(row).out))
  );
  const totalIn = data.reduce((acc, row) => acc + magnitude(row).in, 0);
  const totalOut = data.reduce((acc, row) => acc + magnitude(row).out, 0);
  const net = totalIn - totalOut;

  // Sparse x labels — a 30-day series can't show every tick legibly.
  const labelStride = Math.max(1, Math.ceil(data.length / MAX_LABELS));

  return (
    <article className="surface-recessed space-y-5 rounded-[28px] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="typ-subtitle text-foreground">
            Actividad de los últimos {RANGE_DAYS} días
          </h2>
          <p className="text-default-500 text-xs">Ingresos y egresos diarios sincronizados.</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <SummaryStat label="Ingresos" tone="success" value={totalIn} />
          <SummaryStat label="Egresos" tone="danger" value={totalOut} />
          <SummaryStat label="Neto" tone={net >= 0 ? "success" : "danger"} value={net} />
        </div>
      </div>

      <div className="relative rounded-[24px] border border-default-200/70 bg-background/60 p-4">
        <div className="flex items-stretch gap-px" style={{ height: `${HALF_AREA_PX * 2}px` }}>
          {data.map((row) => {
            const { in: inMag, out: outMag } = magnitude(row);
            const inHeight =
              inMag > 0 ? Math.max((inMag / maxValue) * HALF_AREA_PX, MIN_BAR_PX) : 0;
            const outHeight =
              outMag > 0 ? Math.max((outMag / maxValue) * HALF_AREA_PX, MIN_BAR_PX) : 0;
            const label = formatChile(row.month, "DD MMM");

            return (
              <div
                aria-label={`${label}: ingresos ${fmtCLP(inMag)}, egresos ${fmtCLP(outMag)}`}
                className="group flex flex-1 flex-col justify-center"
                key={row.month}
                title={`${label}\nIngresos ${fmtCLP(inMag)}\nEgresos ${fmtCLP(outMag)}`}
              >
                {/* income — grows up from the center baseline */}
                <div className="flex flex-1 items-end">
                  <div
                    className="w-full rounded-t-[4px] bg-success/70 transition group-hover:bg-success"
                    style={{ height: `${inHeight}px` }}
                  />
                </div>
                <div className="h-px w-full bg-default-300/70" />
                {/* expense — grows down from the center baseline */}
                <div className="flex flex-1 items-start">
                  <div
                    className="w-full rounded-b-[4px] bg-danger/70 transition group-hover:bg-danger"
                    style={{ height: `${outHeight}px` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex gap-px text-[10px] text-default-500">
          {data.map((row, index) => (
            <span className="flex-1 text-center" key={`label-${row.month}`}>
              {index % labelStride === 0 ? formatChile(row.month, "DD/MM") : ""}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function SummaryStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "success";
  value: number;
}) {
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-default-500">
        <span
          className={`rounded-full size-2.5 ${tone === "success" ? "bg-success/80" : "bg-danger/80"}`}
        />
        {label}
      </span>
      <span
        className={`font-semibold text-sm ${tone === "success" ? "text-success" : "text-danger"}`}
      >
        {fmtCLP(value)}
      </span>
    </span>
  );
}
