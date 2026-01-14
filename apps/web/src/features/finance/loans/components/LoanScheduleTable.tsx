// Imports cleaned up

import { DataTable } from "@/components/data-table/DataTable";

import type { LoanSchedule } from "../types";
import { getColumns } from "./LoanScheduleColumns";

interface LoanScheduleTableProps {
  schedules: LoanSchedule[];
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
  canManage: boolean;
}

export default function LoanScheduleTable({
  schedules,
  onRegisterPayment,
  onUnlinkPayment,
  canManage,
}: LoanScheduleTableProps) {
  const actions = {
    onRegisterPayment,
    onUnlinkPayment,
  };

  const columns = getColumns(actions, canManage);

  return (
    <div className="border-base-300 bg-base-100 overflow-hidden rounded-2xl border shadow-sm">
      <DataTable
        data={schedules}
        columns={columns}
        enableToolbar={false}
        pagination={{ pageIndex: 0, pageSize: 100 }}
        noDataMessage="No hay cronograma disponible."
      />
    </div>
  );
}
