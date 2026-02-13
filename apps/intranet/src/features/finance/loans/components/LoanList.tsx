import dayjs from "dayjs";

import { Button } from "@/components/ui/Button";

import type { LoanSummary } from "../types";

interface LoanListProps {
  readonly canManage: boolean;
  readonly loans: LoanSummary[];
  readonly onCreateRequest: () => void;
  readonly onSelect: (publicId: string) => void;
  readonly selectedId: null | string;
}

export function LoanList({
  canManage,
  loans,
  onCreateRequest,
  onSelect,
  selectedId,
}: LoanListProps) {
  return (
    <aside className="flex h-full flex-col gap-4 bg-background p-6 text-foreground text-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground/90 text-xs uppercase tracking-wide">
            Préstamos
          </h2>
          <p className="text-default-500 text-xs">Resumen rápido de capital y estado.</p>
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
            DEFAULTED: "bg-danger",
          };
          const indicatorColor = indicatorColors[loan.status];

          return (
            <Button
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-default-200 bg-primary/20 text-primary"
                  : "border-transparent bg-default-50 text-foreground hover:border-default-200 hover:bg-default-50"
              }`}
              key={loan.public_id}
              onPress={() => {
                onSelect(loan.public_id);
              }}
              type="button"
              variant="ghost"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm tracking-tight">{loan.title}</p>
                  <p className="text-default-400 text-xs uppercase tracking-wide">
                    {loan.borrower_name} · {loan.borrower_type === "PERSON" ? "Persona" : "Empresa"}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full ${indicatorColor} shadow-inner`}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-foreground">
                  ${loan.remaining_amount.toLocaleString("es-CL")}
                </span>
                <span className="text-default-500">
                  {loan.paid_installments}/{loan.total_installments} cuotas
                </span>
                <span className="text-default-500">
                  Inicio {dayjs(loan.start_date, "YYYY-MM-DD").format("DD MMM YYYY")}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full rounded-full bg-primary/60"
                  style={{ width: `${Math.min(100, Math.round(paidRatio * 100))}%` }}
                />
              </div>
            </Button>
          );
        })}
        {loans.length === 0 && (
          <p className="rounded-2xl border border-default-200 border-dashed bg-default-50 p-4 text-default-500 text-xs">
            Aún no registras préstamos. Crea el primero para comenzar a seguir cuotas y pagos.
          </p>
        )}
      </div>
    </aside>
  );
}
