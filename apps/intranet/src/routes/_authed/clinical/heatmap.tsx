import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { addMonths, endOfMonthFor, today } from "@/lib/dates";
import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";
import { CalendarHeatmapPage } from "@/pages/CalendarHeatmapPage";

export const Route = createFileRoute("/_authed/clinical/heatmap")({
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => {
    const parsed = calendarSearchSchema.parse(search);
    if (!parsed.from || !parsed.to) {
      const defaultFrom = addMonths(today(), -1);
      const defaultTo = endOfMonthFor(addMonths(today(), 1));
      return {
        ...parsed,
        from: parsed.from ?? defaultFrom,
        to: parsed.to ?? defaultTo,
      };
    }
    return parsed;
  },
  staticData: {
    nav: { iconKey: "LayoutGrid", label: "Calendario — heatmap", order: 18, section: "Clínica" },
    permission: { action: "read", subject: "CalendarHeatmap" },
    title: "Heatmap clínico",
  },
  beforeLoad: requirePermission("read", "CalendarHeatmap"),
  component: CalendarHeatmapPage,
});
