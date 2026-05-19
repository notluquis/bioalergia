import { Button, Chip } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";

import type { Transaction } from "@/features/finance/types";

import { fmtCLP } from "@/lib/format";

function getDisplayAmount(row: Transaction) {
  if (typeof row.settlementNetAmount === "number" && row.settlementNetAmount !== 0) {
    return row.transactionAmount != null && row.transactionAmount < 0
      ? -Math.abs(row.settlementNetAmount)
      : row.settlementNetAmount;
  }

  return row.transactionAmount ?? 0;
}

export function RecentMovementsWidget({ rows }: { rows: Transaction[] }) {
  const navigate = useNavigate();

  return (
    <article className="surface-recessed space-y-4 rounded-[28px] p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-foreground">Últimos movimientos</h3>
          <p className="text-default-500 text-xs">Últimos 5 registros sincronizados</p>
        </div>
        <Button
          onPress={() => {
            void navigate({ to: "/finanzas/dashboard", search: { tab: "estadisticas" } });
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          Ver más
        </Button>
      </div>
      {rows.length > 0 ? (
        <ul className="space-y-3 text-foreground text-xs">
          {rows.map((row) => {
            const amount = getDisplayAmount(row);

            return (
              <li
                className="flex items-start justify-between gap-3 rounded-[22px] border border-default-200/70 bg-background/70 px-4 py-3 transition hover:border-default-300/80 hover:bg-background"
                key={row.id}
              >
                <div className="min-w-0">
                  <Chip size="sm" variant="tertiary">
                    {row.transactionType || "movimiento"}
                  </Chip>
                  <p className="mt-2 line-clamp-2 font-medium text-foreground text-sm">
                    {row.description ?? row.sourceId ?? "(sin descripción)"}
                  </p>
                  <p className="text-default-500 text-xs uppercase tracking-wide">
                    {dayjs(row.transactionDate).tz().format("DD MMM YYYY HH:mm")}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-semibold text-sm ${amount >= 0 ? "text-success" : "text-danger"}`}
                >
                  {fmtCLP(amount)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-foreground text-xs">Sin movimientos cargados aún.</p>
      )}
    </article>
  );
}
