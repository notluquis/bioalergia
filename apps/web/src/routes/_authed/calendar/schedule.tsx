import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { calendarQueries } from "@/features/calendar/queries";
import { computeDefaultFilters } from "@/features/calendar/utils/filters";

const CalendarSchedulePage = lazy(() => import("@/pages/CalendarSchedulePage"));

export const Route = createFileRoute("/_authed/calendar/schedule")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarSchedule")) {
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ context }) => {
    const defaults = computeDefaultFilters({});
    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.summary(defaults)),
      context.queryClient.ensureQueryData(calendarQueries.daily(defaults)),
    ]);
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarSchedulePage />
    </Suspense>
  ),
});
