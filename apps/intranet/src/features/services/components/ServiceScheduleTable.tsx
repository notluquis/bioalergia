import { useMemo } from "react";

import { DataTable } from "@/components/data-table/DataTable";

import type { ServiceSchedule } from "../types";

import { getColumns } from "./ServiceScheduleColumns";

interface ServiceScheduleTableProps {
  canManage: boolean;
  onEditSchedule?: (schedule: ServiceSchedule) => void;
  onRegisterPayment: (schedule: ServiceSchedule) => void;
  onSkipSchedule?: (schedule: ServiceSchedule) => void;
  onUnlinkPayment: (schedule: ServiceSchedule) => void;
  schedules: ServiceSchedule[];
}

export function ServiceScheduleTable({
  canManage,
  onEditSchedule,
  onRegisterPayment,
  onSkipSchedule,
  onUnlinkPayment,
  schedules,
}: ServiceScheduleTableProps) {
  const actions = useMemo(
    () => ({
      onEditSchedule,
      onRegisterPayment,
      onSkipSchedule,
      onUnlinkPayment,
    }),
    [onEditSchedule, onRegisterPayment, onSkipSchedule, onUnlinkPayment],
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
