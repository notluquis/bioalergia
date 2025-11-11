import dayjs from "dayjs";
import ServicesUnifiedAgenda from "../../features/services/components/ServicesUnifiedAgenda";
import Button from "../../components/Button";
import { useServicesOverview } from "../../features/services/hooks/useServicesOverview";
import { ServicesHero, ServicesSurface, ServicesStatCard } from "../../features/services/components/ServicesShell";
import { Link } from "react-router-dom";

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default function ServicesAgendaContent() {
  const {
    canManage,
    unifiedAgendaItems,
    aggregatedLoading,
    aggregatedError,
    handleAgendaRegisterPayment,
    handleAgendaUnlinkPayment,
  } = useServicesOverview();

  const totals = unifiedAgendaItems.reduce(
    (acc, item) => {
      const dueDate = dayjs(item.schedule.due_date);
      if (dueDate.isSame(dayjs(), "day")) acc.day += item.schedule.expected_amount;
      if (dueDate.isSame(dayjs(), "week")) acc.week += item.schedule.expected_amount;
      if (dueDate.isSame(dayjs(), "month")) acc.month += item.schedule.expected_amount;
      return acc;
    },
    { day: 0, week: 0, month: 0 }
  );

  return (
    <section className="space-y-8">
      <ServicesHero
        title="Agenda de servicios"
        description="Visualiza los pagos programados, sus estados y registra conciliaciones rápidamente."
        breadcrumbs={[{ label: "Servicios", to: "/services" }, { label: "Agenda" }]}
        actions={
          <Link to="/services">
            <Button variant="ghost">Volver al panel</Button>
          </Link>
        }
      />

      <ServicesSurface>
        <div className="grid gap-4 sm:grid-cols-3">
          <ServicesStatCard label="Pagos hoy" value={currencyFormatter.format(totals.day)} />
          <ServicesStatCard label="Semana en curso" value={currencyFormatter.format(totals.week)} />
          <ServicesStatCard label="Mes en curso" value={currencyFormatter.format(totals.month)} />
        </div>

        <ServicesUnifiedAgenda
          items={unifiedAgendaItems}
          loading={aggregatedLoading}
          error={aggregatedError}
          canManage={canManage}
          onRegisterPayment={handleAgendaRegisterPayment}
          onUnlinkPayment={handleAgendaUnlinkPayment}
        />
      </ServicesSurface>
    </section>
  );
}
