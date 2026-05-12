import { Card, Skeleton, Surface } from "@heroui/react";
import { useStore } from "@tanstack/react-store";
import dayjs from "dayjs";
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
    (state) => state
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
    { day: 0, month: 0, week: 0 }
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
          <Card
            className="rounded-2xl border border-default-200 bg-background p-4 shadow-sm"
            variant="secondary"
          >
            <Card.Content className="p-0">
              <Card.Title className="font-semibold text-default-500 text-xs uppercase tracking-wide">
                Pagos hoy
              </Card.Title>
              <Card.Description className="mt-2 block font-semibold text-2xl text-foreground">
                {currencyFormatter.format(totals.day)}
              </Card.Description>
            </Card.Content>
          </Card>
          <Card
            className="rounded-2xl border border-default-200 bg-background p-4 shadow-sm"
            variant="secondary"
          >
            <Card.Content className="p-0">
              <Card.Title className="font-semibold text-default-500 text-xs uppercase tracking-wide">
                Semana en curso
              </Card.Title>
              <Card.Description className="mt-2 block font-semibold text-2xl text-foreground">
                {currencyFormatter.format(totals.week)}
              </Card.Description>
            </Card.Content>
          </Card>
          <Card
            className="rounded-2xl border border-default-200 bg-background p-4 shadow-sm"
            variant="secondary"
          >
            <Card.Content className="p-0">
              <Card.Title className="font-semibold text-default-500 text-xs uppercase tracking-wide">
                Mes en curso
              </Card.Title>
              <Card.Description className="mt-2 block font-semibold text-2xl text-foreground">
                {currencyFormatter.format(totals.month)}
              </Card.Description>
            </Card.Content>
          </Card>
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
