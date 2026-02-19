import { Card, Chip, Skeleton } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowLeftIcon } from "lucide-react";
import { Suspense } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

import { PayInstallmentModal } from "../components/PayInstallmentModal";
import { personalFinanceQueries } from "../queries";
import type { PersonalCreditInstallment } from "../types";

const installmentColumns = (
  currency: string,
  creditId: number,
): ColumnDef<PersonalCreditInstallment>[] => [
  {
    accessorKey: "installmentNumber",
    cell: ({ row }) => <span className="font-medium">{row.original.installmentNumber}</span>,
    header: "#",
  },
  {
    accessorKey: "dueDate",
    cell: ({ row }) => dayjs(row.original.dueDate, "YYYY-MM-DD").format("DD/MM/YYYY"),
    header: "Vencimiento",
  },
  {
    accessorKey: "amount",
    cell: ({ row }) => (
      <div className="text-right">{formatCurrency(Number(row.original.amount), currency)}</div>
    ),

    header: ({ column: _column }) => <div className="text-right">Monto</div>,
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Chip
          color={row.original.status === "PAID" ? "success" : "default"}
          variant={row.original.status === "PAID" ? "primary" : "tertiary"}
        >
          {row.original.status}
        </Chip>
      </div>
    ),

    header: "Estado",
  },
  {
    cell: ({ row }) => (
      <div className="flex justify-end">
        {row.original.status !== "PAID" && (
          <PayInstallmentModal creditId={creditId} installment={row.original} />
        )}
      </div>
    ),

    header: ({ column: _column }) => <div className="text-right">Acción</div>,
    id: "actions",
  },
];

export function PersonalCreditDetailsPage({ creditId }: { creditId: number }) {
  const { data: credit } = useSuspenseQuery(personalFinanceQueries.detail(creditId));

  if (!credit) {
    return null;
  }

  const columns = installmentColumns(credit.currency, credit.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/finanzas/personal-credits">
          <Button
            as="div"
            isIconOnly
            size="sm"
            variant="ghost"
            className="no-animation size-8 p-0 transition-all duration-200 ease-apple hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <h1 className="font-bold text-3xl tracking-tight">
          {credit.bankName} - {credit.description || credit.creditNumber}
        </h1>
        <Chip
          color={credit.status === "ACTIVE" ? "accent" : "default"}
          variant={credit.status === "ACTIVE" ? "primary" : "secondary"}
        >
          {credit.status}
        </Chip>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Card.Header className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title className="font-medium text-sm">Monto Total</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="font-bold text-2xl">
              {formatCurrency(Number(credit.totalAmount), credit.currency)}
            </div>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title className="font-medium text-sm">Cuotas</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="font-bold text-2xl">
              {
                credit.installments?.filter((i: PersonalCreditInstallment) => i.status === "PAID")
                  .length
              }{" "}
              / {credit.totalInstallments}
            </div>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Tabla de Amortización</Card.Title>
        </Card.Header>
        <Card.Content>
          <DataTable
            columns={columns}
            data={credit.installments || []}
            containerVariant="plain"
            enableToolbar={false}
            pageCount={-1}
          />
        </Card.Content>
      </Card>
    </div>
  );
}
export function PersonalCreditDetailsPageWrapper() {
  const params = useParams({ from: "/_authed/finanzas/personal-credits/$creditId" });
  const creditId = Number(params.creditId);

  if (Number.isNaN(creditId)) {
    throw new Error("Invalid credit id");
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-52 rounded-md" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <PersonalCreditDetailsPage creditId={creditId} />
    </Suspense>
  );
}
