import dayjs from "dayjs";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

import type { MonthlyExpenseDetail as MonthlyExpenseDetailData } from "../types";

interface MonthlyExpenseDetailProps {
  canManage: boolean;
  expense: MonthlyExpenseDetailData | null;
  loading: boolean;
  onEdit?: () => void;
  onLinkTransaction: () => void;
  onUnlinkTransaction: (transactionId: number) => void;
}
export function MonthlyExpenseDetail({
  canManage,
  expense,
  loading,
  onEdit,
  onLinkTransaction,
  onUnlinkTransaction,
}: MonthlyExpenseDetailProps) {
  if (loading) {
    return <p className="text-default-500 text-xs">Cargando gasto…</p>;
  }

  if (!expense) {
    return <Alert status="warning">Selecciona un gasto para ver el detalle.</Alert>;
  }

  return (
    <section className="space-y-4 border border-default-200 bg-background p-4 text-foreground text-sm">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="break-all font-semibold text-primary text-xl">{expense.name}</h2>
          <p className="text-default-400 text-xs">
            {expense.category || "Sin categoría"} ·{" "}
            {dayjs(expense.expenseDate).format("DD MMM YYYY")}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {onEdit && (
              <Button onClick={onEdit} size="sm" variant="secondary">
                Editar
              </Button>
            )}
            <Button onClick={onLinkTransaction} size="sm">
              Vincular transacción
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <DetailCard
          title="Monto esperado"
          value={`$${expense.amountExpected.toLocaleString("es-CL")}`}
        />

        <DetailCard
          title="Monto aplicado"
          value={`$${expense.amountApplied.toLocaleString("es-CL")}`}
        />

        <DetailCard title="Estado" value={expense.status === "OPEN" ? "Pendiente" : "Cerrado"} />
        <DetailCard
          helper="Registros conciliados"
          title="Transacciones asociadas"
          value={`${expense.transactionCount}`}
        />
      </div>

      {expense.notes && (
        <p className="rounded-xl bg-background/60 p-3 text-default-500 text-xs">{expense.notes}</p>
      )}

      <section className="space-y-2">
        <h3 className="font-semibold text-default-500 text-xs uppercase tracking-wide">
          Transacciones
        </h3>
        <div className="muted-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
          {expense.transactions.map((tx) => (
            <article
              className="rounded-xl border border-default-200 bg-default-50 p-3 shadow-inner"
              key={tx.transactionId}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground text-sm">ID #{tx.transactionId}</p>
                  <p className="text-default-400 text-xs">
                    {tx.description ?? "(sin descripción)"}
                  </p>
                </div>
                <span className="font-semibold text-foreground text-sm">
                  ${tx.amount.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="mt-1 text-default-400 text-xs">
                {dayjs(tx.timestamp).format("DD MMM YYYY HH:mm")} · {tx.direction}
              </div>
              {canManage && (
                <div className="mt-2 flex justify-end">
                  <Button
                    onClick={() => {
                      onUnlinkTransaction(tx.transactionId);
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    Desvincular
                  </Button>
                </div>
              )}
            </article>
          ))}
          {expense.transactions.length === 0 && (
            <p className="rounded-xl border border-default-200 border-dashed bg-default-50 p-3 text-default-500 text-xs">
              Aún no se han vinculado transacciones a este gasto.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

function DetailCard({ helper, title, value }: { helper?: string; title: string; value: string }) {
  return (
    <article className="rounded-xl border border-default-200 bg-default-50 p-3 shadow-sm">
      <p className="font-semibold text-default-500 text-xs uppercase tracking-wide">{title}</p>
      <p className="mt-1 font-semibold text-foreground text-lg">{value}</p>
      {helper && <p className="text-default-400 text-xs">{helper}</p>}
    </article>
  );
}
