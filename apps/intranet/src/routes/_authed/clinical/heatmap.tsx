import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { addMonths, endOfMonthFor, today } from "@/lib/dates";
import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";
import { CalendarHeatmapPage } from "@/pages/CalendarHeatmapPage";

const routeApi = getRouteApi("/_authed/clinical/heatmap");

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
  beforeLoad: ({ context }) => {
    if (!context.can("read", "CalendarHeatmap")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: CalendarHeatmapPage,
});
