import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { calendarSyncQueries } from "@/features/calendar/queries";
import { CalendarSyncHistoryPage } from "@/pages/CalendarSyncHistoryPage";

export const Route = createFileRoute("/_authed/calendar/sync-history")({
  staticData: {
    nav: { iconKey: "Clock", label: "Historial Sync", order: 5, section: "Calendario" },
    permission: { action: "read", subject: "CalendarSyncLog" },
    title: "Historial de sincronización",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "CalendarSyncLog")) {
      const routeApi = getRouteApi("/_authed/calendar/sync-history");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => <CalendarSyncHistoryPage />,

  loader: ({ context }) => context.queryClient.ensureQueryData(calendarSyncQueries.logs(50)),
});
