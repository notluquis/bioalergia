import dayjs from "dayjs";
import CollapsibleSection from "../../components/CollapsibleSection";
import ServicesUnifiedAgenda from "../../features/services/components/ServicesUnifiedAgenda";
import { useServicesOverview } from "../../features/services/hooks/useServicesOverview";

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
    <section className="flex flex-col gap-6">
      <CollapsibleSection title="Totales de agenda" defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard title="Pagos hoy" value={currencyFormatter.format(totals.day)} />
          <MetricCard title="Semana en curso" value={currencyFormatter.format(totals.week)} />
          <MetricCard title="Mes en curso" value={currencyFormatter.format(totals.month)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Agenda por día"
        defaultOpen
        description="Visualiza todos los pagos programados agrupados por fecha"
      >
        <ServicesUnifiedAgenda
          items={unifiedAgendaItems}
          loading={aggregatedLoading}
          error={aggregatedError}
          canManage={canManage}
          onRegisterPayment={handleAgendaRegisterPayment}
          onUnlinkPayment={handleAgendaUnlinkPayment}
        />
      </CollapsibleSection>
    </section>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
};

function MetricCard({ title, value }: MetricCardProps) {
  return (
    <article className="surface-muted p-4">
      <p className="typ-caption text-base-content/70">{title}</p>
      <p className="mt-2 typ-subtitle text-base-content">{value}</p>
    </article>
  );
}
