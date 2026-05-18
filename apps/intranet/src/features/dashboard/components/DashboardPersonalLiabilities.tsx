import { Button, Surface } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { CreditCard, TrendingDown } from "lucide-react";

import { personalFinanceQueries } from "@/features/personal-finance/queries";
import { formatCurrency } from "@/lib/format";

export function DashboardPersonalLiabilities() {
  const navigate = useNavigate();
  const { data: credits } = useSuspenseQuery(personalFinanceQueries.list());

  // Calculate totals
  const activeCredits = credits.filter((c) => (c.remainingAmount ?? 0) > 0);
  const totalDebt = activeCredits.reduce((sum, c) => sum + (c.remainingAmount ?? 0), 0);

  // Find next payment (earliest due date from active credits nextInstallmentDate)
  // Assuming 'nextPaymentDate' or similar is on the credit object,
  // or we need to look at installments. For summary, total debt is key.

  const today = dayjs().startOf("day");
  type ActiveCredit = (typeof activeCredits)[number];
  type CreditWithNextPayment = ActiveCredit & { nextPaymentDate: string };

  const upcomingPayments = [...activeCredits]
    .filter((credit): credit is CreditWithNextPayment => Boolean(credit.nextPaymentDate))
    .filter((credit) => {
      const due = dayjs(credit.nextPaymentDate, "YYYY-MM-DD").startOf("day");
      return due.valueOf() >= today.valueOf();
    })
    .toSorted(
      (a, b) =>
        dayjs(a.nextPaymentDate, "YYYY-MM-DD").valueOf() -
        dayjs(b.nextPaymentDate, "YYYY-MM-DD").valueOf()
    );

  const nextPayment = upcomingPayments[0];

  if (activeCredits.length === 0) {
    return null;
  }

  return (
    <Surface className="space-y-4 rounded-3xl p-5 shadow-inner" variant="secondary">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">Pasivos Personales</h3>
        <Button
          onPress={() => {
            void navigate({ to: "/finanzas/loans" });
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          Ver todos
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-danger/10 p-4">
          <div className="mb-1 flex items-center gap-2">
            <div className="rounded-xl bg-danger-soft-hover p-1.5 text-danger">
              <CreditCard className="size-4" />
            </div>
            <span className="font-medium text-default-600 text-xs">Deuda Total</span>
          </div>
          <p className="font-bold text-danger text-lg">{formatCurrency(totalDebt)}</p>
          <p className="text-default-500 text-xs">{activeCredits.length} créditos activos</p>
        </div>

        {nextPayment ? (
          <div className="rounded-2xl bg-background/70 p-4">
            <div className="mb-1 flex items-center gap-2">
              <div className="rounded-xl bg-default-100 p-1.5 text-default-600">
                <TrendingDown className="size-4" />
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
          <div className="flex flex-col justify-center rounded-2xl bg-success/10 p-4">
            <span className="font-medium text-sm text-success">Al día</span>
            <span className="text-default-500 text-xs">Sin pagos pendientes</span>
          </div>
        )}
      </div>
    </Surface>
  );
}
