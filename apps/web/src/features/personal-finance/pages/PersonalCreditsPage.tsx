import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Suspense } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { formatCurrency } from "@/lib/utils";
import { CreateCreditForm } from "../components/CreateCreditForm";
import { personalFinanceQueries } from "../queries";
import type { PersonalCredit } from "../types";

const columns: ColumnDef<PersonalCredit>[] = [
  {
    accessorKey: "bankName",
    cell: ({ row }) => <span className="font-medium">{row.original.bankName}</span>,
    header: "Banco",
  },
  {
    accessorKey: "description",
    header: "Descripción",
  },
  {
    accessorKey: "totalAmount",
    cell: ({ row }) =>
      formatCurrency(Number(row.original.totalAmount), row.original.currency || "CLP"),
    header: "Monto Total",
  },
  {
    accessorKey: "progress",
    cell: ({ row }) => {
      // Simple static bar for verification phase
      const paid = row.original.installments?.filter((i) => i.status === "PAID").length || 0;
      const total = row.original.totalInstallments || 1;
      const percent = Math.min(100, Math.round((paid / total) * 100));

      return (
        <div className="bg-base-200 dark:bg-base-700 h-2.5 w-full rounded-full">
          <div
            className="bg-primary h-2.5 rounded-full transition-all"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      );
    },
    header: "Progreso",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => {
      const status = row.original.status;
      const badgeClass = status === "ACTIVE" ? "badge-primary" : "badge-ghost";
      return <div className={`badge ${badgeClass}`}>{status}</div>;
    },
    header: "Estado",
  },
  {
    cell: ({ row }) => (
      <Link
        className="btn btn-ghost btn-sm no-animation ease-apple transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
        params={{ creditId: row.original.id.toString() }}
        to="/finanzas/personal-credits/$creditId"
      >
        Ver Detalle
      </Link>
    ),
    id: "actions",
  },
];

export function PersonalCreditsPage() {
  const { data: credits } = useSuspenseQuery(personalFinanceQueries.list());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Créditos Personales</h1>
        <CreateCreditForm />
      </div>
      <DataTable columns={columns} data={credits} />
    </div>
  );
}

export default function PersonalCreditsPageWrapper() {
  return (
    <Suspense fallback={<div>Cargando créditos...</div>}>
      <PersonalCreditsPage />
    </Suspense>
  );
}
