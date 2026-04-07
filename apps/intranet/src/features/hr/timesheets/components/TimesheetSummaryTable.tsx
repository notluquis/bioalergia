import { Surface } from "@heroui/react";
import type { TableMeta } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { fmtCLP } from "@/lib/format";

import type { TimesheetSummaryRow } from "../types";

import { getTimesheetSummaryColumns } from "./TimesheetSummaryColumns";

interface TimesheetSummaryTableProps {
  loading: boolean;
  onSelectEmployee: (id: null | number) => void;
  selectedEmployeeId: null | number;
  summary: null | {
    employees: TimesheetSummaryRow[];
    totals: TableMeta<TimesheetSummaryRow>["totals"];
  };
}

export function TimesheetSummaryTable({
  loading,
  onSelectEmployee,
  selectedEmployeeId,
  summary,
}: TimesheetSummaryTableProps) {
  const columns = getTimesheetSummaryColumns();

  const rowSelection = (() => {
    if (!selectedEmployeeId) {
      return {};
    }
    return { [selectedEmployeeId]: true };
  })();

  return (
    <Surface
      className="overflow-hidden rounded-[28px] border border-default-200/70 shadow-sm"
      variant="secondary"
    >
      <DataTable
        columns={columns}
        data={summary?.employees ?? []}
        containerVariant="plain"
        enablePagination={false}
        enableToolbar={false}
        isLoading={loading}
        meta={{
          totals: summary?.totals,
        }}
        noDataMessage="Aún no registras horas en este periodo."
        onRowClick={(row) => {
          onSelectEmployee(row.employeeId === selectedEmployeeId ? null : row.employeeId);
        }}
        rowSelection={rowSelection}
        scrollMaxHeight="min(56dvh, 640px)"
      />
      {summary?.totals && (
        <div className="border-default-200/70 border-t bg-background/40 px-4 py-3 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_160px_160px] sm:items-center">
            <div className="font-medium text-default-700 text-sm uppercase tracking-wide">
              Total
            </div>
            <div className="rounded-2xl border border-default-200/70 bg-background/70 px-4 py-3">
              <p className="text-default-500 text-tiny uppercase tracking-wide">Subtotal</p>
              <p className="mt-1 font-semibold text-foreground text-sm">
                {fmtCLP(summary.totals.subtotal)}
              </p>
            </div>
            <div className="rounded-2xl border border-default-200/70 bg-background/70 px-4 py-3">
              <p className="text-default-500 text-tiny uppercase tracking-wide">Retención</p>
              <p className="mt-1 font-semibold text-foreground text-sm">
                {fmtCLP(summary.totals.retention)}
              </p>
            </div>
            <div className="rounded-2xl border border-default-200/70 bg-background/70 px-4 py-3">
              <p className="text-default-500 text-tiny uppercase tracking-wide">Líquido</p>
              <p className="mt-1 font-semibold text-foreground text-sm">
                {fmtCLP(summary.totals.net)}
              </p>
            </div>
          </div>
        </div>
      )}
    </Surface>
  );
}
