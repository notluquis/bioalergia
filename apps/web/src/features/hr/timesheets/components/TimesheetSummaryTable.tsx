import { DataTable } from "@/components/data-table/DataTable";

import type { TimesheetSummaryRow } from "../types";

import { getTimesheetSummaryColumns, type SummaryTotals } from "./TimesheetSummaryColumns";

interface TimesheetSummaryTableProps {
  loading: boolean;
  onSelectEmployee: (id: null | number) => void;
  selectedEmployeeId: null | number;
  summary: null | { employees: TimesheetSummaryRow[]; totals: SummaryTotals };
}

export default function TimesheetSummaryTable({
  loading,
  onSelectEmployee,
  selectedEmployeeId,
  summary,
}: TimesheetSummaryTableProps) {
  const columns = getTimesheetSummaryColumns();

  const rowSelection = (() => {
    if (!selectedEmployeeId) return {};
    return { [selectedEmployeeId]: true };
  })();

  return (
    <div className="border-primary/15 bg-base-100 overflow-hidden rounded-2xl border shadow-sm">
      <DataTable
        columns={columns}
        data={summary?.employees ?? []}
        enableToolbar={false}
        enableVirtualization={false}
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
