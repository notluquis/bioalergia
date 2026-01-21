import { Chip } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeftIcon } from "lucide-react";
import { Suspense } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
    cell: ({ row }) => new Date(row.original.dueDate).toLocaleDateString(),
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
        <Badge variant={row.original.status === "PAID" ? "success" : "outline"}>
          {row.original.status}
        </Badge>
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

  if (!credit) return null;

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
            className="no-animation ease-apple size-8 p-0 transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Number(credit.totalAmount), credit.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cuotas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                credit.installments?.filter((i: PersonalCreditInstallment) => i.status === "PAID")
                  .length
              }{" "}
              / {credit.totalInstallments}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabla de Amortización</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={credit.installments || []}
            enableToolbar={false}
            enableVirtualization={false}
            pageCount={-1}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function PersonalCreditDetailsPageWrapper() {
  const params = useParams({ from: "/_authed/finanzas/personal-credits/$creditId" });

  return (
    <Suspense fallback={<div>Cargando detalle...</div>}>
      <PersonalCreditDetailsPage creditId={Number(params.creditId)} />
    </Suspense>
  );
}
