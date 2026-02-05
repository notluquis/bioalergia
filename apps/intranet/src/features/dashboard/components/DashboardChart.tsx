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
      <div className="surface-recessed p-6 text-foreground text-sm">Cargando actividad...</div>
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
    <article className="surface-recessed space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="typ-subtitle text-foreground">Actividad de los últimos {RANGE_DAYS} días</h2>
        <span className="typ-caption rounded-full border border-default-200 bg-default-50 px-3 py-1 text-default-600">
          Ingresos vs egresos
        </span>
      </div>
      <div className="muted-scrollbar flex items-end gap-4 overflow-x-auto pb-2">
        {data.map((row) => {
          const inHeight = maxValue ? Math.max((row.in / maxValue) * 140, 4) : 4;
          const outHeight = maxValue ? Math.max((row.out / maxValue) * 140, 4) : 4;
          return (
            <div className="flex min-w-20 flex-col items-center gap-2" key={row.month}>
              <div className="flex h-40 w-full items-end gap-2 rounded-xl border border-default-200 bg-default-50 p-2">
                <div
                  className="flex-1 rounded-full bg-success/80 shadow-sm"
                  style={{ height: `${inHeight}px` }}
                />

                <div
                  className="flex-1 rounded-full bg-danger/80 shadow-sm"
                  style={{ height: `${outHeight}px` }}
                />
              </div>
              <span className="font-medium text-foreground text-xs">
                {dayjs(row.month).format("MMM YY")}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
