import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { z } from "zod";

import PageLoader from "@/components/ui/PageLoader";

const CalendarHeatmapPage = lazy(() => import("@/pages/CalendarHeatmapPage"));

const heatmapSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  categories: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : [val];
    }),
});

export const Route = createFileRoute("/_authed/calendar/heatmap")({
  validateSearch: heatmapSearchSchema,
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
