// Imports cleaned up

import { DataTable } from "@/components/data-table/DataTable";

import type { LoanSchedule } from "../types";

import { getColumns } from "./LoanScheduleColumns";

interface LoanScheduleTableProps {
  canManage: boolean;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
  schedules: LoanSchedule[];
}
export function LoanScheduleTable({
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
  schedules,
}: LoanScheduleTableProps) {
  const actions = {
    onRegisterPayment,
    onUnlinkPayment,
  };

  const columns = getColumns(actions, canManage);

  return (
    <div className="rounded-2xl border border-default-200 bg-background shadow-sm">
      <DataTable
        columns={columns}
        data={schedules}
        containerVariant="plain"
        enablePagination={false}
        enableToolbar={false}
        noDataMessage="No hay cronograma disponible."
      />
    </div>
  );
}
