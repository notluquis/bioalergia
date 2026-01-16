import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

import { PayInstallmentModal } from "../components/PayInstallmentModal";
import { personalFinanceQueries } from "../queries";
import { PersonalCreditInstallment } from "../types";

export function PersonalCreditDetailsPage({ creditId }: { creditId: number }) {
  const { data: credit } = useSuspenseQuery(personalFinanceQueries.detail(creditId));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/finanzas/personal-credits"
          className="btn btn-ghost btn-sm no-animation ease-apple size-8 p-0 transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          {credit.bankName} - {credit.description || credit.creditNumber}
        </h1>
        <div className={`badge ${credit.status === "ACTIVE" ? "badge-primary" : "badge-ghost"}`}>{credit.status}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(Number(credit.totalAmount), credit.currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cuotas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {credit.installments?.filter((i: PersonalCreditInstallment) => i.status === "PAID").length} /{" "}
              {credit.totalInstallments}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabla de Amortización</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                  <th className="text-muted-foreground h-12 px-4 text-left align-middle font-medium">#</th>
                  <th className="text-muted-foreground h-12 px-4 text-left align-middle font-medium">Vencimiento</th>
                  <th className="text-muted-foreground h-12 px-4 text-right align-middle font-medium">Monto</th>
                  <th className="text-muted-foreground h-12 px-4 text-center align-middle font-medium">Estado</th>
                  <th className="text-muted-foreground h-12 px-4 text-right align-middle font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {credit.installments?.map((inst: PersonalCreditInstallment) => (
                  <tr key={inst.id} className="hover:bg-muted/50 border-b transition-colors">
                    <td className="p-4 align-middle font-medium">{inst.installmentNumber}</td>
                    <td className="p-4 align-middle">{new Date(inst.dueDate).toLocaleDateString()}</td>
                    <td className="p-4 text-right align-middle">
                      {formatCurrency(Number(inst.amount), credit.currency)}
                    </td>
                    <td className="p-4 text-center align-middle">
                      <div className={`badge ${inst.status === "PAID" ? "badge-success text-white" : "badge-outline"}`}>
                        {inst.status}
                      </div>
                    </td>
                    <td className="p-4 text-right align-middle">
                      {inst.status !== "PAID" && <PayInstallmentModal creditId={credit.id} installment={inst} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PersonalCreditDetailsPageWrapper() {
  // We need to get param from route?
  // Usually passed via props or hook in component.
  // TanStack router useRouteContext or useParams.
  // Here passed as prop if route component extracts it.
  // Wait, Route component uses `loader` logic or params.
  // Let's assume the Route component parses it and passes it, or we use `useParams`.
  const params = useParams({ from: "/_authed/finanzas/personal-credits/$creditId" }) as { creditId: string };

  return (
    <Suspense fallback={<div>Cargando detalle...</div>}>
      <PersonalCreditDetailsPage creditId={Number(params.creditId)} />
    </Suspense>
  );
}
