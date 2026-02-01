import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";

const CalendarHeatmapPage = lazy(() => import("@/pages/CalendarHeatmapPage"));

export const Route = createFileRoute("/_authed/calendar/heatmap")({
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => {
    const parsed = calendarSearchSchema.parse(search);
    if (!parsed.from || !parsed.to) {
      const startOfYear = dayjs().startOf("year").format("YYYY-MM-DD");
      const endOfYear = dayjs().endOf("year").format("YYYY-MM-DD");
      return {
        ...parsed,
        from: parsed.from ?? startOfYear,
        to: parsed.to ?? endOfYear,
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
    if (!context.auth.can("read", "CalendarHeatmap")) {
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
