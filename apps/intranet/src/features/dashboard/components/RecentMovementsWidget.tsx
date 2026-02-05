import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";

import type { Transaction } from "@/features/finance/types";

import { fmtCLP } from "@/lib/format";
export function RecentMovementsWidget({ rows }: { rows: Transaction[] }) {
  return (
    <article className="surface-recessed space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base text-foreground drop-shadow-sm">
          Últimos movimientos
        </h3>
        <Link
          className="inline-flex items-center rounded-full border border-primary/45 bg-primary/15 px-3 py-1 font-semibold text-primary text-xs uppercase tracking-wide"
          to="/finanzas/statistics"
        >
          Ver más
        </Link>
      </div>
      {rows.length > 0 ? (
        <ul className="space-y-3 text-foreground text-xs">
          {rows.map((row) => (
            <li
              className="flex items-start justify-between gap-3 rounded-2xl border border-default-200 bg-default-50 px-4 py-3 shadow-sm"
              key={row.id}
            >
              <div>
                <p className="font-medium text-foreground">
                  {row.description ?? row.sourceId ?? "(sin descripción)"}
                </p>
                <p className="text-default-400 text-xs uppercase tracking-wide">
                  {dayjs(row.transactionDate).format("DD MMM YYYY HH:mm")}
                </p>
              </div>
              <span
                className={`font-semibold text-xs ${(row.transactionAmount ?? 0) >= 0 ? "text-success" : "text-danger"}`}
              >
                {fmtCLP(row.transactionAmount ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-foreground text-xs">Sin movimientos cargados aún.</p>
      )}
    </article>
  );
}
