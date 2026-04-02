import { Surface } from "@heroui/react";
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
    </Surface>
  );
}
