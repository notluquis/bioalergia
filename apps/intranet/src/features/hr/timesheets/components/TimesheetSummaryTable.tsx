import type { TableMeta } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";

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
    <div className="overflow-hidden rounded-2xl border border-primary/15 bg-background shadow-sm">
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
      />
    </div>
  );
}
