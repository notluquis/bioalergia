import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CreditCard, TrendingDown } from "lucide-react";

import { personalFinanceQueries } from "@/features/personal-finance/queries";
import { formatCurrency } from "@/lib/format";

export function DashboardPersonalLiabilities() {
  const { data: credits } = useSuspenseQuery(personalFinanceQueries.list());

  // Calculate totals
  const activeCredits = credits.filter((c) => (c.remainingAmount ?? 0) > 0);
  const totalDebt = activeCredits.reduce((sum, c) => sum + (c.remainingAmount ?? 0), 0);

  // Find next payment (earliest due date from active credits nextInstallmentDate)
  // Assuming 'nextPaymentDate' or similar is on the credit object,
  // or we need to look at installments. For summary, total debt is key.

  const upcomingPayments = [...activeCredits]
    .filter((c) => c.nextPaymentDate && new Date(c.nextPaymentDate) >= new Date())
    .toSorted(
      (a, b) => new Date(a.nextPaymentDate!).getTime() - new Date(b.nextPaymentDate!).getTime(),
    );

  const nextPayment = upcomingPayments[0];

  if (activeCredits.length === 0) return null;

  return (
    <div className="card card-compact bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h3 className="text-base-content text-sm font-semibold">Pasivos Personales</h3>
          <Link className="text-primary text-xs hover:underline" to="/finanzas/loans">
            Ver todos
          </Link>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-4">
          <div className="bg-error/10 rounded-lg p-3">
            <div className="mb-1 flex items-center gap-2">
              <div className="bg-error/20 text-error rounded-md p-1.5">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="text-base-content/70 text-xs font-medium">Deuda Total</span>
            </div>
            <p className="text-error text-lg font-bold">{formatCurrency(totalDebt)}</p>
            <p className="text-base-content/60 text-xs">{activeCredits.length} créditos activos</p>
          </div>

          {nextPayment ? (
            <div className="bg-base-200/50 rounded-lg p-3">
              <div className="mb-1 flex items-center gap-2">
                <div className="bg-base-300 text-base-content/70 rounded-md p-1.5">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <span className="text-base-content/70 text-xs font-medium">Próximo Pago</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  {formatCurrency(nextPayment.nextPaymentAmount ?? 0)}
                </span>
                <span className="text-base-content/60 truncate text-xs">
                  {nextPayment.institution}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-success/10 flex flex-col justify-center rounded-lg p-3">
              <span className="text-success text-sm font-medium">Al día 🎉</span>
              <span className="text-base-content/60 text-xs">Sin pagos pendientes</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
