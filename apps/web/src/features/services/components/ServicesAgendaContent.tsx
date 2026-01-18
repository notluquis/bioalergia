import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";
import ServicesUnifiedAgenda from "@/features/services/components/ServicesUnifiedAgenda";
import { useServicesOverview } from "@/features/services/hooks/useServicesOverview";
import { currencyFormatter } from "@/lib/format";
import { LOADING_SPINNER_MD } from "@/lib/styles";

export default function ServicesAgendaContent() {
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
      if (dueDate.isSame(dayjs(), "day")) acc.day += item.schedule.expected_amount;
      if (dueDate.isSame(dayjs(), "week")) acc.week += item.schedule.expected_amount;
      if (dueDate.isSame(dayjs(), "month")) acc.month += item.schedule.expected_amount;
      return acc;
    },
    { day: 0, month: 0, week: 0 }
  );

  if (aggregatedLoading && unifiedAgendaItems.length === 0) {
    return (
      <section className="space-y-8">
        <ServicesHero
          actions={
            <Link to="/services">
              <Button variant="ghost">Volver al panel</Button>
            </Link>
          }
          breadcrumbs={[{ label: "Servicios", to: "/services" }, { label: "Agenda" }]}
          description="Visualiza los pagos programados, sus estados y registra conciliaciones rápidamente."
          title="Agenda de servicios"
        />

        <ServicesSurface className="flex min-h-64 items-center justify-center">
          <div className="text-base-content/70 flex items-center gap-3 text-sm">
            <span aria-hidden="true" className={LOADING_SPINNER_MD} />
            <span>Cargando agenda consolidada...</span>
          </div>
        </ServicesSurface>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <ServicesHero
        actions={
          <Link to="/services">
            <Button variant="ghost">Volver al panel</Button>
          </Link>
        }
        breadcrumbs={[{ label: "Servicios", to: "/services" }, { label: "Agenda" }]}
        description="Visualiza los pagos programados, sus estados y registra conciliaciones rápidamente."
        title="Agenda de servicios"
      />

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
