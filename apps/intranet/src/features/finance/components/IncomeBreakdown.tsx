import { Skeleton } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { DataTable } from "@/components/data-table/DataTable";
import type { FinancialSummary, IncomeItem } from "../types";

interface IncomeBreakdownProps {
  summary: FinancialSummary | null;
  isLoading: boolean;
}

export function IncomeBreakdown({ summary, isLoading }: Readonly<IncomeBreakdownProps>) {
  if (isLoading || !summary) {
    return (
      <div className="space-y-4 rounded-2xl border border-default-200 p-4">
        <Skeleton className="h-6 w-52 rounded-md" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="grid grid-cols-4 gap-3" key={`income-skeleton-${index + 1}`}>
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="ml-auto h-4 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const columns: ColumnDef<IncomeItem>[] = [
    {
      accessorKey: "date",
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {dayjs(row.original.date).format("DD/MM/YYYY")}
        </span>
      ),
      header: "Fecha",
      minSize: 120,
    },
    {
      accessorKey: "category",
      cell: ({ row }) => <span className="font-medium text-xs">{row.original.category}</span>,
      header: "Categoría",
      minSize: 150,
    },
    {
      accessorKey: "summary",
      cell: ({ row }) => (
        <span className="max-w-50 truncate text-xs" title={row.original.summary}>
          {row.original.summary}
        </span>
      ),
      header: "Descripción",
      minSize: 200,
    },
    {
      accessorKey: "amount",
      cell: ({ row }) => (
        <div className="text-right font-mono text-xs tabular-nums">
          ${row.original.amount.toLocaleString("es-CL")}
        </div>
      ),
      header: "Monto",
      minSize: 120,
    },
  ];

  if (summary.totalIncome === 0) {
    return (
      <div className="py-8 text-center opacity-60">
        <p>No se encontraron ingresos para este período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {summary.incomesByCategory.map((group) => (
        <section key={group.category} className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-semibold text-lg">{group.category}</h3>
            <span className="font-medium text-sm opacity-70">
              Total: ${group.total.toLocaleString("es-CL")}
            </span>
          </div>
          <DataTable
            columns={columns}
            data={group.items}
            containerVariant="plain"
            enablePagination={false}
            enableToolbar={false}
            scrollMaxHeight="28rem"
          />
        </section>
      ))}
    </div>
  );
}
