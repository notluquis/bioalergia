import dayjs from "dayjs";

import Button from "@/components/ui/Button";

import type { MonthlyExpense } from "../types";

interface MonthlyExpenseListProps {
  expenses: MonthlyExpense[];
  onCreateRequest?: () => void;
  onSelect: (publicId: string) => void;
  selectedId: null | string;
}

export default function MonthlyExpenseList({
  expenses,
  onCreateRequest,
  onSelect,
  selectedId,
}: MonthlyExpenseListProps) {
  return (
    <div className="muted-scrollbar h-full overflow-y-auto pr-2">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="font-semibold text-default-500 text-sm uppercase tracking-wide">Gastos</h2>
          <p className="text-default-400 text-xs">Registros de gastos mensuales y puntuales.</p>
        </div>
        {onCreateRequest && (
          <Button onClick={onCreateRequest} size="sm" type="button" variant="secondary">
            Nuevo
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {expenses.map((expense) => {
          const isActive = expense.publicId === selectedId;
          return (
            <button
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-primary/40 bg-primary/15 text-primary shadow"
                  : "border-transparent bg-background/55 text-foreground hover:border-default-200 hover:bg-default-50"
              }`}
              key={expense.publicId}
              onClick={() => {
                onSelect(expense.publicId);
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground text-sm">{expense.name}</p>
                  {expense.category && (
                    <p className="text-default-400 text-xs uppercase tracking-wide">
                      {expense.category}
                    </p>
                  )}
                </div>
                <span className="font-semibold text-foreground text-sm">
                  ${expense.amountExpected.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-default-400 text-xs">
                <span>{dayjs(expense.expenseDate).format("DD MMM YYYY")}</span>
                <span>{expense.transactionCount} transacciones</span>
                <span>{expense.status === "OPEN" ? "Pendiente" : "Cerrado"}</span>
              </div>
            </button>
          );
        })}
        {expenses.length === 0 && (
          <p className="rounded-2xl border border-default-200 border-dashed bg-default-50 p-4 text-default-500 text-xs">
            Aún no registras gastos. Crea el primero para llevar control mensual.
          </p>
        )}
      </div>
    </div>
  );
}
