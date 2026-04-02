import { Button, Chip } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";

import type { Transaction } from "@/features/finance/types";

import { fmtCLP } from "@/lib/format";
export function RecentMovementsWidget({ rows }: { rows: Transaction[] }) {
  const navigate = useNavigate();

  return (
    <article className="surface-recessed space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-foreground">Últimos movimientos</h3>
          <p className="text-default-500 text-xs">Últimos 5 registros sincronizados</p>
        </div>
        <Button
          onPress={() => navigate({ to: "/finanzas/statistics" })}
          size="sm"
          type="button"
          variant="secondary"
        >
          Ver más
        </Button>
      </div>
      {rows.length > 0 ? (
        <ul className="space-y-3 text-foreground text-xs">
          {rows.map((row) => (
            <li
              className="flex items-start justify-between gap-3 rounded-2xl border border-default-200/70 bg-background/70 px-4 py-3 transition hover:border-default-300/80 hover:bg-background"
              key={row.id}
            >
              <div className="min-w-0">
                <Chip size="sm" variant="tertiary">
                  {row.transactionType || "movimiento"}
                </Chip>
                <p className="mt-2 truncate font-medium text-foreground">
                  {row.description ?? row.sourceId ?? "(sin descripción)"}
                </p>
                <p className="text-default-500 text-xs uppercase tracking-wide">
                  {dayjs(row.transactionDate).format("DD MMM YYYY HH:mm")}
                </p>
              </div>
              <span
                className={`shrink-0 font-semibold text-sm ${(row.transactionAmount ?? 0) >= 0 ? "text-success" : "text-danger"}`}
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
