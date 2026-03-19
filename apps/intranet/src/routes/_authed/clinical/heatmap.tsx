import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";

import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";
import { CalendarHeatmapPage } from "@/pages/CalendarHeatmapPage";

const routeApi = getRouteApi("/_authed/clinical/heatmap");

export const Route = createFileRoute("/_authed/clinical/heatmap")({
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => {
    const parsed = calendarSearchSchema.parse(search);
    if (!parsed.from || !parsed.to) {
      const defaultFrom = dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD");
      const defaultTo = dayjs().add(1, "month").endOf("month").format("YYYY-MM-DD");
      return {
        ...parsed,
        from: parsed.from ?? defaultFrom,
        to: parsed.to ?? defaultTo,
      };
    }
    return parsed;
  },
  staticData: {
    nav: { iconKey: "LayoutDashboard", label: "Heatmap", order: 4, section: "Prestaciones" },
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
