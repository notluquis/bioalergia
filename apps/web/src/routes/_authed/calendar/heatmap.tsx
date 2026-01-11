import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CalendarHeatmapPage = lazy(() => import("@/pages/CalendarHeatmapPage"));

export const Route = createFileRoute("/_authed/calendar/heatmap")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarHeatmap")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarHeatmapPage />
    </Suspense>
  ),
});
