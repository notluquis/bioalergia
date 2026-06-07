// Imports cleaned up

import { DataTable } from "@/components/data-table/DataTable";

import type { LoanSchedule } from "../types";

import { getColumns } from "./LoanScheduleColumns";

interface LoanScheduleTableProps {
  canManage: boolean;
  onEditSchedule: (schedule: LoanSchedule) => void;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
  schedules: LoanSchedule[];
}
export function LoanScheduleTable({
  canManage,
  onEditSchedule,
  onRegisterPayment,
  onUnlinkPayment,
  schedules,
}: LoanScheduleTableProps) {
  const actions = {
    onEditSchedule,
    onRegisterPayment,
    onUnlinkPayment,
  };

  const columns = getColumns(actions, canManage);

  return (
    <div className="overflow-hidden rounded-lg border border-default-200 bg-background">
      <DataTable
        columns={columns}
        data={schedules}
        containerVariant="plain"
        enablePagination={false}
        enableToolbar={false}
        noDataMessage="No hay cronograma disponible."
        scrollMaxHeight="42dvh"
      />
    </div>
  );
}
