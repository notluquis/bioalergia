import { Button, Chip, Spinner } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Suspense, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { CreateCreditForm } from "../components/CreateCreditForm";
import { CreditDetailsModal } from "../components/CreditDetailsModal";
import { useCreditPaidAmounts } from "../hooks/useCreditPaidAmounts";
import { personalFinanceQueries } from "../queries";
import type { PersonalCredit } from "../types";

/**
 * Celda que muestra el total pagado de un crédito
 * Para créditos en UF, muestra dual: monto en UF + equivalente en CLP
 */
function TotalPaidCell({ credit }: { credit: PersonalCredit }) {
  const { totalPaid, totalPaidCLP, isLoading } = useCreditPaidAmounts(credit);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <span className="text-xs text-muted">Calculando...</span>
      </div>
    );
  }

  // Para créditos en UF, mostrar dual
  if (credit.currency === "UF" && totalPaidCLP !== null) {
    return (
      <div className="space-y-0.5">
        <div className="font-medium">{formatCurrency(totalPaid, "UF")}</div>
        <div className="text-xs text-muted">≈ {formatCurrency(totalPaidCLP, "CLP")}</div>
      </div>
    );
  }

  // Para créditos en CLP o sin datos CLP
  return <div className="font-medium">{formatCurrency(totalPaid, credit.currency || "CLP")}</div>;
}

const TableData = ({
  credits,
  onSelectCredit,
}: {
  credits: PersonalCredit[];
  onSelectCredit: (id: number) => void;
}) => {
  const paid = (credit: PersonalCredit) =>
    credit.installments?.filter((i) => i.status === "PAID").length || 0;
  const total = (credit: PersonalCredit) => credit.totalInstallments || 1;
  const nextDueDate = (credit: PersonalCredit) => {
    const pending = credit.installments
      ?.filter((i) => i.status === "PENDING")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return pending?.[0]?.dueDate;
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-default-200 bg-default-50">
            <th className="px-4 py-3 text-left font-semibold">Banco</th>
            <th className="px-4 py-3 text-left font-semibold">Descripción</th>
            <th className="px-4 py-3 text-left font-semibold">Monto Total</th>
            <th className="px-4 py-3 text-left font-semibold">Total Pagado</th>
            <th className="px-4 py-3 text-left font-semibold">Tasa de Interés</th>
            <th className="px-4 py-3 text-left font-semibold">Cuotas Pagadas</th>
            <th className="px-4 py-3 text-left font-semibold">Cuotas Pendientes</th>
            <th className="px-4 py-3 text-left font-semibold">Próximo Vencimiento</th>
            <th className="px-4 py-3 text-left font-semibold">Progreso</th>
            <th className="px-4 py-3 text-left font-semibold">Estado</th>
            <th className="px-4 py-3 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {credits.map((credit) => {
            const paidCount = paid(credit);
            const totalCount = total(credit);
            const percent = Math.min(100, Math.round((paidCount / totalCount) * 100));

            return (
              <tr key={credit.id} className="border-b border-default-100 hover:bg-default-50">
                <td className="px-4 py-3 font-medium">{credit.bankName}</td>
                <td className="px-4 py-3">{credit.description || "-"}</td>
                <td className="px-4 py-3">
                  {formatCurrency(Number(credit.totalAmount), credit.currency || "CLP")}
                </td>
                <td className="px-4 py-3">
                  <TotalPaidCell credit={credit} />
                </td>
                <td className="px-4 py-3">
                  {credit.interestRate ? `${credit.interestRate}%` : "-"}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium">
                    {paidCount} <span className="text-muted">/ {totalCount}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-warning">{totalCount - paidCount}</span>
                </td>
                <td className="px-4 py-3">
                  {nextDueDate(credit) ? (
                    <span className="text-sm">
                      {dayjs(nextDueDate(credit)).format("DD/MM/YYYY")}
                    </span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-20 rounded-full bg-default-200">
                      <div
                        className="h-2.5 rounded-full bg-primary transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted">{percent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Chip color={credit.status === "ACTIVE" ? "success" : "default"} size="sm">
                    {credit.status}
                  </Chip>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="secondary" onPress={() => onSelectCredit(credit.id)}>
                    Ver Detalle
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export function PersonalCreditsPage() {
  const { data: credits } = useSuspenseQuery(personalFinanceQueries.list());
  const [selectedCreditId, setSelectedCreditId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CreateCreditForm />
      </div>
      <TableData credits={credits} onSelectCredit={setSelectedCreditId} />
      <CreditDetailsModal creditId={selectedCreditId} onClose={() => setSelectedCreditId(null)} />
    </div>
  );
}
export function PersonalCreditsPageWrapper() {
  return (
    <Suspense fallback={<div>Cargando créditos...</div>}>
      <PersonalCreditsPage />
    </Suspense>
  );
}
