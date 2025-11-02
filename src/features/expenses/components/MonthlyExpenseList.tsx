import dayjs from "dayjs";
import type { MonthlyExpense } from "../types";
import Button from "../../../components/Button";

interface MonthlyExpenseListProps {
  expenses: MonthlyExpense[];
  selectedId: string | null;
  onSelect: (publicId: string) => void;
  onCreateRequest?: () => void;
}

export default function MonthlyExpenseList({
  expenses,
  selectedId,
  onSelect,
  onCreateRequest,
}: MonthlyExpenseListProps) {
  return (
    <div className="muted-scrollbar h-full overflow-y-auto pr-2">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Gastos</h2>
          <p className="text-xs text-slate-400">Registros de gastos mensuales y puntuales.</p>
        </div>
        {onCreateRequest && (
          <Button type="button" variant="secondary" size="sm" onClick={onCreateRequest}>
            Nuevo
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {expenses.map((expense) => {
          const isActive = expense.publicId === selectedId;
          return (
            <button
              key={expense.publicId}
              type="button"
              onClick={() => onSelect(expense.publicId)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-(--brand-primary)/40 bg-(--brand-primary)/15 text-(--brand-primary) shadow"
                  : "border-transparent bg-base-100/55 text-slate-600 hover:border-white/60 hover:bg-base-100/70"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{expense.name}</p>
                  {expense.category && (
                    <p className="text-xs uppercase tracking-wide text-slate-400">{expense.category}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-slate-600">
                  ${expense.amountExpected.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>{dayjs(expense.expenseDate).format("DD MMM YYYY")}</span>
                <span>{expense.transactionCount} transacciones</span>
                <span>{expense.status === "OPEN" ? "Pendiente" : "Cerrado"}</span>
              </div>
            </button>
          );
        })}
        {!expenses.length && (
          <p className="rounded-2xl border border-dashed border-white/60 bg-base-100/40 p-4 text-xs text-slate-500">
            Aún no registras gastos. Crea el primero para llevar control mensual.
          </p>
        )}
      </div>
    </div>
  );
}
