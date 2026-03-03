import type { ClassificationForm } from "../form-types";
import type { CalendarUnclassifiedEvent } from "../types";
import { ClassificationTotals } from "./ClassificationTotals";
import { MetricCard } from "./MetricCard";

interface ClassificationStatsProps {
  events: CalendarUnclassifiedEvent[];
  form: ClassificationForm;
  loading: boolean;
  totalCount: number;
}

export function ClassificationStats({
  loading,
  totalCount,
  events,
  form,
}: ClassificationStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Pendientes"
        tone="primary"
        value={loading ? "—" : totalCount.toLocaleString("es-CL")}
      />
      <MetricCard title="Página actual" tone="success" value={loading ? "—" : events.length} />
      <ClassificationTotals events={events} form={form} />
    </div>
  );
}
