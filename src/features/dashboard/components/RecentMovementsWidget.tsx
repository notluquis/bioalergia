import dayjs from "dayjs";
import { Link } from "react-router-dom";

import type { Transaction } from "@/features/finance/transactions/types";
import { fmtCLP } from "@/lib/format";

export default function RecentMovementsWidget({ rows }: { rows: Transaction[] }) {
  return (
    <article className="surface-recessed space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base-content text-base font-semibold drop-shadow-sm">Últimos movimientos</h3>
        <Link
          to="/transactions/movements"
          className="border-primary/45 bg-primary/15 text-primary inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase"
        >
          Ver más
        </Link>
      </div>
      {rows.length ? (
        <ul className="text-base-content space-y-3 text-xs">
          {rows.map((row) => (
            <li
              key={row.id}
              className="border-base-300 bg-base-200 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-base-content font-medium">
                  {row.description ?? row.sourceId ?? "(sin descripción)"}
                </p>
                <p className="text-base-content/50 text-xs tracking-wide uppercase">
                  {dayjs(row.transactionDate).format("DD MMM YYYY HH:mm")}
                </p>
              </div>
              <span
                className={`text-xs font-semibold ${(row.transactionAmount ?? 0) >= 0 ? "text-success" : "text-error"}`}
              >
                {fmtCLP(row.transactionAmount ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-base-content text-xs">Sin movimientos cargados aún.</p>
      )}
    </article>
  );
}
