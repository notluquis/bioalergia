import dayjs from "dayjs";
import type { MonthlyExpense } from "../types";
import Button from "../../../components/ui/Button";

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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">Gastos</h2>
          <p className="text-xs text-base-content/50">Registros de gastos mensuales y puntuales.</p>
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
                  ? "border-primary/40 bg-primary/15 text-primary shadow"
                  : "border-transparent bg-base-100/55 text-base-content hover:border-base-300 hover:bg-base-200"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-base-content">{expense.name}</p>
                  {expense.category && (
                    <p className="text-xs uppercase tracking-wide text-base-content/50">{expense.category}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-base-content">
                  ${expense.amountExpected.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-base-content/50">
                <span>{dayjs(expense.expenseDate).format("DD MMM YYYY")}</span>
                <span>{expense.transactionCount} transacciones</span>
                <span>{expense.status === "OPEN" ? "Pendiente" : "Cerrado"}</span>
              </div>
            </button>
          );
        })}
        {!expenses.length && (
          <p className="rounded-2xl border border-dashed border-base-300 bg-base-200 p-4 text-xs text-base-content/60">
            Aún no registras gastos. Crea el primero para llevar control mensual.
          </p>
        )}
      </div>
    </div>
  );
}
