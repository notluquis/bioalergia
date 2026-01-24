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
    return <div className="bg-background h-64 w-full animate-pulse rounded-2xl" />;
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
      cell: ({ row }) => <span className="text-xs font-medium">{row.original.category}</span>,
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
        <span className="tabular-nums text-right text-xs font-mono">
          ${row.original.amount.toLocaleString("es-CL")}
        </span>
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
            <h3 className="text-lg font-semibold">{group.category}</h3>
            <span className="text-sm font-medium opacity-70">
              Total: ${group.total.toLocaleString("es-CL")}
            </span>
          </div>
          <DataTable
            columns={columns}
            data={group.items}
            containerVariant="plain"
            enablePagination={false}
            enableToolbar={false}
          />
        </section>
      ))}
    </div>
  );
}
