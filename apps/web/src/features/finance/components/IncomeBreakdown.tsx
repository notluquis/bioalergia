import dayjs from "dayjs";
import { Table, type TableColumn } from "@/components/ui/Table";
import type { FinancialSummary, IncomeItem } from "../types";

interface IncomeBreakdownProps {
  summary: FinancialSummary | null;
  isLoading: boolean;
}

export function IncomeBreakdown({ summary, isLoading }: Readonly<IncomeBreakdownProps>) {
  if (isLoading || !summary) {
    return <div className="bg-base-100 h-64 w-full animate-pulse rounded-2xl" />;
  }

  const columns: TableColumn<keyof IncomeItem>[] = [
    { key: "date", label: "Fecha", width: "120px" },
    { key: "category", label: "Categoría", width: "150px" },
    { key: "summary", label: "Descripción" },
    { key: "amount", label: "Monto", align: "right", width: "120px" },
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

          <Table<keyof IncomeItem | "dateDisplay"> columns={columns} variant="default">
            <Table.Header<keyof IncomeItem | "dateDisplay"> columns={columns} />
            <Table.Body columnsCount={columns.length}>
              {group.items.map((item) => (
                <tr key={item.id} className="hover:bg-base-200/50">
                  <td className="px-4 py-3 text-xs">{dayjs(item.date).format("DD/MM/YYYY")}</td>
                  <td className="px-4 py-3 text-xs font-medium">{item.category}</td>
                  <td className="truncate px-4 py-3 text-xs max-w-50" title={item.summary}>
                    {item.summary}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono">
                    ${item.amount.toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
            </Table.Body>
          </Table>
        </section>
      ))}
    </div>
  );
}
