import { useMemo } from "react";

import { DataTable } from "@/components/data-table/DataTable";

import type { ServiceSchedule } from "../types";

import { getColumns } from "./ServiceScheduleColumns";

interface ServiceScheduleTableProps {
  canManage: boolean;
  onRegisterPayment: (schedule: ServiceSchedule) => void;
  onUnlinkPayment: (schedule: ServiceSchedule) => void;
  schedules: ServiceSchedule[];
}

export function ServiceScheduleTable({
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
  schedules,
}: ServiceScheduleTableProps) {
  const actions = useMemo(
    () => ({
      onRegisterPayment,
      onUnlinkPayment,
    }),
    [onRegisterPayment, onUnlinkPayment],
  );

  const columns = useMemo(() => getColumns(actions, canManage), [actions, canManage]);

  return (
    <div className="bg-background">
      <DataTable
        columns={columns}
        data={schedules}
        containerVariant="plain"
        enablePagination={false}
        enableToolbar={false} // Small sub-table usually doesn't need search/filter toolbar
      />
    </div>
  );
}

export default ServiceScheduleTable;
