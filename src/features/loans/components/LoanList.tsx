import dayjs from "dayjs";
import type { LoanSummary } from "../types";
import Button from "../../../components/Button";

interface LoanListProps {
  loans: LoanSummary[];
  selectedId: string | null;
  onSelect: (publicId: string) => void;
  onCreateRequest: () => void;
  canManage: boolean;
}

export function LoanList({ loans, selectedId, onSelect, onCreateRequest, canManage }: LoanListProps) {
  return (
    <aside className="flex h-full flex-col gap-4 p-6 text-sm text-slate-600 bg-base-100">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500/90">Préstamos</h2>
          <p className="text-[11px] text-slate-500">Resumen rápido de capital y estado.</p>
        </div>
        {canManage && (
          <Button type="button" variant="primary" size="sm" onClick={onCreateRequest}>
            Nuevo préstamo
          </Button>
        )}
      </header>
      <div className="muted-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
        {loans.map((loan) => {
          const isActive = loan.public_id === selectedId;
          const paidRatio = loan.total_expected > 0 ? loan.total_paid / loan.total_expected : 0;
          const indicatorColor =
            loan.status === "COMPLETED"
              ? "bg-emerald-400"
              : loan.status === "DEFAULTED"
                ? "bg-rose-400"
                : "bg-amber-400";

          return (
            <button
              key={loan.public_id}
              type="button"
              onClick={() => onSelect(loan.public_id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-white/70 bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                  : "border-transparent bg-base-100/45 text-slate-600 hover:border-white/60 hover:bg-base-100/65"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight">{loan.title}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {loan.borrower_name} · {loan.borrower_type === "PERSON" ? "Persona" : "Empresa"}
                  </p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${indicatorColor} shadow-inner`} aria-hidden="true" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-slate-700">${loan.remaining_amount.toLocaleString("es-CL")}</span>
                <span className="text-slate-500">
                  {loan.paid_installments}/{loan.total_installments} cuotas
                </span>
                <span className="text-slate-500">Inicio {dayjs(loan.start_date).format("DD MMM YYYY")}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-base-100/60">
                <div
                  className="h-full rounded-full bg-[var(--brand-primary)]/60"
                  style={{ width: `${Math.min(100, Math.round(paidRatio * 100))}%` }}
                />
              </div>
            </button>
          );
        })}
        {!loans.length && (
          <p className="rounded-2xl border border-dashed border-white/60 bg-base-100/40 p-4 text-xs text-slate-500"> 
            Aún no registras préstamos. Crea el primero para comenzar a seguir cuotas y pagos.
          </p>
        )}
      </div>
    </aside>
  );
}

export default LoanList;
