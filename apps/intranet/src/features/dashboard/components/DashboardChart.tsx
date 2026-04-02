import { Skeleton } from "@heroui/react";
import dayjs from "dayjs";

const RANGE_DAYS = 30;
export function DashboardChart({
  data,
  loading,
}: {
  data: { in: number; month: string; net: number; out: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="surface-recessed space-y-4 p-6">
        <Skeleton className="h-5 w-72 rounded-md" />
        <div className="grid grid-cols-4 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8"].map((skeletonKey) => (
            <Skeleton className="h-32 rounded-lg" key={`dashboard-chart-skeleton-${skeletonKey}`} />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="surface-recessed p-6 text-foreground text-sm">
        No se registran movimientos recientes.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((row) => Math.max(row.in, row.out)));

  return (
    <article className="surface-recessed space-y-5 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="typ-subtitle text-foreground">Actividad de los últimos {RANGE_DAYS} días</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-2 text-default-500">
            <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
            Ingresos
          </span>
          <span className="inline-flex items-center gap-2 text-default-500">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
            Egresos
          </span>
        </div>
      </div>
      <div
        className="grid items-end gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(88px, 1fr))` }}
      >
        {data.map((row) => {
          const inHeight = maxValue ? Math.max((row.in / maxValue) * 140, 4) : 4;
          const outHeight = maxValue ? Math.max((row.out / maxValue) * 140, 4) : 4;
          return (
            <div className="flex min-w-0 flex-col gap-3" key={row.month}>
              <div className="flex h-44 w-full items-end gap-3 rounded-3xl border border-default-200/70 bg-background/70 p-4">
                <div
                  className="flex-1 rounded-full bg-success/80 shadow-sm"
                  style={{ height: `${inHeight}px` }}
                />

                <div
                  className="flex-1 rounded-full bg-danger/80 shadow-sm"
                  style={{ height: `${outHeight}px` }}
                />
              </div>
              <div className="space-y-1 text-center">
                <span className="block font-medium text-foreground text-xs">
                  {dayjs(row.month).format("MMM YY")}
                </span>
                <span className="block text-[11px] text-default-500">
                  {new Intl.NumberFormat("es-CL", { notation: "compact" }).format(
                    Math.max(row.in, row.out)
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
