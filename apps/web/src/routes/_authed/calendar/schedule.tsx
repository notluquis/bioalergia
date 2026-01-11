import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CalendarSchedulePage = lazy(() => import("@/pages/CalendarSchedulePage"));

export const Route = createFileRoute("/_authed/calendar/schedule")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarSchedule")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarSchedulePage />
    </Suspense>
  ),
});
