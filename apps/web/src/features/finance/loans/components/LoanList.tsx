import dayjs from "dayjs";

import Button from "@/components/ui/Button";

import type { LoanSummary } from "../types";

interface LoanListProps {
  readonly canManage: boolean;
  readonly loans: LoanSummary[];
  readonly onCreateRequest: () => void;
  readonly onSelect: (publicId: string) => void;
  readonly selectedId: null | string;
}

export function LoanList({ canManage, loans, onCreateRequest, onSelect, selectedId }: LoanListProps) {
  return (
    <aside className="text-base-content bg-base-100 flex h-full flex-col gap-4 p-6 text-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base-content/90 text-xs font-semibold tracking-wide uppercase">Préstamos</h2>
          <p className="text-base-content/60 text-xs">Resumen rápido de capital y estado.</p>
        </div>
        {canManage && (
          <Button onClick={onCreateRequest} size="sm" type="button" variant="primary">
            Nuevo préstamo
          </Button>
        )}
      </header>
      <div className="muted-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
        {loans.map((loan) => {
          const isActive = loan.public_id === selectedId;
          const paidRatio = loan.total_expected > 0 ? loan.total_paid / loan.total_expected : 0;
          const indicatorColors = {
            ACTIVE: "bg-warning",
            COMPLETED: "bg-success",
            DEFAULTED: "bg-error",
          };
          const indicatorColor = indicatorColors[loan.status];

          return (
            <button
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-base-300 bg-primary/20 text-primary"
                  : "bg-base-200 text-base-content hover:border-base-300 hover:bg-base-200 border-transparent"
              }`}
              key={loan.public_id}
              onClick={() => {
                onSelect(loan.public_id);
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight">{loan.title}</p>
                  <p className="text-base-content/50 text-xs tracking-wide uppercase">
                    {loan.borrower_name} · {loan.borrower_type === "PERSON" ? "Persona" : "Empresa"}
                  </p>
                </div>
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${indicatorColor} shadow-inner`} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                <span className="text-base-content font-semibold">
                  ${loan.remaining_amount.toLocaleString("es-CL")}
                </span>
                <span className="text-base-content/60">
                  {loan.paid_installments}/{loan.total_installments} cuotas
                </span>
                <span className="text-base-content/60">Inicio {dayjs(loan.start_date).format("DD MMM YYYY")}</span>
              </div>
              <div className="bg-base-100/60 mt-2 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary/60 h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.round(paidRatio * 100))}%` }}
                />
              </div>
            </button>
          );
        })}
        {loans.length === 0 && (
          <p className="border-base-300 bg-base-200 text-base-content/60 rounded-2xl border border-dashed p-4 text-xs">
            Aún no registras préstamos. Crea el primero para comenzar a seguir cuotas y pagos.
          </p>
        )}
      </div>
    </aside>
  );
}

export default LoanList;
