import dayjs from "dayjs";

const RANGE_DAYS = 30;

export default function DashboardChart({
  data,
  loading,
}: {
  data: Array<{ month: string; in: number; out: number; net: number }>;
  loading: boolean;
}) {
  if (loading) {
    return <div className="p-6 text-sm text-base-content bg-base-100">Cargando actividad...</div>;
  }

  if (!data.length) {
    return <div className="p-6 text-sm text-base-content bg-base-100">No se registran movimientos recientes.</div>;
  }

  const maxValue = Math.max(...data.map((row) => Math.max(row.in, row.out)));

  return (
    <article className="space-y-4 p-6 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-(--brand-primary) drop-shadow-sm">
          Actividad de los últimos {RANGE_DAYS} días
        </h2>
        <span className="rounded-full border border-white/60 bg-base-100/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/70">
          Ingresos vs egresos
        </span>
      </div>
      <div className="muted-scrollbar flex items-end gap-4 overflow-x-auto pb-2">
        {data.map((row) => {
          const inHeight = maxValue ? Math.max((row.in / maxValue) * 140, 4) : 4;
          const outHeight = maxValue ? Math.max((row.out / maxValue) * 140, 4) : 4;
          return (
            <div key={row.month} className="flex min-w-20 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end gap-2 rounded-xl border border-white/50 bg-base-100/50 p-2">
                <div
                  className="flex-1 rounded-full bg-emerald-500/80 shadow-[0_12px_24px_-15px_rgba(16,37,66,0.35)]"
                  style={{ height: `${inHeight}px` }}
                />
                <div
                  className="flex-1 rounded-full bg-rose-500/80 shadow-[0_12px_24px_-15px_rgba(16,37,66,0.35)]"
                  style={{ height: `${outHeight}px` }}
                />
              </div>
              <span className="text-xs font-medium text-base-content">{dayjs(row.month).format("MMM YY")}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
