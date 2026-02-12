import { Spinner } from "@heroui/react";
import dayjs from "dayjs";
import { StatCard } from "@/components/ui/StatCard";
import { ServicesSurface } from "@/features/services/components/ServicesShell";
import { ServicesUnifiedAgenda } from "@/features/services/components/ServicesUnifiedAgenda";
import { useServicesOverview } from "@/features/services/hooks/use-services-overview";
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

  const totals = unifiedAgendaItems.reduce(
    (acc, item) => {
      const dueDate = dayjs(item.schedule.due_date);
      if (dueDate.isSame(dayjs(), "day")) {
        acc.day += item.schedule.expected_amount;
      }
      if (dueDate.isSame(dayjs(), "week")) {
        acc.week += item.schedule.expected_amount;
      }
      if (dueDate.isSame(dayjs(), "month")) {
        acc.month += item.schedule.expected_amount;
      }
      return acc;
    },
    { day: 0, month: 0, week: 0 },
  );

  if (aggregatedLoading && unifiedAgendaItems.length === 0) {
    return (
      <section className="space-y-8">
        <ServicesSurface className="flex min-h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-default-600 text-sm">
            <Spinner size="md" />
            <span>Cargando agenda consolidada...</span>
          </div>
        </ServicesSurface>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <ServicesSurface>
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
          onRegisterPayment={handleAgendaRegisterPayment}
          onUnlinkPayment={handleAgendaUnlinkPayment}
        />
      </ServicesSurface>
    </section>
  );
}
