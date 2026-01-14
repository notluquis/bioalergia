import { useMemo } from "react";

import { DataTable } from "@/components/data-table/DataTable";

import type { TimesheetSummaryRow } from "../types";
import { getTimesheetSummaryColumns, SummaryTotals } from "./TimesheetSummaryColumns";

interface TimesheetSummaryTableProps {
  summary: { employees: TimesheetSummaryRow[]; totals: SummaryTotals } | null;
  loading: boolean;
  selectedEmployeeId: number | null;
  onSelectEmployee: (id: number | null) => void;
}

export default function TimesheetSummaryTable({
  summary,
  loading,
  selectedEmployeeId,
  onSelectEmployee,
}: TimesheetSummaryTableProps) {
  const columns = useMemo(() => getTimesheetSummaryColumns(), []);

  const rowSelection = useMemo(() => {
    if (!selectedEmployeeId) return {};
    return { [selectedEmployeeId]: true };
  }, [selectedEmployeeId]);

  return (
    <div className="border-primary/15 bg-base-100 overflow-hidden rounded-2xl border shadow-sm">
      <DataTable
        data={summary?.employees ?? []}
        columns={columns}
        isLoading={loading}
        enableToolbar={false}
        enableVirtualization={false}
        onRowClick={(row) => onSelectEmployee(row.employeeId === selectedEmployeeId ? null : row.employeeId)}
        rowSelection={rowSelection}
        meta={{
          totals: summary?.totals,
        }}
        noDataMessage="Aún no registras horas en este periodo."
      />
    </div>
  );
}
