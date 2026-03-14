import { Button, Chip, Meter, Skeleton } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Suspense, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
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
      <div className="space-y-1">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
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

const paid = (credit: PersonalCredit) =>
  credit.installments?.filter((installment) => installment.status === "PAID").length || 0;
const total = (credit: PersonalCredit) => credit.totalInstallments || 1;
const nextDueDate = (credit: PersonalCredit) => {
  const pending = credit.installments
    ?.filter((installment) => installment.status === "PENDING")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return pending?.[0]?.dueDate;
};

function getColumns(onSelectCredit: (id: number) => void): ColumnDef<PersonalCredit>[] {
  return [
    {
      accessorKey: "bankName",
      header: "Banco",
      cell: ({ row }) => <span className="font-medium">{row.original.bankName}</span>,
    },
    {
      accessorKey: "description",
      header: "Descripción",
      cell: ({ row }) => row.original.description || "-",
    },
    {
      id: "totalAmount",
      header: "Monto Total",
      cell: ({ row }) =>
        formatCurrency(Number(row.original.totalAmount), row.original.currency || "CLP"),
    },
    {
      id: "totalPaid",
      header: "Total Pagado",
      cell: ({ row }) => <TotalPaidCell credit={row.original} />,
    },
    {
      id: "interestRate",
      header: "Tasa de Interés",
      cell: ({ row }) => (row.original.interestRate ? `${row.original.interestRate}%` : "-"),
    },
    {
      id: "installmentsPaid",
      header: "Cuotas Pagadas",
      cell: ({ row }) => {
        const paidCount = paid(row.original);
        const totalCount = total(row.original);
        return (
          <span className="font-medium">
            {paidCount} <span className="text-muted">/ {totalCount}</span>
          </span>
        );
      },
    },
    {
      id: "installmentsPending",
      header: "Cuotas Pendientes",
      cell: ({ row }) => {
        const paidCount = paid(row.original);
        const totalCount = total(row.original);
        return <span className="font-medium text-warning">{totalCount - paidCount}</span>;
      },
    },
    {
      id: "nextDueDate",
      header: "Próximo Vencimiento",
      cell: ({ row }) => {
        const dueDate = nextDueDate(row.original);
        return dueDate ? (
          <span className="text-sm">{dayjs(dueDate).format("DD/MM/YYYY")}</span>
        ) : (
          <span className="text-muted">-</span>
        );
      },
    },
    {
      id: "progress",
      header: "Progreso",
      cell: ({ row }) => {
        const paidCount = paid(row.original);
        const totalCount = total(row.original);
        const percent = Math.min(100, Math.round((paidCount / totalCount) * 100));

        return (
          <div className="flex items-center gap-2">
            <Meter aria-label={`Crédito pagado ${percent}%`} className="w-20" value={percent}>
              <Meter.Track className="h-2.5 rounded-full bg-default-200">
                <Meter.Fill className="bg-primary" />
              </Meter.Track>
            </Meter>
            <span className="text-xs font-medium text-muted">{percent}%</span>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => (
        <Chip color={row.original.status === "ACTIVE" ? "success" : "default"} size="sm">
          {row.original.status}
        </Chip>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onPress={() => onSelectCredit(row.original.id)}>
            Ver Detalle
          </Button>
        </div>
      ),
    },
  ];
}

export function PersonalCreditsPage() {
  const { data: credits } = useSuspenseQuery(personalFinanceQueries.list());
  const [selectedCreditId, setSelectedCreditId] = useState<number | null>(null);
  const columns = getColumns(setSelectedCreditId);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CreateCreditForm />
      </div>
      <DataTable
        columns={columns}
        data={credits}
        enableGlobalFilter={false}
        enableExport={false}
        noDataMessage="No hay créditos personales registrados."
        pageSizeOptions={[10, 25, 50]}
        scrollMaxHeight="min(68dvh, 760px)"
      />
      <CreditDetailsModal creditId={selectedCreditId} onClose={() => setSelectedCreditId(null)} />
    </div>
  );
}
export function PersonalCreditsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <PersonalCreditsPage />
    </Suspense>
  );
}
