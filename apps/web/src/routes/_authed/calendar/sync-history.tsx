import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { calendarSyncQueries } from "@/features/calendar/queries";

const CalendarSyncHistoryPage = lazy(() => import("@/pages/CalendarSyncHistoryPage"));

export const Route = createFileRoute("/_authed/calendar/sync-history")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarSyncLog")) {
      const routeApi = getRouteApi("/_authed/calendar/sync-history");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarSyncHistoryPage />
    </Suspense>
  ),
  loader: ({ context }) => context.queryClient.ensureQueryData(calendarSyncQueries.logs(50)),
});
