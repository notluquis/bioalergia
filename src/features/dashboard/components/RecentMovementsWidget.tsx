import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";
import type { DbMovement } from "../../transactions/types";

export default function RecentMovementsWidget({ rows }: { rows: DbMovement[] }) {
  return (
    <article className="glass-card glass-underlay-gradient space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-700 drop-shadow-sm">Últimos movimientos</h3>
        <Link
          to="/transactions/movements"
          className="inline-flex items-center rounded-full border border-[var(--brand-primary)]/45 bg-[var(--brand-primary)]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-primary)]"
        >
          Ver más
        </Link>
      </div>
      {rows.length ? (
        <ul className="space-y-3 text-xs text-slate-600">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-white/55 bg-white/55 px-4 py-3 shadow-[0_10px_24px_-16px_rgba(16,37,66,0.4)]"
            >
              <div>
                <p className="font-medium text-slate-700">{row.description ?? row.source_id ?? "(sin descripción)"}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  {dayjs(row.timestamp).format("DD MMM YYYY HH:mm")}
                </p>
              </div>
              <span
                className={`text-xs font-semibold ${
                  row.direction === "IN"
                    ? "text-emerald-600"
                    : row.direction === "OUT"
                      ? "text-rose-600"
                      : "text-slate-500"
                }`}
              >
                {row.direction === "OUT" ? `-${fmtCLP(row.amount ?? 0)}` : fmtCLP(row.amount ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-600">Sin movimientos cargados aún.</p>
      )}
    </article>
  );
}
