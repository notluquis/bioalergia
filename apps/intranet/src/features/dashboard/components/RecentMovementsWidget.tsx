import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";

import type { Transaction } from "@/features/finance/types";

import { fmtCLP } from "@/lib/format";

export default function RecentMovementsWidget({ rows }: { rows: Transaction[] }) {
  return (
    <article className="surface-recessed space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-base font-semibold drop-shadow-sm">
          Últimos movimientos
        </h3>
        <Link
          className="border-primary/45 bg-primary/15 text-primary inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase"
          to="/finanzas/statistics"
        >
          Ver más
        </Link>
      </div>
      {rows.length > 0 ? (
        <ul className="text-foreground space-y-3 text-xs">
          {rows.map((row) => (
            <li
              className="border-default-200 bg-default-50 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm"
              key={row.id}
            >
              <div>
                <p className="text-foreground font-medium">
                  {row.description ?? row.sourceId ?? "(sin descripción)"}
                </p>
                <p className="text-default-400 text-xs tracking-wide uppercase">
                  {dayjs(row.transactionDate).format("DD MMM YYYY HH:mm")}
                </p>
              </div>
              <span
                className={`text-xs font-semibold ${(row.transactionAmount ?? 0) >= 0 ? "text-success" : "text-danger"}`}
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
