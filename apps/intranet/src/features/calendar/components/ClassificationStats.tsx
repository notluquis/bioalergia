import { StatCard } from "@/components/ui/StatCard";
import type { CalendarUnclassifiedEvent } from "../types";
import { ClassificationTotals } from "./ClassificationTotals";

interface ClassificationStatsProps {
  loading: boolean;
  totalCount: number;
  events: CalendarUnclassifiedEvent[];
  // biome-ignore lint/suspicious/noExplicitAny: complex generic type
  form: any;
}

export function ClassificationStats({
  loading,
  totalCount,
  events,
  form,
}: ClassificationStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Pendientes"
        tone="primary"
        value={loading ? "—" : totalCount.toLocaleString("es-CL")}
      />
      <StatCard title="Página actual" tone="success" value={loading ? "—" : events.length} />
      <ClassificationTotals events={events} form={form} />
    </div>
  );
}
