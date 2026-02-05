import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";
import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";

const CalendarHeatmapPage = lazy(() =>
  import("@/pages/CalendarHeatmapPage").then((m) => ({ default: m.CalendarHeatmapPage })),
);

export const Route = createFileRoute("/_authed/calendar/heatmap")({
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => {
    const parsed = calendarSearchSchema.parse(search);
    if (!parsed.from || !parsed.to) {
      // Default range: previous month + current month + next month (3 months total)
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
    nav: { iconKey: "LayoutDashboard", label: "Mapa de Calor", order: 3, section: "Calendario" },
    permission: { action: "read", subject: "CalendarHeatmap" },
    title: "Mapa de calor",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "CalendarHeatmap")) {
      const routeApi = getRouteApi("/_authed/calendar/heatmap");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarHeatmapPage />
    </Suspense>
  ),
});
