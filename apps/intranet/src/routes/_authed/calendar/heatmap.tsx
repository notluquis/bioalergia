import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CalendarHeatmapPage = lazy(() => import("@/pages/CalendarHeatmapPage"));

export const Route = createFileRoute("/_authed/calendar/heatmap")({
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
