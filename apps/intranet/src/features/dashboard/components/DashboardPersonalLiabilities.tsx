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
    .toSorted((a, b) => {
      // biome-ignore lint/style/noNonNullAssertion: filtered above
      return new Date(a.nextPaymentDate!).getTime() - new Date(b.nextPaymentDate!).getTime();
    });

  const nextPayment = upcomingPayments[0];

  if (activeCredits.length === 0) {
    return null;
  }

  return (
    <div className="card card-compact bg-background shadow-sm">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Pasivos Personales</h3>
          <Link className="text-primary text-xs hover:underline" to="/finanzas/loans">
            Ver todos
          </Link>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-danger/10 p-3">
            <div className="mb-1 flex items-center gap-2">
              <div className="rounded-md bg-danger/20 p-1.5 text-danger">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="font-medium text-default-600 text-xs">Deuda Total</span>
            </div>
            <p className="font-bold text-danger text-lg">{formatCurrency(totalDebt)}</p>
            <p className="text-default-500 text-xs">{activeCredits.length} créditos activos</p>
          </div>

          {nextPayment ? (
            <div className="rounded-lg bg-default-50/50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <div className="rounded-md bg-default-100 p-1.5 text-default-600">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <span className="font-medium text-default-600 text-xs">Próximo Pago</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">
                  {formatCurrency(nextPayment.nextPaymentAmount ?? 0)}
                </span>
                <span className="truncate text-default-500 text-xs">{nextPayment.institution}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center rounded-lg bg-success/10 p-3">
              <span className="font-medium text-sm text-success">Al día 🎉</span>
              <span className="text-default-500 text-xs">Sin pagos pendientes</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
