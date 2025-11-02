import dayjs from "dayjs";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";
import type { MonthlyExpenseDetail as MonthlyExpenseDetailData } from "../types";

interface MonthlyExpenseDetailProps {
  expense: MonthlyExpenseDetailData | null;
  loading: boolean;
  canManage: boolean;
  onEdit?: () => void;
  onLinkTransaction: () => void;
  onUnlinkTransaction: (transactionId: number) => void;
}

export default function MonthlyExpenseDetail({
  expense,
  loading,
  canManage,
  onEdit,
  onLinkTransaction,
  onUnlinkTransaction,
}: MonthlyExpenseDetailProps) {
  if (loading) {
    return <p className="text-xs text-slate-500">Cargando gasto…</p>;
  }

  if (!expense) {
    return <Alert variant="warning">Selecciona un gasto para ver el detalle.</Alert>;
  }

  return (
    <section className="space-y-4 border border-white/40 p-4 text-sm text-slate-600 bg-base-100">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-(--brand-primary)">{expense.name}</h2>
          <p className="text-xs text-slate-400">
            {expense.category || "Sin categoría"} · {dayjs(expense.expenseDate).format("DD MMM YYYY")}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="secondary" size="sm" onClick={onEdit}>
                Editar
              </Button>
            )}
            <Button size="sm" onClick={onLinkTransaction}>
              Vincular transacción
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <DetailCard title="Monto esperado" value={`$${expense.amountExpected.toLocaleString("es-CL")}`} />
        <DetailCard title="Monto aplicado" value={`$${expense.amountApplied.toLocaleString("es-CL")}`} />
        <DetailCard title="Estado" value={expense.status === "OPEN" ? "Pendiente" : "Cerrado"} />
        <DetailCard
          title="Transacciones asociadas"
          value={`${expense.transactionCount}`}
          helper="Registros conciliados"
        />
      </div>

      {expense.notes && <p className="rounded-xl bg-base-100/60 p-3 text-xs text-slate-500">{expense.notes}</p>}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transacciones</h3>
        <div className="muted-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
          {expense.transactions.map((tx) => (
            <article
              key={tx.transactionId}
              className="rounded-xl border border-white/50 bg-base-100/80 p-3 shadow-inner"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">ID #{tx.transactionId}</p>
                  <p className="text-xs text-slate-400">{tx.description ?? "(sin descripción)"}</p>
                </div>
                <span className="text-sm font-semibold text-slate-600">${tx.amount.toLocaleString("es-CL")}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {dayjs(tx.timestamp).format("DD MMM YYYY HH:mm")} · {tx.direction}
              </div>
              {canManage && (
                <div className="mt-2 flex justify-end">
                  <Button size="xs" variant="secondary" onClick={() => onUnlinkTransaction(tx.transactionId)}>
                    Desvincular
                  </Button>
                </div>
              )}
            </article>
          ))}
          {!expense.transactions.length && (
            <p className="rounded-xl border border-dashed border-white/50 bg-base-100/60 p-3 text-xs text-slate-500">
              Aún no se han vinculado transacciones a este gasto.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

function DetailCard({ title, value, helper }: { title: string; value: string; helper?: string }) {
  return (
    <article className="rounded-xl border border-white/45 bg-base-100/70 p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
      {helper && <p className="text-xs text-slate-400">{helper}</p>}
    </article>
  );
}
