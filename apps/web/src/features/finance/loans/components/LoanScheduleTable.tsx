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

export default function LoanScheduleTable({
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
    <div className="border-default-200 bg-background overflow-hidden rounded-2xl border shadow-sm">
      <DataTable
        columns={columns}
        data={schedules}
        containerVariant="plain"
        enableToolbar={false}
        noDataMessage="No hay cronograma disponible."
        pagination={{ pageIndex: 0, pageSize: 100 }}
      />
    </div>
  );
}
