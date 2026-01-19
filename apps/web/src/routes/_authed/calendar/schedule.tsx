import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { calendarQueries } from "@/features/calendar/queries";
import { computeDefaultFilters } from "@/features/calendar/utils/filters";

const CalendarSchedulePage = lazy(() => import("@/pages/CalendarSchedulePage"));

const routeApi = getRouteApi("/_authed/calendar/schedule");

export const Route = createFileRoute("/_authed/calendar/schedule")({
  staticData: {
    nav: { iconKey: "CalendarDays", label: "Calendario", order: 1, section: "Calendario" },
    permission: { action: "read", subject: "CalendarSchedule" },
    title: "Calendario interactivo",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarSchedule")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarSchedulePage />
    </Suspense>
  ),
  loader: async ({ context }) => {
    const defaults = computeDefaultFilters({});
    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.summary(defaults)),
      context.queryClient.ensureQueryData(calendarQueries.daily(defaults)),
    ]);
  },
});
