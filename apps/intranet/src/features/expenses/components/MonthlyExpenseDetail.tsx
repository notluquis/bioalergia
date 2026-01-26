import dayjs from "dayjs";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";

import type { MonthlyExpenseDetail as MonthlyExpenseDetailData } from "../types";

interface MonthlyExpenseDetailProps {
  canManage: boolean;
  expense: MonthlyExpenseDetailData | null;
  loading: boolean;
  onEdit?: () => void;
  onLinkTransaction: () => void;
  onUnlinkTransaction: (transactionId: number) => void;
}

export default function MonthlyExpenseDetail({
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
    return <Alert variant="warning">Selecciona un gasto para ver el detalle.</Alert>;
  }

  return (
    <section className="border-default-200 text-foreground bg-background space-y-4 border p-4 text-sm">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-primary text-xl font-semibold break-all">{expense.name}</h2>
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
        <p className="bg-background/60 text-default-500 rounded-xl p-3 text-xs">{expense.notes}</p>
      )}

      <section className="space-y-2">
        <h3 className="text-default-500 text-xs font-semibold tracking-wide uppercase">
          Transacciones
        </h3>
        <div className="muted-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
          {expense.transactions.map((tx) => (
            <article
              className="border-default-200 bg-default-50 rounded-xl border p-3 shadow-inner"
              key={tx.transactionId}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-foreground text-sm font-semibold">ID #{tx.transactionId}</p>
                  <p className="text-default-400 text-xs">
                    {tx.description ?? "(sin descripción)"}
                  </p>
                </div>
                <span className="text-foreground text-sm font-semibold">
                  ${tx.amount.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="text-default-400 mt-1 text-xs">
                {dayjs(tx.timestamp).format("DD MMM YYYY HH:mm")} · {tx.direction}
              </div>
              {canManage && (
                <div className="mt-2 flex justify-end">
                  <Button
                    onClick={() => {
                      onUnlinkTransaction(tx.transactionId);
                    }}
                    size="xs"
                    variant="secondary"
                  >
                    Desvincular
                  </Button>
                </div>
              )}
            </article>
          ))}
          {expense.transactions.length === 0 && (
            <p className="border-default-200 bg-default-50 text-default-500 rounded-xl border border-dashed p-3 text-xs">
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
    <article className="border-default-200 bg-default-50 rounded-xl border p-3 shadow-sm">
      <p className="text-default-500 text-xs font-semibold tracking-wide uppercase">{title}</p>
      <p className="text-foreground mt-1 text-lg font-semibold">{value}</p>
      {helper && <p className="text-default-400 text-xs">{helper}</p>}
    </article>
  );
}
