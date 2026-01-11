import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CalendarSyncHistoryPage = lazy(() => import("@/pages/CalendarSyncHistoryPage"));

export const Route = createFileRoute("/_authed/calendar/sync-history")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarSyncLog")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarSyncHistoryPage />
    </Suspense>
  ),
});
