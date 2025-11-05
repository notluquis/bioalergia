import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";
import type { DbMovement } from "../../transactions/types";

export default function RecentMovementsWidget({ rows }: { rows: DbMovement[] }) {
  return (
    <article className="space-y-4 p-6 bg-base-100">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-base-content drop-shadow-sm">Últimos movimientos</h3>
        <Link
          to="/transactions/movements"
          className="inline-flex items-center rounded-full border border-primary/45 bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
        >
          Ver más
        </Link>
      </div>
      {rows.length ? (
        <ul className="space-y-3 text-xs text-base-content">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-base-300 bg-base-200 px-4 py-3 shadow-[0_10px_24px_-16px_rgba(16,37,66,0.4)]"
            >
              <div>
                <p className="font-medium text-base-content">
                  {row.description ?? row.source_id ?? "(sin descripción)"}
                </p>
                <p className="text-xs uppercase tracking-wide text-base-content/50">
                  {dayjs(row.timestamp).format("DD MMM YYYY HH:mm")}
                </p>
              </div>
              <span
                className={`text-xs font-semibold ${
                  row.direction === "IN"
                    ? "text-emerald-600"
                    : row.direction === "OUT"
                      ? "text-rose-600"
                      : "text-base-content/70"
                }`}
              >
                {row.direction === "OUT" ? `-${fmtCLP(row.amount ?? 0)}` : fmtCLP(row.amount ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-base-content">Sin movimientos cargados aún.</p>
      )}
    </article>
  );
}
