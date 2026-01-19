import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { calendarSyncQueries } from "@/features/calendar/queries";

const CalendarSyncHistoryPage = lazy(() => import("@/pages/CalendarSyncHistoryPage"));

export const Route = createFileRoute("/_authed/calendar/sync-history")({
  staticData: {
    nav: { iconKey: "Clock", label: "Historial Sync", order: 5, section: "Calendario" },
    permission: { action: "read", subject: "CalendarSyncLog" },
    title: "Historial de sincronización",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarSyncLog")) {
      const routeApi = getRouteApi("/_authed/calendar/sync-history");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
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
