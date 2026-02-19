import { Skeleton, Surface } from "@heroui/react";
import { useStore } from "@tanstack/react-store";
import dayjs from "dayjs";
import { StatCard } from "@/components/ui/StatCard";
import { EditScheduleModal } from "@/features/services/components/EditScheduleModal";
import { ServicesUnifiedAgenda } from "@/features/services/components/ServicesUnifiedAgenda";
import { SkipScheduleModal } from "@/features/services/components/SkipScheduleModal";
import { useServicesOverview } from "@/features/services/hooks/use-services-overview";
import { servicesActions, servicesStore } from "@/features/services/store";
import type { ServiceSchedule } from "@/features/services/types";
import { currencyFormatter } from "@/lib/format";

export function ServicesAgendaContent() {
  const {
    aggregatedError,
    aggregatedLoading,
    canManage,
    handleAgendaRegisterPayment,
    handleAgendaUnlinkPayment,
    unifiedAgendaItems,
  } = useServicesOverview();

  const { editScheduleOpen, editScheduleTarget, skipScheduleOpen, skipScheduleTarget } = useStore(
    servicesStore,
    (state) => state,
  );

  const handleEditSchedule = (_serviceId: string, schedule: ServiceSchedule) => {
    servicesActions.openEditScheduleModal(schedule);
  };

  const handleSkipSchedule = (_serviceId: string, schedule: ServiceSchedule) => {
    servicesActions.openSkipScheduleModal(schedule);
  };

  const totals = unifiedAgendaItems.reduce(
    (acc, item) => {
      const dueDate = dayjs(item.schedule.dueDate);
      if (dueDate.isSame(dayjs(), "day")) {
        acc.day += item.schedule.expectedAmount;
      }
      if (dueDate.isSame(dayjs(), "week")) {
        acc.week += item.schedule.expectedAmount;
      }
      if (dueDate.isSame(dayjs(), "month")) {
        acc.month += item.schedule.expectedAmount;
      }
      return acc;
    },
    { day: 0, month: 0, week: 0 },
  );

  if (aggregatedLoading && unifiedAgendaItems.length === 0) {
    return (
      <section className="space-y-8">
        <Surface className="space-y-4 rounded-[28px] p-6 shadow-inner">
          <Skeleton className="h-6 w-64 rounded-md" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
        </Surface>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <Surface className="space-y-6 rounded-[28px] p-6 shadow-inner">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Pagos hoy" value={currencyFormatter.format(totals.day)} />
          <StatCard title="Semana en curso" value={currencyFormatter.format(totals.week)} />
          <StatCard title="Mes en curso" value={currencyFormatter.format(totals.month)} />
        </div>

        <ServicesUnifiedAgenda
          canManage={canManage}
          error={aggregatedError}
          items={unifiedAgendaItems}
          loading={aggregatedLoading}
          onEditSchedule={handleEditSchedule}
          onRegisterPayment={handleAgendaRegisterPayment}
          onSkipSchedule={handleSkipSchedule}
          onUnlinkPayment={handleAgendaUnlinkPayment}
        />
      </Surface>

      <EditScheduleModal
        isOpen={editScheduleOpen}
        onClose={servicesActions.closeEditScheduleModal}
        schedule={editScheduleTarget}
      />

      <SkipScheduleModal
        isOpen={skipScheduleOpen}
        onClose={servicesActions.closeSkipScheduleModal}
        schedule={skipScheduleTarget}
      />
    </section>
  );
}
