import { useMemo } from "react";

import { DataTable } from "@/components/data-table/DataTable";

import type { ServiceSchedule } from "../types";
import { getColumns } from "./ServiceScheduleColumns";

interface ServiceScheduleTableProps {
  schedules: ServiceSchedule[];
  canManage: boolean;
  onRegisterPayment: (schedule: ServiceSchedule) => void;
  onUnlinkPayment: (schedule: ServiceSchedule) => void;
}

export function ServiceScheduleTable({
  schedules,
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
}: ServiceScheduleTableProps) {
  const actions = useMemo(
    () => ({
      onRegisterPayment,
      onUnlinkPayment,
    }),
    [onRegisterPayment, onUnlinkPayment]
  );

  const columns = useMemo(() => getColumns(actions, canManage), [actions, canManage]);

  return (
    <div className="bg-base-100 overflow-hidden">
      <DataTable
        data={schedules}
        columns={columns}
        enableToolbar={false} // Small sub-table usually doesn't need search/filter toolbar
        pagination={{ pageIndex: 0, pageSize: 100 }} // Show all rows by default for schedules
      />
    </div>
  );
}

export default ServiceScheduleTable;
